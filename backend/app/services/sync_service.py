import hashlib
import json
import logging
import os
import re
import threading
import tempfile
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from time import monotonic, sleep as time_sleep
from typing import Any

import mysql.connector
from sqlalchemy import Integer, Numeric, and_, case, cast, func, literal, select, text as sa_text, tuple_ as sa_tuple
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.analytics_cache import invalidate_endpoint, invalidate_prefix, set as cache_set
from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.models.brokers import (
    AnalyticsContractSnapshot,
    AnalyticsSourceFreshness,
    AnalyticsFact,
    DimTime,
    DimUn,
    DimSupervisor,
    DimVia,
    DimCategoria,
    DimContractMonth,
    CarteraFact,
    CarteraCorteAgg,
    CobranzasCohorteAgg,
    CobranzasFact,
    ContratosFact,
    DimNegocioContrato,
    DimNegocioUnMap,
    GestoresFact,
    AnalyticsRendimientoAgg,
    AnalyticsAnualesAgg,
    MvOptionsCartera,
    MvOptionsCohorte,
    MvOptionsRendimiento,
    MvOptionsAnuales,
    SyncChunkManifest,
    SyncExtractLog,
    SyncStagingRow,
    SyncRecord,
    SyncJobStep,
    SyncJob,
    SyncRun,
    SyncSchedule,
    SyncWatermark,
)
from app.schemas.analytics import AnalyticsFilters, CobranzasCohorteFirstPaintIn, CobranzasCohorteIn, PortfolioSummaryIn
from app.services.analytics_service import AnalyticsService, cohorte_base_cache_clear
from app.services.brokers_config_service import BrokersConfigService

SYNC_DOMAIN_QUERIES = {
    'analytics': 'query_analytics.sql',
    'cartera': 'query.sql',
    'cobranzas': 'query_cobranzas.sql',
    'contratos': 'query_contratos.sql',
    'gestores': 'query_gestores.sql',
}
SYNC_DOMAIN_QUERIES_V2 = {
    'cartera': 'sql/v2/query_cartera.sql',
    'cobranzas': 'sql/v2/query_cobranzas.sql',
    'contratos': 'sql/v2/query_contratos.sql',
    'gestores': 'sql/v2/query_gestores.sql',
}
INCLUDE_DIRECTIVE_RE = re.compile(r'^\s*--\s*@include\s+(.+?)\s*$')

BUSINESS_KEY_FIELDS = ['domain', 'contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo']
FACT_TABLE_BY_DOMAIN = {
    'analytics': AnalyticsFact,
    'cartera': CarteraFact,
    'cobranzas': CobranzasFact,
    'contratos': ContratosFact,
    'gestores': GestoresFact,
}

MYSQL_INCREMENTAL_HINTS = {
    # Column names are based on the aliases returned by each query_*.sql
    # and allow server-side watermark pushdown with safe fallback.
    'cobranzas': {'updated_col': 'Actualizado_al', 'id_col': 'id', 'format': '%Y-%m-%d %H:%i:%s'},
    'cartera': {'updated_col': 'fecha_cierre', 'id_col': 'id_contrato', 'format': '%Y/%m/%d'},
    'contratos': {'updated_col': 'updated_at', 'id_col': 'id', 'format': '%Y-%m-%d %H:%M:%S'},
    'gestores': {'updated_col': 'from_date', 'id_col': 'contract_id', 'format': '%Y-%m-%d'},
}

# Lightweight pre-check SQL per domain: returns max_updated, max_id for comparison with watermark.
# Same logical filters as main query; on error caller should assume new data (run full sync).
MYSQL_PRECHECK_QUERIES = {
    'cartera': """
        SELECT MAX(ccd.closed_date) AS max_updated, MAX(ccd.contract_id) AS max_id
        FROM epem.contract_closed_dates ccd
        JOIN epem.contracts c ON ccd.contract_id = c.id
        WHERE ccd.closed_date > '2020-12-31' AND c.enterprise_id IN (1, 2, 5)
    """,
    'cobranzas': """
        SELECT MAX(p.updated_at) AS max_updated, MAX(p.id) AS max_id
        FROM account_payment_ways apw
        JOIN payments p ON apw.payment_id = p.id
        JOIN contracts c ON p.contract_id = c.id
        WHERE p.status = 1
          AND p.type < 2
          AND p.date >= '2021-01-01'
          AND c.enterprise_id IN (1, 2, 5)
          AND p.contract_id NOT IN (55411, 55414, 59127, 59532, 60402)
    """,
    'contratos': """
        SELECT MAX(c.updated_at) AS max_updated, MAX(c.id) AS max_id
        FROM contracts c
        JOIN enterprises e ON e.id = c.enterprise_id
        WHERE c.status IN (5, 6) AND e.id IN (1, 2, 5)
    """,
    'gestores': """
        SELECT MAX(cp.from_date) AS max_updated, MAX(dcp.contract_id) AS max_id
        FROM detail_client_portfolios dcp
        JOIN contracts c ON dcp.contract_id = c.id
        JOIN client_portfolios cp ON dcp.clientportfolio_id = cp.id
        JOIN users u ON cp.manager_id = u.id
        WHERE u.id <> 696
          AND cp.from_date >= '2024-01-01'
          AND c.enterprise_id IN (1, 2, 5)
          AND cp.status = 1
    """,
}


def _target_table_name(domain: str) -> str:
    return FACT_TABLE_BY_DOMAIN[domain].__tablename__


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _path_within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _query_variant_for_domain(domain: str) -> str:
    domain_key = str(domain or '').strip().lower()
    if domain_key not in SYNC_DOMAIN_QUERIES_V2:
        return 'v1'
    env_by_domain = {
        'cartera': 'sync_query_variant_cartera',
        'cobranzas': 'sync_query_variant_cobranzas',
        'contratos': 'sync_query_variant_contratos',
        'gestores': 'sync_query_variant_gestores',
    }
    attr = env_by_domain.get(domain_key)
    raw = str(getattr(settings, attr, 'v1') if attr else 'v1').strip().lower()
    if raw not in {'v1', 'v2'}:
        logger.warning('[sync:%s] invalid query variant=%s, fallback=v1', domain_key, raw)
        return 'v1'
    return raw


def _query_filename_for(domain: str) -> str:
    domain_key = str(domain or '').strip().lower()
    if domain_key not in SYNC_DOMAIN_QUERIES:
        raise KeyError(f'unknown sync domain: {domain_key}')
    variant = _query_variant_for_domain(domain_key)
    if variant == 'v2' and domain_key in SYNC_DOMAIN_QUERIES_V2:
        return SYNC_DOMAIN_QUERIES_V2[domain_key]
    return SYNC_DOMAIN_QUERIES[domain_key]


def _query_file_for(domain: str) -> str:
    try:
        return _query_filename_for(domain)
    except Exception:
        return SYNC_DOMAIN_QUERIES.get(str(domain or '').strip().lower(), '')


def _prewarm_analytics_cache_after_sync(db: Session, domain: str) -> None:
    """Best-effort cache prewarm to improve first paint after sync."""
    try:
        base_filters = AnalyticsFilters()
        if domain in {'cartera', 'cobranzas', 'analytics'}:
            portfolio_options = AnalyticsService.fetch_portfolio_corte_options_v2(db, base_filters)
            cache_set('portfolio/corte/options', base_filters, portfolio_options, ttl_seconds=600)
            cache_set('portfolio-corte-v2/options', base_filters, portfolio_options, ttl_seconds=600)
            portfolio_summary = AnalyticsService.fetch_portfolio_corte_summary_v2(db, PortfolioSummaryIn(include_rows=False))
            cache_set('portfolio-corte-v2/summary', PortfolioSummaryIn(include_rows=False), portfolio_summary, ttl_seconds=180)
            portfolio_fp_filters = PortfolioSummaryIn(include_rows=False)
            portfolio_fp = AnalyticsService.fetch_portfolio_corte_first_paint_v2(db, portfolio_fp_filters)
            cache_set('portfolio-corte-v2/first-paint', portfolio_fp_filters, portfolio_fp, ttl_seconds=180)
            rendimiento_options = AnalyticsService.fetch_rendimiento_options_v2(db, base_filters)
            cache_set('rendimiento-v2/options', base_filters, rendimiento_options, ttl_seconds=120)
            rendimiento_summary = AnalyticsService.fetch_rendimiento_summary_v2(db, base_filters)
            cache_set('rendimiento-v2/summary', base_filters, rendimiento_summary, ttl_seconds=300)
            rendimiento_fp = AnalyticsService.fetch_rendimiento_first_paint_v2(db, base_filters)
            cache_set('rendimiento-v2/first-paint', base_filters, rendimiento_fp, ttl_seconds=180)
            anuales_options = AnalyticsService.fetch_anuales_options_v2(db, base_filters)
            cache_set('anuales-v2/options', base_filters, anuales_options, ttl_seconds=120)
            anuales_summary = AnalyticsService.fetch_anuales_summary_v2(db, base_filters)
            cache_set('anuales-v2/summary', base_filters, anuales_summary, ttl_seconds=300)
            anuales_fp = AnalyticsService.fetch_anuales_first_paint_v2(db, base_filters)
            cache_set('anuales-v2/first-paint', base_filters, anuales_fp, ttl_seconds=180)
        if domain in {'cobranzas', 'cartera'}:
            cohorte_options_filters = CobranzasCohorteIn()
            cohorte_options = AnalyticsService.fetch_cobranzas_cohorte_options_v1(db, cohorte_options_filters)
            cache_set('cobranzas-cohorte/options', cohorte_options_filters, cohorte_options, ttl_seconds=1800)
            cache_set('cobranzas-cohorte-v2/options', cohorte_options_filters, cohorte_options, ttl_seconds=1800)
            cohorte_fp_filters = CobranzasCohorteFirstPaintIn()
            cohorte_fp = AnalyticsService.fetch_cobranzas_cohorte_first_paint_v2(db, cohorte_fp_filters)
            cache_set('cobranzas-cohorte-v2/first-paint', cohorte_fp_filters, cohorte_fp, ttl_seconds=300)
        _append_log(domain, 'Cache prewarm completado (best-effort)')
    except Exception as exc:
        _append_log(domain, f'Cache prewarm omitido: {exc}')


def _job_step_from_stage(stage: str | None) -> str | None:
    mapping = {
        'queued': 'queued',
        'starting': 'bootstrap',
        'connecting_mysql': 'extract',
        'normalizing': 'normalize',
        'replacing_window': 'replace_window',
        'upserting': 'upsert',
        'refreshing_snapshot': 'refresh_snapshot',
        'refreshing_corte_agg': 'refresh_agg',
        'analyzing': 'analyze',
        'completed': 'finalize',
        'cancelled': 'cancelled',
        'failed': 'failed',
    }
    return mapping.get(str(stage or '').strip().lower())


def _status_log_list(log_json: str | None) -> list[str]:
    """Parse log_json and return a list of strings for SyncStatusOut (avoids Pydantic validation errors)."""
    try:
        parsed = json.loads(log_json or '[]')
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(x) for x in parsed]

_state_lock = threading.Lock()
_state_by_domain: dict[str, dict] = {}
_running_by_domain: set[str] = set()
_last_persist_by_domain: dict[str, dict[str, Any]] = {}
logger = logging.getLogger(__name__)
RUNNING_JOB_STALE_GRACE_SECONDS = max(60, int(getattr(settings, 'sync_running_stale_grace_seconds', 600) or 600))


class SyncCancelledError(RuntimeError):
    pass


def _iso_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


def _query_path_for(domain: str) -> Path:
    filename = _query_filename_for(domain)
    return _repo_root() / filename


def _relative_repo_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(_repo_root().resolve()).as_posix()
    except ValueError:
        return str(path)


def _load_sql_with_includes(
    query_path: Path,
    *,
    depth: int = 0,
    max_depth: int = 5,
    stack: tuple[Path, ...] | None = None,
) -> tuple[str, list[str]]:
    resolved_path = query_path.resolve()
    if stack is None:
        stack = tuple()
    if depth > max_depth:
        chain = ' -> '.join(_relative_repo_path(p) for p in stack)
        raise ValueError(f'include depth exceeded (max={max_depth}): {chain}')
    if resolved_path in stack:
        chain = ' -> '.join(_relative_repo_path(p) for p in (*stack, resolved_path))
        raise ValueError(f'circular include detected: {chain}')
    if not resolved_path.exists():
        raise FileNotFoundError(f'SQL file not found: {_relative_repo_path(resolved_path)}')

    allowed_roots = (
        (_repo_root() / 'sql' / 'common').resolve(),
        (_repo_root() / 'sql' / 'v2').resolve(),
    )
    output_lines: list[str] = []
    includes: list[str] = []
    text = resolved_path.read_text(encoding='utf-8')
    for line in text.splitlines():
        match = INCLUDE_DIRECTIVE_RE.match(line)
        if not match:
            output_lines.append(line)
            continue
        include_ref = str(match.group(1) or '').strip()
        include_path = (_repo_root() / include_ref).resolve()
        if not any(_path_within(include_path, root) for root in allowed_roots):
            raise ValueError(f'include path not allowed: {include_ref}')
        if not include_path.exists():
            raise FileNotFoundError(f'include file not found: {include_ref}')
        include_sql, nested = _load_sql_with_includes(
            include_path,
            depth=depth + 1,
            max_depth=max_depth,
            stack=(*stack, resolved_path),
        )
        includes.append(_relative_repo_path(include_path))
        includes.extend(nested)
        output_lines.append(include_sql)
    return '\n'.join(output_lines).strip() + '\n', includes


def _month_serial(mm_yyyy: str) -> int:
    text = str(mm_yyyy or '').strip()
    parts = text.split('/')
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return 0
    month = int(parts[0])
    year = int(parts[1])
    if month < 1 or month > 12:
        return 0
    return year * 12 + month


def _year_of(mm_yyyy: str) -> int:
    text = str(mm_yyyy or '').strip()
    parts = text.split('/')
    if len(parts) != 2 or not parts[1].isdigit():
        return 0
    return int(parts[1])


def _month_range(from_mm_yyyy: str, to_mm_yyyy: str) -> list[str]:
    start = _month_serial(from_mm_yyyy)
    end = _month_serial(to_mm_yyyy)
    if start <= 0 or end <= 0 or start > end:
        return []
    out: list[str] = []
    current = start
    while current <= end:
        year = current // 12
        month = current % 12
        if month == 0:
            month = 12
            year -= 1
        out.append(f'{month:02d}/{year}')
        current += 1
    return out


def _iter_chunks(values: list, size: int = 1000):
    for i in range(0, len(values), max(1, int(size))):
        yield values[i:i + max(1, int(size))]


def _semantic_refresh_month_batches(affected_months: set[str]) -> list[list[str]]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if _month_serial(str(m).strip()) > 0}, key=_month_serial)
    if not months:
        return []
    raw_size = int(getattr(settings, 'sync_semantic_refresh_batch_months', 3) or 3)
    batch_size = max(1, min(24, raw_size))
    return [months[i:i + batch_size] for i in range(0, len(months), batch_size)]


def _month_add(mm_yyyy: str, delta_months: int) -> str:
    serial = _month_serial(mm_yyyy)
    if serial <= 0:
        return ''
    abs_month = serial + int(delta_months)
    if abs_month <= 0:
        return ''
    year = abs_month // 12
    month = abs_month % 12
    if month == 0:
        month = 12
        year -= 1
    if year <= 0:
        return ''
    return f'{month:02d}/{year}'


def _parse_month(value: object) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    if not text:
        return ''
    if '/' in text:
        parts = text.split('/')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit() and len(parts[1]) == 4:
            month = int(parts[0])
            if 1 <= month <= 12:
                return f'{month:02d}/{parts[1]}'
    formats = ['%Y-%m-%d', '%Y/%m/%d', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime('%m/%Y')
        except ValueError:
            continue
    return ''


def _parse_date_key(value: object) -> str:
    """Normalize a date-like value to YYYY-MM-DD for dedup keys."""
    if value is None:
        return ''
    text = str(value).strip()
    if not text:
        return ''
    formats = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%d/%m/%Y',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S',
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return ''


def _parse_iso_date(value: object) -> date | None:
    text = _parse_date_key(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, '%Y-%m-%d').date()
    except ValueError:
        return None


def _parse_payment_date(row: dict) -> date | None:
    day = _normalize_key(row, 'Dia', 'day', 'dia')
    month = _normalize_key(row, 'Mes', 'mes', 'month')
    year = _normalize_key(row, 'AÃ±o', 'AÃƒÂ±o', 'AÃƒÆ’Ã‚Â±o', 'anio', 'year')
    if day.isdigit() and month.isdigit() and year.isdigit():
        try:
            return date(int(year), int(month), int(day))
        except Exception:
            pass
    return _parse_iso_date(_normalize_key(row, 'date', 'payment_date', 'Actualizado_al'))


def _normalize_payment_via_class(value: str) -> str:
    text = str(value or '').strip().upper()
    if text == 'COBRADOR':
        return 'COBRADOR'
    return 'DEBITO'


def _normalize_key(row: dict, *candidates: str) -> str:
    for key in candidates:
        if key in row and str(row.get(key) or '').strip():
            return str(row.get(key)).strip()
    lower = {str(k).lower(): k for k in row.keys()}
    for key in candidates:
        k = lower.get(key.lower())
        if k and str(row.get(k) or '').strip():
            return str(row.get(k)).strip()
    return ''


def _parse_source_updated_at(value: object) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d',
        '%d/%m/%Y %H:%M:%S',
        '%d/%m/%Y',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except Exception:
            continue
    return None


def _extract_source_markers(row: dict) -> tuple[datetime | None, str | None]:
    updated_at = None
    source_id = None
    updated_candidates = [
        'updated_at',
        'updatedAt',
        'Actualizado_al',
        'actualizado_al',
        'fecha_actualizacion',
        'modificado_en',
    ]
    id_candidates = [
        'payment_way_id',
        'id',
        'ID',
        'payment_id',
        'contract_id',
        'id_contrato',
    ]
    for key in updated_candidates:
        if key in row:
            updated_at = _parse_source_updated_at(row.get(key))
            if updated_at is not None:
                break
    for key in id_candidates:
        if key in row and str(row.get(key) or '').strip():
            source_id = str(row.get(key)).strip()
            break
    return updated_at, source_id


def _chunk_signal_update(current: dict | None, source_hash: str) -> dict:
    state = current or {'count': 0, 'sum_a': 0, 'sum_b': 0, 'xor_c': 0}
    h = str(source_hash or '')
    if len(h) < 48:
        h = (h + ('0' * 48))[:48]
    a = int(h[0:16], 16)
    b = int(h[16:32], 16)
    c = int(h[32:48], 16)
    mod = 2 ** 64
    state['count'] = int(state['count']) + 1
    state['sum_a'] = (int(state['sum_a']) + a) % mod
    state['sum_b'] = (int(state['sum_b']) + b) % mod
    state['xor_c'] = int(state['xor_c']) ^ c
    return state


def _chunk_hash_finalize(signal_state: dict) -> str:
    payload = (
        f"{int(signal_state.get('count') or 0)}|"
        f"{int(signal_state.get('sum_a') or 0)}|"
        f"{int(signal_state.get('sum_b') or 0)}|"
        f"{int(signal_state.get('xor_c') or 0)}"
    )
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def _normalize_record(domain: str, row: dict, seq: int) -> dict:
    contract_id = _normalize_key(row, 'contract_id', 'id_contrato', 'id')
    if not contract_id:
        contract_id = f'{domain}_{seq}'

    close_date = _parse_date_key(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
    close_month = _parse_month(close_date) if close_date else _parse_month(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
    raw_gestion_month = _normalize_key(row, 'gestion_month')
    gestion_month = raw_gestion_month
    if not gestion_month:
        y = _normalize_key(row, 'AÃ±o', 'AÃƒÂ±o', 'AÃƒÆ’Ã‚Â±o', 'anio', 'year')
        m = _normalize_key(row, 'Mes', 'mes', 'month')
        if y.isdigit() and m.isdigit():
            gestion_month = f'{int(m):02d}/{y}'
    if not gestion_month:
        if domain == 'cartera' and close_month:
            # Regla de negocio: gestion = cierre + 1 mes.
            gestion_month = _month_add(close_month, 1)
        if not gestion_month:
            gestion_month = _parse_month(
                _normalize_key(row, 'from_date', 'date', 'fecha_contrato', 'fecha_cierre', 'Actualizado_al')
            )
    if domain == 'cartera' and close_month:
        parsed_raw_gestion = _parse_month(raw_gestion_month) if raw_gestion_month else ''
        if not raw_gestion_month or parsed_raw_gestion == close_month:
            shifted = _month_add(close_month, 1)
            if shifted:
                gestion_month = shifted
    if not gestion_month:
        gestion_month = datetime.utcnow().strftime('%m/%Y')

    supervisor = _normalize_key(row, 'supervisor', 'Supervisor', 'Gestor', 'Vendedor').upper() or 'S/D'
    un = _normalize_key(row, 'un', 'UN').upper() or 'S/D'
    via = _normalize_key(row, 'via', 'via_cobro', 'via_de_cobro', 'VP').upper() or 'S/D'

    if domain == 'cartera':
        tramo_text = _normalize_key(row, 'cuotas_vencidas', 'quotas_expirations', 'tramo')
    else:
        tramo_text = _normalize_key(row, 'tramo')
    try:
        tramo = int(float(tramo_text)) if tramo_text else 0
    except ValueError:
        tramo = 0
    if tramo < 0:
        tramo = 0
    if tramo >= 7:
        tramo = 7

    payload_json = '{}'
    source_hash = ''
    close_date = _parse_date_key(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
    payment_date = None
    payment_month = ''
    payment_year = 0
    payment_amount = 0.0
    payment_via_class = ''
    source_row_id = ''
    analytics_contracts_total = 1
    analytics_debt_total = 0.0
    analytics_paid_total = 0.0
    if domain == 'cobranzas':
        source_row_id = _normalize_key(row, 'payment_way_id', 'account_payment_way_id', 'apw_id', 'id')
        parsed_payment_date = _parse_payment_date(row)
        payment_date = parsed_payment_date.strftime('%Y-%m-%d') if parsed_payment_date else ''
        payment_month = _parse_month(parsed_payment_date.strftime('%Y-%m-%d') if parsed_payment_date else '') or gestion_month
        payment_year = _year_of(payment_month) or datetime.utcnow().year
        payment_amount = _to_float(_normalize_key(row, 'monto', 'amount', 'payment_amount'))
        payment_via_class = _normalize_payment_via_class(via)
        # Fast canonical hash for high-volume domain (avoids expensive full JSON sort/hash).
        signature = (
            f'{source_row_id}|{contract_id}|{gestion_month}|{payment_date}|{payment_amount}|'
            f'{payment_via_class}|{supervisor}|{un}|{via}|{tramo}'
        )
        source_hash = hashlib.sha256(signature.encode('utf-8')).hexdigest()
    elif domain == 'analytics':
        analytics_contracts_total = max(
            1,
            _to_int(
                row.get('contracts_total')
                or row.get('contracts')
                or row.get('cantidad_contratos')
                or 1,
                1,
            ),
        )
        analytics_debt_total = _to_float(
            row.get('debt_total')
            or row.get('debt')
            or row.get('total_saldo')
            or row.get('deberia')
        )
        analytics_paid_total = _to_float(
            row.get('paid_total')
            or row.get('paid')
            or row.get('cobrado')
        )
        signature = (
            f'{contract_id}|{gestion_month}|{supervisor}|{un}|{via}|{tramo}|'
            f'{analytics_contracts_total}|{analytics_debt_total}|{analytics_paid_total}'
        )
        source_hash = hashlib.sha256(signature.encode('utf-8')).hexdigest()
    else:
        payload_json = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
        source_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()

    return {
        'domain': domain,
        'contract_id': str(contract_id)[:64],
        'gestion_month': str(gestion_month)[:7],
        'supervisor': str(supervisor)[:128],
        'un': str(un)[:128],
        'via': str(via)[:32],
        'tramo': tramo,
        'close_date': close_date,
        'close_month': str(close_month)[:7] if close_month else '',
        'payment_date': payment_date,
        'payment_month': payment_month,
        'payment_year': payment_year,
        'payment_amount': payment_amount,
        'payment_via_class': payment_via_class,
        'source_row_id': source_row_id,
        'contracts_total': analytics_contracts_total,
        'debt_total': analytics_debt_total,
        'paid_total': analytics_paid_total,
        'payload_json': payload_json,
        'source_hash': source_hash,
    }


def _fact_row_from_normalized(domain: str, normalized: dict) -> dict:
    payload = {}
    try:
        payload = json.loads(normalized.get('payload_json') or '{}')
    except Exception:
        payload = {}

    gestion_month = str(normalized.get('gestion_month') or '')
    close_month = str(normalized.get('close_month') or '')
    if _month_serial(close_month) <= 0:
        close_month = _parse_month(normalized.get('close_date') or '') or gestion_month
    close_year = _year_of(close_month) or datetime.utcnow().year
    close_date = _parse_iso_date(normalized.get('close_date'))
    if close_date is None:
        try:
            close_date = datetime.strptime(f'01/{close_month}', '%d/%m/%Y').date()
        except ValueError:
            close_date = datetime.utcnow().date()
    tramo = int(normalized.get('tramo') or 0)
    tramo = 7 if tramo >= 7 else max(0, tramo)
    category = 'MOROSO' if tramo > 3 else 'VIGENTE'

    base = {
        'contract_id': normalized['contract_id'],
        'gestion_month': gestion_month,
        'supervisor': normalized['supervisor'],
        'un': normalized['un'],
        'source_hash': normalized['source_hash'],
        'payload_json': normalized['payload_json'],
        'loaded_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    if domain == 'cartera':
        contract_date = _parse_iso_date(payload.get('fecha_contrato'))
        culm_date = _parse_iso_date(
            payload.get('fecha_culminacion')
            or payload.get('fecha_culminación')
            or payload.get('fecha_fin')
            or payload.get('fecha_terminacion')
        )
        contract_month = _month_from_any(payload.get('fecha_contrato'))
        culm_month = _month_from_any(
            payload.get('fecha_culminacion')
            or payload.get('fecha_culminación')
            or payload.get('fecha_fin')
            or payload.get('fecha_terminacion')
        )
        return {
            **base,
            'close_date': close_date,
            'close_month': close_month,
            'close_year': close_year,
            'contract_date': contract_date,
            'contract_month': contract_month or '',
            'culm_date': culm_date,
            'culm_month': culm_month or '',
            'cuota_amount': _to_float(payload.get('monto_cuota') or payload.get('cuota')),
            'via_cobro': normalized['via'],
            'tramo': tramo,
            'category': category,
            'contracts_total': max(1, _to_int(payload.get('contracts_total') or 1, 1)),
            'monto_vencido': _to_float(payload.get('monto_vencido') or payload.get('expired_amount') or payload.get('capital_vencido')),
            'total_saldo': _to_float(payload.get('total_saldo') or payload.get('total_residue')),
            'capital_saldo': _to_float(payload.get('capital_saldo') or payload.get('capital_amount_residue')),
            'capital_vencido': _to_float(payload.get('capital_vencido') or payload.get('expired_capital_amount')),
        }
    if domain == 'analytics':
        contracts_total = max(1, _to_int(normalized.get('contracts_total'), 1))
        debt_total = _to_float(normalized.get('debt_total'))
        paid_total = _to_float(normalized.get('paid_total'))
        if contracts_total <= 0:
            contracts_total = max(1, _to_int(payload.get('contracts_total') or 1, 1))
        if debt_total <= 0:
            debt_total = _to_float(payload.get('debt_total') or payload.get('debt') or payload.get('total_saldo'))
        if paid_total <= 0:
            paid_total = _to_float(payload.get('paid_total') or payload.get('paid'))
        return {
            **base,
            'via': normalized['via'],
            'tramo': tramo,
            'contracts_total': contracts_total,
            'debt_total': debt_total,
            'paid_total': paid_total,
        }
    if domain == 'cobranzas':
        payment_date = _parse_iso_date(normalized.get('payment_date'))
        if payment_date is None:
            try:
                payment_date = datetime.strptime(f'01/{gestion_month}', '%d/%m/%Y').date()
            except ValueError:
                payment_date = datetime.utcnow().date()
        payment_month = str(normalized.get('payment_month') or gestion_month)[:7]
        payment_year = int(normalized.get('payment_year') or _year_of(payment_month) or datetime.utcnow().year)
        return {
            **base,
            'via': normalized['via'],
            'tramo': tramo,
            'source_row_id': str(normalized.get('source_row_id') or '')[:64] or None,
            'payment_date': payment_date,
            'payment_month': payment_month,
            'payment_year': payment_year,
            'payment_amount': _to_float(normalized.get('payment_amount') or payload.get('monto')),
            'payment_via_class': _normalize_payment_via_class(normalized.get('payment_via_class') or normalized['via']),
        }
    return {
        **base,
        'via': normalized['via'],
        'tramo': tramo,
    }


def _source_dedupe_key(normalized: dict) -> tuple:
    """
    Source dedupe key:
    - cartera: business rule requested by user (contract_id + close_date).
    - others: keep previous wide key.
    """
    domain = str(normalized.get('domain') or '').strip().lower()
    if domain == 'cartera':
        close_date = normalized.get('close_date') or normalized.get('gestion_month') or ''
        return (
            normalized.get('domain'),
            normalized.get('contract_id'),
            close_date,
        )
    if domain == 'cobranzas':
        return (
            normalized.get('domain'),
            normalized.get('source_row_id') or normalized.get('source_hash'),
        )
    return tuple(normalized[k] for k in BUSINESS_KEY_FIELDS)


def _dedupe_rows_in_chunk(rows: list[dict]) -> tuple[list[dict], int]:
    if not rows:
        return [], 0
    deduped: list[dict] = []
    seen: set[tuple] = set()
    duplicates = 0
    for item in rows:
        key = _source_dedupe_key(item)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        deduped.append(item)
    return deduped, duplicates


def _set_state(domain: str, updates: dict) -> None:
    snapshot: dict[str, Any] | None = None
    force_persist = False
    with _state_lock:
        current = dict(_state_by_domain.get(domain) or {})
        previous = dict(current)
        current.update(updates)
        started_at_raw = current.get('started_at')
        started_at_dt = None
        if isinstance(started_at_raw, str) and started_at_raw:
            try:
                started_at_dt = datetime.fromisoformat(started_at_raw.replace('Z', '+00:00'))
            except Exception:
                started_at_dt = None
        if started_at_dt is not None:
            now = datetime.now(timezone.utc)
            if started_at_dt.tzinfo is None:
                started_at_dt = started_at_dt.replace(tzinfo=timezone.utc)
            elapsed = max(1.0, (now - started_at_dt).total_seconds())
            progress = float(current.get('progress_pct') or 0.0)
            rows_read = float(current.get('rows_read') or 0.0)
            rows_processed = float(current.get('rows_upserted') or 0.0) + float(current.get('rows_unchanged') or 0.0)
            throughput = rows_read / elapsed if rows_read > 0 else rows_processed / elapsed
            current['throughput_rows_per_sec'] = round(throughput, 2) if throughput > 0 else 0.0
            if current.get('running') and progress > 0 and progress < 100:
                current['eta_seconds'] = int((elapsed * (100.0 - progress)) / progress)
            else:
                current['eta_seconds'] = 0
        current['current_query_file'] = _query_file_for(domain)
        current['job_step'] = _job_step_from_stage(current.get('stage'))
        _state_by_domain[domain] = current
        snapshot = dict(current)
        force_keys = {
            'stage',
            'progress_pct',
            'status_message',
            'rows_read',
            'rows_upserted',
            'rows_unchanged',
            'chunk_key',
            'chunk_status',
            'skipped_unchanged_chunks',
            'duplicates_detected',
        }
        force_persist = bool(force_keys.intersection(set(updates.keys())))
        if previous.get('running') != current.get('running'):
            force_persist = True
    _persist_runtime_state_snapshot(domain, snapshot, force=force_persist)


def _persist_runtime_state_snapshot(domain: str, snapshot: dict[str, Any] | None, *, force: bool = False) -> None:
    if not snapshot:
        return
    job_id = str(snapshot.get('job_id') or '').strip()
    if not job_id:
        return
    # Worker and API run in different processes; persist periodic state so /sync/status stays accurate.
    fingerprint = (
        str(snapshot.get('stage') or ''),
        int(snapshot.get('progress_pct') or 0),
        int(snapshot.get('rows_read') or 0),
        int(snapshot.get('rows_upserted') or 0),
        int(snapshot.get('rows_unchanged') or 0),
        int(snapshot.get('duplicates_detected') or 0),
        str(snapshot.get('status_message') or ''),
    )
    now_ts = datetime.now(timezone.utc).timestamp()
    with _state_lock:
        meta = dict(_last_persist_by_domain.get(domain) or {})
    prev_ts = float(meta.get('ts') or 0.0)
    prev_fp = tuple(meta.get('fp') or ())
    should_persist = force or (now_ts - prev_ts >= 1.5) or (prev_fp != fingerprint)
    if not should_persist:
        return
    db = SessionLocal()
    try:
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': snapshot.get('mode'),
                'year_from': snapshot.get('year_from'),
                'close_month': snapshot.get('close_month'),
                'close_month_from': snapshot.get('close_month_from'),
                'close_month_to': snapshot.get('close_month_to'),
                'target_table': snapshot.get('target_table'),
                'running': bool(snapshot.get('running')),
                'stage': snapshot.get('stage'),
                'progress_pct': int(snapshot.get('progress_pct') or 0),
                'status_message': snapshot.get('status_message'),
                'rows_inserted': int(snapshot.get('rows_inserted') or 0),
                'rows_updated': int(snapshot.get('rows_updated') or 0),
                'rows_skipped': int(snapshot.get('rows_skipped') or 0),
                'rows_read': int(snapshot.get('rows_read') or 0),
                'rows_upserted': int(snapshot.get('rows_upserted') or 0),
                'rows_unchanged': int(snapshot.get('rows_unchanged') or 0),
                'throughput_rows_per_sec': float(snapshot.get('throughput_rows_per_sec') or 0.0),
                'eta_seconds': int(snapshot.get('eta_seconds') or 0),
                'current_query_file': snapshot.get('current_query_file') or _query_file_for(domain),
                'job_step': snapshot.get('job_step'),
                'chunk_key': snapshot.get('chunk_key'),
                'chunk_status': snapshot.get('chunk_status'),
                'skipped_unchanged_chunks': int(snapshot.get('skipped_unchanged_chunks') or 0),
                'duplicates_detected': int(snapshot.get('duplicates_detected') or 0),
                'error': snapshot.get('error'),
                'started_at': (
                    datetime.fromisoformat(str(snapshot.get('started_at')).replace('Z', '+00:00')).replace(tzinfo=None)
                    if snapshot.get('started_at')
                    else None
                ),
                'finished_at': (
                    datetime.fromisoformat(str(snapshot.get('finished_at')).replace('Z', '+00:00')).replace(tzinfo=None)
                    if snapshot.get('finished_at')
                    else None
                ),
                'duration_sec': snapshot.get('duration_sec'),
                'log': list(snapshot.get('log') or []),
            },
        )
    except Exception:
        logger.exception('[sync:%s] no se pudo persistir snapshot runtime', domain)
    finally:
        db.close()
    with _state_lock:
        _last_persist_by_domain[domain] = {'ts': now_ts, 'fp': fingerprint}


def _append_log(domain: str, line: str) -> None:
    with _state_lock:
        current = dict(_state_by_domain.get(domain) or {'log': []})
        logs = list(current.get('log') or [])
        logs.append(line)
        current['log'] = logs[-200:]
        _state_by_domain[domain] = current
    logger.info('[sync:%s] %s', domain, line)


def _strip_sql_trailing_semicolon(sql_text: str) -> str:
    text = str(sql_text or '').strip()
    while text.endswith(';'):
        text = text[:-1].rstrip()
    return text


def _build_mysql_incremental_query(
    *,
    domain: str,
    base_sql: str,
    watermark_updated_at: datetime | None,
    watermark_source_id: str | None,
) -> tuple[str, tuple, bool]:
    hint = MYSQL_INCREMENTAL_HINTS.get(str(domain or '').strip().lower())
    if not hint or watermark_updated_at is None:
        return base_sql, tuple(), False
    # Cobranzas: evitar pushdown con STR_TO_DATE por conflicto % en formato con placeholders del connector
    if str(domain or '').strip().lower() == 'cobranzas':
        return base_sql, tuple(), False
    updated_col = str(hint.get('updated_col') or '').strip()
    id_col = str(hint.get('id_col') or '').strip()
    date_format = str(hint.get('format') or '%Y-%m-%d %H:%i:%s')
    if not updated_col:
        return base_sql, tuple(), False
    dt_value = watermark_updated_at.strftime('%Y-%m-%d %H:%M:%S')
    # Escapar % en date_format para que el connector MySQL no interprete %Y/%m/etc como placeholders
    date_format_escaped = date_format.replace('%', '%%')
    wrapped_sql = _strip_sql_trailing_semicolon(base_sql)
    if not wrapped_sql:
        return base_sql, tuple(), False
    if id_col and str(watermark_source_id or '').strip():
        sql = (
            f"SELECT * FROM ({wrapped_sql}) _src "
            f"WHERE ("
            f"STR_TO_DATE(CAST(_src.`{updated_col}` AS CHAR), '{date_format_escaped}') > %s "
            f"OR (STR_TO_DATE(CAST(_src.`{updated_col}` AS CHAR), '{date_format_escaped}') = %s "
            f"AND CAST(_src.`{id_col}` AS CHAR) > %s)"
            f")"
        )
        params = (dt_value, dt_value, str(watermark_source_id))
        return sql, params, True
    sql = (
        f"SELECT * FROM ({wrapped_sql}) _src "
        f"WHERE STR_TO_DATE(CAST(_src.`{updated_col}` AS CHAR), '{date_format_escaped}') > %s"
    )
    params = (dt_value,)
    return sql, params, True


def _resolve_mysql_connection_config(db: Session | None = None) -> dict[str, Any]:
    cfg = {
        'host': settings.mysql_host,
        'port': int(settings.mysql_port or 3306),
        'user': settings.mysql_user,
        'password': settings.mysql_password,
        'database': settings.mysql_database,
        'ssl_disabled': bool(getattr(settings, 'mysql_ssl_disabled', True)),
        'connection_timeout': max(5, int(getattr(settings, 'mysql_connection_timeout_seconds', 20) or 20)),
        'read_timeout': max(30, int(getattr(settings, 'mysql_read_timeout_seconds', 600) or 600)),
        'write_timeout': max(30, int(getattr(settings, 'mysql_write_timeout_seconds', 120) or 120)),
        'consume_results': True,
    }
    if db is None:
        return cfg
    try:
        stored = BrokersConfigService.get_mysql_connection(db) or {}
        host = str(stored.get('host') or '').strip()
        user = str(stored.get('user') or '').strip()
        database = str(stored.get('database') or '').strip()
        if host:
            cfg['host'] = host
        if user:
            cfg['user'] = user
        if database:
            cfg['database'] = database
        if 'password' in stored:
            cfg['password'] = str(stored.get('password') or '')
        if stored.get('port') is not None:
            try:
                cfg['port'] = int(stored.get('port'))
            except Exception:
                pass
        if 'ssl_disabled' in stored:
            cfg['ssl_disabled'] = bool(stored.get('ssl_disabled'))
    except Exception:
        logger.exception('Failed to load mysql connection overrides from config store')
    return cfg


def _mysql_has_new_data(
    *,
    domain: str,
    watermark_updated_at: datetime | None,
    watermark_source_id: str | None,
    mysql_config: dict[str, Any],
) -> bool:
    """Run a lightweight MySQL query to see if any row has (updated, id) > watermark. On error return True (run full sync)."""
    if domain not in MYSQL_PRECHECK_QUERIES:
        return True
    if watermark_updated_at is None:
        return True
    sql = MYSQL_PRECHECK_QUERIES.get(domain, '').strip()
    if not sql:
        return True
    try:
        conn = mysql.connector.connect(**dict(mysql_config))
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql)
            row = cursor.fetchone()
            cursor.close()
        finally:
            conn.close()
        if not row:
            return False
        max_updated_raw = row.get('max_updated')
        max_id_raw = row.get('max_id')
        if max_updated_raw is None:
            return False
        max_updated = _parse_source_updated_at(max_updated_raw)
        if max_updated is None:
            return True
        if max_updated > watermark_updated_at:
            return True
        if max_updated < watermark_updated_at:
            return False
        wm_id = str(watermark_source_id or '').strip()
        if not wm_id:
            return True
        max_id_str = str(max_id_raw or '').strip()
        if not max_id_str:
            return True
        try:
            return int(max_id_str) > int(wm_id)
        except (ValueError, TypeError):
            return max_id_str > wm_id
    except Exception:
        logger.exception('[sync:%s] pre-check failed, assuming new data', domain)
        return True


def _iter_from_mysql(
    query_path: Path,
    *,
    domain: str | None = None,
    watermark_updated_at: datetime | None = None,
    watermark_source_id: str | None = None,
    mysql_config: dict[str, Any] | None = None,
    batch_size_override: int | None = None,
):
    cfg = dict(mysql_config or _resolve_mysql_connection_config(None))
    conn = mysql.connector.connect(**cfg)
    try:
        # Shield long-running fetch loops from transient low socket timeouts.
        try:
            if getattr(conn, '_socket', None) is not None:
                conn._socket.settimeout(float(max(30, int(cfg.get('read_timeout') or 600))))
        except Exception:
            pass
        cursor = conn.cursor(dictionary=True)
        try:
            query_text, includes = _load_sql_with_includes(query_path)
            domain_key = str(domain or '').strip().lower()
            query_variant = _query_variant_for_domain(domain_key) if domain_key else 'v1'
            logger.info(
                '[sync:%s] mysql query variant=%s path=%s includes=%s',
                str(domain_key or 'unknown'),
                query_variant,
                _relative_repo_path(query_path),
                ','.join(includes) if includes else '-',
            )
            effective_sql = query_text
            effective_params: tuple = tuple()
            used_pushdown = False
            if bool(settings.sync_mysql_incremental_pushdown) and domain:
                try:
                    effective_sql, effective_params, used_pushdown = _build_mysql_incremental_query(
                        domain=domain,
                        base_sql=query_text,
                        watermark_updated_at=watermark_updated_at,
                        watermark_source_id=watermark_source_id,
                    )
                except Exception:
                    effective_sql = query_text
                    effective_params = tuple()
                    used_pushdown = False
            try:
                cursor.execute(effective_sql, effective_params)
            except Exception as e:
                if used_pushdown:
                    logger.warning(
                        '[sync:%s] fallback to base query (incremental pushdown not applicable at source)',
                        str(domain or 'unknown'),
                    )
                    cursor.execute(query_text)
                else:
                    raise
            batch_size = int(batch_size_override or 0) or _fetch_batch_size_for_domain(domain)
            batch_size = max(100, min(50000, batch_size))
            while True:
                batch = cursor.fetchmany(batch_size)
                if not batch:
                    break
                yield batch
            # Drain any trailing result sets to avoid "Unread result found".
            while cursor.nextset():
                while True:
                    trailing = cursor.fetchmany(batch_size)
                    if not trailing:
                        break
        finally:
            # Best effort: ensure connection has no pending results before close.
            try:
                conn.consume_results()
            except Exception:
                pass
            cursor.close()
    finally:
        conn.close()


def _delete_target_window(db: Session, domain: str, mode: str, year_from: int | None, target_months: set[str]) -> None:
    q = db.query(SyncRecord).filter(SyncRecord.domain == domain)
    # Priorizar meses detectados para evitar borrados masivos cuando
    # hay chunk-manifest y solo una parte del periodo cambio.
    if target_months:
        q = q.filter(SyncRecord.gestion_month.in_(target_months))
    elif mode == 'full_year' and year_from is not None:
        q = q.filter(func.substr(SyncRecord.gestion_month, 4, 4) == str(year_from))
    elif mode == 'full_all':
        pass
    q.delete(synchronize_session=False)
    db.commit()


def _adaptive_chunk_size(domain: str, configured: int) -> int:
    base = max(500, int(configured or 5000))
    default_chunk = max(500, int(getattr(settings, 'sync_chunk_size', 10000) or 10000))
    domain_key = str(domain or '').strip().lower()
    per_domain = {
        'analytics': int(getattr(settings, 'sync_chunk_size_analytics', 0) or 0),
        'cartera': int(getattr(settings, 'sync_chunk_size_cartera', 0) or 0),
        'cobranzas': int(getattr(settings, 'sync_chunk_size_cobranzas', 0) or 0),
        'contratos': int(getattr(settings, 'sync_chunk_size_contratos', 0) or 0),
        'gestores': int(getattr(settings, 'sync_chunk_size_gestores', 0) or 0),
    }
    tuned_defaults = {
        'cobranzas': 8000,
        'cartera': 7000,
        'analytics': 12000,
        'contratos': 12000,
        'gestores': 12000,
    }
    target = per_domain.get(domain_key, 0)
    if target <= 0:
        target = tuned_defaults.get(domain_key, default_chunk)
    resolved = max(500, min(30000, int((base + target) / 2)))
    if domain_key == 'cobranzas':
        return min(resolved, 8000)
    return resolved


def _fetch_batch_size_for_domain(domain: str) -> int:
    base = max(500, int(getattr(settings, 'sync_fetch_batch_size', 5000) or 5000))
    domain_key = str(domain or '').strip().lower()
    per_domain = {
        'analytics': int(getattr(settings, 'sync_fetch_batch_size_analytics', 0) or 0),
        'cartera': int(getattr(settings, 'sync_fetch_batch_size_cartera', 0) or 0),
        'cobranzas': int(getattr(settings, 'sync_fetch_batch_size_cobranzas', 0) or 0),
        'contratos': int(getattr(settings, 'sync_fetch_batch_size_contratos', 0) or 0),
        'gestores': int(getattr(settings, 'sync_fetch_batch_size_gestores', 0) or 0),
    }
    override = per_domain.get(domain_key, 0)
    if override > 0:
        resolved = max(100, min(50000, override))
        if domain_key == 'cobranzas':
            return min(resolved, 4000)
        return resolved
    tuned_defaults = {
        'analytics': 20000,
        'cartera': 10000,
        'cobranzas': 4000,
        'contratos': 20000,
        'gestores': 20000,
    }
    resolved = max(100, min(50000, int(tuned_defaults.get(domain_key, base))))
    if domain_key == 'cobranzas':
        return min(resolved, 4000)
    return resolved


def _is_low_impact_mode(mode: str) -> bool:
    if not bool(getattr(settings, 'sync_low_impact_mode', True)):
        return False
    full_all_only = bool(getattr(settings, 'sync_low_impact_full_all_only', True))
    if full_all_only and str(mode or '').strip().lower() != 'full_all':
        return False
    return True


def _low_impact_fetch_batch_size(base_size: int) -> int:
    tuned = int(getattr(settings, 'sync_low_impact_fetch_batch_size', 1000) or 1000)
    tuned = max(100, min(5000, tuned))
    return max(100, min(base_size, tuned))


def _low_impact_chunk_size(base_size: int) -> int:
    tuned = int(getattr(settings, 'sync_low_impact_chunk_size', 500) or 500)
    tuned = max(100, min(5000, tuned))
    return max(100, min(base_size, tuned))


def _low_impact_chunk_pause_seconds() -> float:
    pause_ms = int(getattr(settings, 'sync_low_impact_chunk_pause_ms', 40) or 40)
    pause_ms = max(0, min(2000, pause_ms))
    return float(pause_ms) / 1000.0


def _should_persist_sync_records(domain: str) -> bool:
    # sync_records is only used for cartera config lookups; skipping other domains
    # removes an extra heavyweight upsert path.
    return str(domain or '').strip().lower() == 'cartera'


def _should_persist_staging_rows() -> bool:
    return bool(getattr(settings, 'sync_persist_staging_rows', False))


def _max_rows_for_domain(domain: str) -> int | None:
    per_domain = {
        'analytics': int(settings.sync_max_rows_analytics or 0),
        'cartera': int(settings.sync_max_rows_cartera or 0),
        'cobranzas': int(settings.sync_max_rows_cobranzas or 0),
        'contratos': int(settings.sync_max_rows_contratos or 0),
        'gestores': int(settings.sync_max_rows_gestores or 0),
    }.get(domain, 0)
    if per_domain > 0:
        return per_domain
    global_cap = int(settings.sync_max_rows or 0)
    return global_cap if global_cap > 0 else None


def _domain_has_effective_limit(domain: str) -> bool:
    return _max_rows_for_domain(domain) is not None


def _estimated_duration_seconds(domain: str, estimated_rows: int) -> int | None:
    if estimated_rows <= 0:
        return 0
    db = SessionLocal()
    try:
        rows = (
            db.query(SyncRun.throughput_rows_per_sec)
            .filter(
                SyncRun.domain == domain,
                SyncRun.running.is_(False),
                SyncRun.error.is_(None),
                SyncRun.throughput_rows_per_sec.isnot(None),
                SyncRun.throughput_rows_per_sec > 0,
            )
            .order_by(SyncRun.finished_at.desc())
            .limit(20)
            .all()
        )
        values = [float(r[0]) for r in rows if r and r[0] is not None and float(r[0]) > 0]
        if not values:
            return None
        # Use a conservative percentile to avoid overly optimistic ETA.
        values.sort()
        idx = max(0, int(len(values) * 0.2) - 1)
        throughput = max(0.1, values[idx])
        return int(round(float(estimated_rows) / throughput))
    except Exception:
        logger.exception('Failed to estimate duration for domain=%s', domain)
        return None
    finally:
        db.close()


def _preview_risk_level(
    *,
    mode: str,
    would_exceed_limit: bool,
    estimate_confidence: str,
    has_effective_limit: bool,
) -> str:
    if would_exceed_limit:
        return 'high'
    if mode == 'full_all' and not has_effective_limit:
        return 'high'
    if estimate_confidence == 'low':
        return 'high'
    if estimate_confidence == 'medium':
        return 'medium'
    return 'low'


def _matches_mode(gestion_month: str, mode: str, year_from: int | None, close_month: str | None, range_months_set: set[str]) -> bool:
    if mode == 'full_month' and close_month:
        return gestion_month == close_month
    if mode == 'range_months' and range_months_set:
        return gestion_month in range_months_set
    if mode == 'full_year' and year_from is not None:
        return _year_of(gestion_month) == year_from
    return True


def _analyze_after_sync(db: Session, domain: str) -> None:
    targets = [FACT_TABLE_BY_DOMAIN[domain].__tablename__]
    if domain == 'cartera':
        targets.append(CarteraCorteAgg.__tablename__)
    for table_name in targets:
        db.execute(sa_text(f'ANALYZE {table_name}'))
    db.commit()


def _derive_chunk_key(rows: list[dict], fallback: str = '*') -> str:
    months = sorted({str(r.get('gestion_month') or '').strip() for r in rows if str(r.get('gestion_month') or '').strip()}, key=_month_serial)
    if not months:
        return fallback
    if len(months) == 1:
        return months[0]
    return f'{months[0]}..{months[-1]}'


def _persist_staging_rows(
    db: Session,
    job_id: str,
    domain: str,
    chunk_key: str,
    rows: list[dict],
    *,
    commit: bool = True,
) -> int:
    if not rows:
        return 0
    now = datetime.utcnow()
    mappings = []
    for row in rows:
        mappings.append(
            {
                'job_id': str(job_id),
                'domain': str(domain),
                'chunk_key': str(chunk_key or '*'),
                'contract_id': str(row.get('contract_id') or '')[:64],
                'gestion_month': str(row.get('gestion_month') or '')[:7],
                'source_hash': str(row.get('source_hash') or '')[:64],
                'payload_json': str(row.get('payload_json') or '{}'),
                'created_at': now,
            }
        )
    db.bulk_insert_mappings(SyncStagingRow, mappings)
    if commit:
        db.commit()
    return len(mappings)


def _cleanup_staging_rows(db: Session) -> int:
    retention_days = max(1, int(settings.sync_staging_retention_days or 14))
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    deleted = (
        db.query(SyncStagingRow)
        .filter(SyncStagingRow.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted or 0)


def _upsert_sync_records(db: Session, rows: list[dict], *, commit: bool = True) -> int:
    if not rows:
        return 0
    now = datetime.utcnow()
    # PostgreSQL raises CardinalityViolation when a single INSERT ... ON CONFLICT
    # contains duplicate keys for the same unique index. Collapse duplicates first.
    by_business_key: dict[tuple, dict] = {}
    for row in rows:
        key = (
            row['domain'],
            row['contract_id'],
            row['gestion_month'],
            row['supervisor'],
            row['un'],
            row['via'],
            row['tramo'],
        )
        by_business_key[key] = {
            'domain': row['domain'],
            'contract_id': row['contract_id'],
            'gestion_month': row['gestion_month'],
            'supervisor': row['supervisor'],
            'un': row['un'],
            'via': row['via'],
            'tramo': row['tramo'],
            'payload_json': row['payload_json'],
            'source_hash': row['source_hash'],
            'created_at': now,
            'updated_at': now,
        }
    values = list(by_business_key.values())
    table = SyncRecord.__table__
    dialect = engine.dialect.name
    index_cols = [
        table.c.domain,
        table.c.contract_id,
        table.c.gestion_month,
        table.c.supervisor,
        table.c.un,
        table.c.via,
        table.c.tramo,
    ]
    if dialect == 'postgresql':
        # En tablas particionadas por expresión puede no existir un unique/exclusion
        # compatible para ON CONFLICT. En ese caso, hacer fallback a delete+insert.
        has_upsert_constraint = bool(
            db.execute(
                sa_text(
                    """
                    SELECT 1
                    FROM pg_index i
                    JOIN pg_class t ON t.oid = i.indrelid
                    WHERE t.relname = 'sync_records'
                      AND i.indisunique = true
                    LIMIT 1
                    """
                )
            ).scalar()
        )
        if has_upsert_constraint:
            insert_stmt = pg_insert(table).values(values)
            stmt = insert_stmt.on_conflict_do_update(
                index_elements=index_cols,
                set_={
                    'payload_json': insert_stmt.excluded.payload_json,
                    'source_hash': insert_stmt.excluded.source_hash,
                    'updated_at': now,
                },
            )
            db.execute(stmt)
        else:
            keys = list(by_business_key.keys())
            for chunk in _iter_chunks(keys, size=1200):
                db.query(SyncRecord).filter(
                    sa_tuple(
                        SyncRecord.domain,
                        SyncRecord.contract_id,
                        SyncRecord.gestion_month,
                        SyncRecord.supervisor,
                        SyncRecord.un,
                        SyncRecord.via,
                        SyncRecord.tramo,
                    ).in_(chunk)
                ).delete(synchronize_session=False)
            db.bulk_insert_mappings(SyncRecord, values)
    else:
        insert_stmt = sqlite_insert(table).values(values)
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_cols,
            set_={
                'payload_json': insert_stmt.excluded.payload_json,
                'source_hash': insert_stmt.excluded.source_hash,
                'updated_at': now,
            },
        )
        db.execute(stmt)
    if commit:
        db.commit()
    return len(values)


def _ensure_cartera_partitions(db: Session, months: set[str]) -> None:
    if engine.dialect.name != 'postgresql' or not months:
        return
    partitioned = db.execute(
        sa_text(
            """
            SELECT 1
            FROM pg_partitioned_table p
            JOIN pg_class c ON c.oid = p.partrelid
            WHERE c.relname = 'cartera_fact'
            LIMIT 1
            """
        )
    ).scalar()
    if not partitioned:
        # Compat mode: if cartera_fact exists as regular table, skip partition DDL.
        return
    years = {int(str(mm).split('/')[1]) for mm in months if _month_serial(str(mm)) > 0}
    for year in sorted(years):
        # Parent table is RANGE-partitioned by month serial:
        # serial = (year * 12) + month
        # Existing convention in DB is yearly partitions (cartera_fact_part_YYYY).
        part_name = f'cartera_fact_part_{year}'
        start_serial = (year * 12) + 1       # Jan
        end_serial = ((year + 1) * 12) + 1   # Jan next year
        db.execute(
            sa_text(
                f"""
                CREATE TABLE IF NOT EXISTS {part_name}
                PARTITION OF cartera_fact
                FOR VALUES FROM ({start_serial}) TO ({end_serial})
                """
            )
        )
    db.commit()


def _delete_target_window_fact(
    db: Session,
    domain: str,
    mode: str,
    year_from: int | None,
    close_month: str | None,
    target_months: set[str],
) -> None:
    model = FACT_TABLE_BY_DOMAIN[domain]
    q = db.query(model)
    if domain == 'cartera':
        if target_months:
            q = q.filter(CarteraFact.gestion_month.in_(target_months))
        elif mode == 'full_month' and close_month:
            q = q.filter(CarteraFact.close_month == close_month)
        elif mode == 'full_year' and year_from is not None:
            q = q.filter(CarteraFact.close_year == int(year_from))
        elif mode == 'full_all':
            pass
    elif domain == 'cobranzas':
        if target_months:
            q = q.filter(CobranzasFact.payment_month.in_(target_months))
        elif mode == 'full_year' and year_from is not None:
            q = q.filter(CobranzasFact.payment_year == int(year_from))
        elif mode == 'full_all':
            pass
    else:
        if target_months:
            q = q.filter(model.gestion_month.in_(target_months))
        elif mode == 'full_year' and year_from is not None:
            q = q.filter(func.substr(model.gestion_month, 4, 4) == str(year_from))
        elif mode == 'full_all':
            pass
    q.delete(synchronize_session=False)
    db.commit()


def _fact_business_key_tuple(record: dict, domain: str) -> tuple:
    """Build a comparable tuple for fact table business key (for pre-filter lookup)."""
    if domain == 'cartera':
        return (
            str(record.get('contract_id') or ''),
            str(record.get('close_date') or '')[:10] if record.get('close_date') else '',
            str(record.get('gestion_month') or ''),
        )
    if domain == 'cobranzas':
        source_row_id = str(record.get('source_row_id') or '').strip()
        if source_row_id:
            return (source_row_id,)
        return (
            str(record.get('contract_id') or ''),
            str(record.get('payment_date') or '')[:10] if record.get('payment_date') else '',
            _to_float(record.get('payment_amount')),
            str(record.get('payment_via_class') or ''),
        )
    return (
        str(record.get('contract_id') or ''),
        str(record.get('gestion_month') or ''),
        str(record.get('supervisor') or ''),
        str(record.get('un') or ''),
        str(record.get('via') or ''),
        int(record.get('tramo') or 0),
    )


def _filter_rows_changed_vs_postgres(db: Session, domain: str, rows: list[dict]) -> list[dict]:
    """Return only rows that are new or have different source_hash than current Postgres. On error return all rows."""
    if not rows:
        return []
    try:
        model = FACT_TABLE_BY_DOMAIN[domain]
        table = model.__table__
        if domain == 'cartera':
            key_cols = ['contract_id', 'close_date', 'gestion_month']
        elif domain == 'cobranzas':
            key_cols = ['source_row_id']
        else:
            key_cols = ['contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo']
        incoming: dict[tuple, str] = {}
        row_by_key: dict[tuple, dict] = {}
        for n in rows:
            rec = _fact_row_from_normalized(domain, n)
            key = _fact_business_key_tuple(rec, domain)
            incoming[key] = str(rec.get('source_hash') or '')
            row_by_key[key] = n
        keys_list = list(incoming.keys())
        if not keys_list:
            return rows
        existing: dict[tuple, str] = {}
        chunk_size = 400
        key_columns = [getattr(table.c, k) for k in key_cols]
        for i in range(0, len(keys_list), chunk_size):
            chunk = keys_list[i : i + chunk_size]
            stmt = select(*key_columns, table.c.source_hash).where(
                sa_tuple(*key_columns).in_(chunk)
            )
            for row in db.execute(stmt):
                key = _fact_business_key_tuple(dict(zip(key_cols, row[:-1])), domain)
                existing[key] = str(row[-1] or '')
        out = [
            row_by_key[key]
            for key in keys_list
            if key not in existing or existing[key] != incoming.get(key, '')
        ]
        return out
    except Exception:
        logger.exception('[sync:%s] postgres prefilter failed, using all rows', domain)
        return rows


def _upsert_fact_rows(db: Session, domain: str, rows: list[dict], *, commit: bool = True) -> tuple[int, int]:
    if not rows:
        return 0, 0
    model = FACT_TABLE_BY_DOMAIN[domain]
    table = model.__table__
    now = datetime.utcnow()
    values = []
    for n in rows:
        record = _fact_row_from_normalized(domain, n)
        record['loaded_at'] = now
        record['updated_at'] = now
        values.append(record)

    if domain == 'cartera':
        index_cols = [table.c.contract_id, table.c.close_date, table.c.gestion_month]
        index_col_names = ['contract_id', 'close_date', 'gestion_month']
    elif domain == 'cobranzas':
        index_cols = [table.c.source_row_id]
        index_col_names = ['source_row_id']
    else:
        index_cols = [table.c.contract_id, table.c.gestion_month, table.c.supervisor, table.c.un, table.c.via, table.c.tramo]
        index_col_names = ['contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo']

    if engine.dialect.name == 'postgresql':
        insert_stmt = pg_insert(table).values(values)
    else:
        insert_stmt = sqlite_insert(table).values(values)
    excluded = insert_stmt.excluded
    if domain == 'cartera':
        set_map = {
            'close_month': excluded.close_month,
            'close_year': excluded.close_year,
            'gestion_month': excluded.gestion_month,
            'supervisor': excluded.supervisor,
            'un': excluded.un,
            'via_cobro': excluded.via_cobro,
            'tramo': excluded.tramo,
            'category': excluded.category,
            'contracts_total': excluded.contracts_total,
            'monto_vencido': excluded.monto_vencido,
            'total_saldo': excluded.total_saldo,
            'capital_saldo': excluded.capital_saldo,
            'capital_vencido': excluded.capital_vencido,
            'source_hash': excluded.source_hash,
            'payload_json': excluded.payload_json,
            'updated_at': now,
        }
    else:
        set_map = {
            'source_hash': excluded.source_hash,
            'payload_json': excluded.payload_json,
            'updated_at': now,
        }
        if domain == 'analytics':
            set_map.update(
                {
                    'contracts_total': excluded.contracts_total,
                    'debt_total': excluded.debt_total,
                    'paid_total': excluded.paid_total,
                }
            )
        elif domain == 'cobranzas':
            set_map.update(
                {
                    'gestion_month': excluded.gestion_month,
                    'supervisor': excluded.supervisor,
                    'un': excluded.un,
                    'via': excluded.via,
                    'tramo': excluded.tramo,
                    'payment_month': excluded.payment_month,
                    'payment_year': excluded.payment_year,
                    'payment_date': excluded.payment_date,
                }
            )
    use_on_conflict = True
    # Solución definitiva para cartera: en despliegues con particionado por expresión,
    # ON CONFLICT puede no ser compatible de forma estable.
    # Forzamos estrategia determinística delete+insert para evitar fallos operativos.
    if domain == 'cartera':
        use_on_conflict = False
    if engine.dialect.name == 'postgresql':
        # En tablas particionadas o migradas puede existir índice único, pero no
        # compatible con exactamente las columnas del ON CONFLICT objetivo.
        if use_on_conflict:
            target_cols = ','.join(index_col_names)
            has_matching_unique = bool(
                db.execute(
                    sa_text(
                        """
                        SELECT 1
                        FROM pg_index i
                        JOIN pg_class t ON t.oid = i.indrelid
                        WHERE t.relname = :table_name
                          AND i.indisunique = true
                          AND COALESCE(
                            (
                              SELECT string_agg(a.attname, ',' ORDER BY u.ord)
                              FROM unnest(i.indkey) WITH ORDINALITY AS u(attnum, ord)
                              LEFT JOIN pg_attribute a
                                ON a.attrelid = t.oid
                               AND a.attnum = u.attnum
                              WHERE u.attnum > 0
                            ),
                            ''
                          ) = :target_cols
                        LIMIT 1
                        """
                    ),
                    {'table_name': table.name, 'target_cols': target_cols},
                ).scalar()
            )
            use_on_conflict = has_matching_unique

    if use_on_conflict:
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_cols,
            set_=set_map,
            where=table.c.source_hash != excluded.source_hash,
        )
        try:
            # Savepoint para que un ON CONFLICT inválido no rompa la transacción externa.
            with db.begin_nested():
                result = db.execute(stmt)
            changed = int(result.rowcount or 0)
            unchanged = max(0, len(values) - changed)
        except Exception as exc:
            msg = str(exc).lower()
            if engine.dialect.name == 'postgresql' and (
                'no unique or exclusion constraint matching the on conflict specification' in msg
                or 'invalidcolumnreference' in msg
            ):
                logger.warning(
                    '[sync:%s] ON CONFLICT incompatible for %s; using delete+insert fallback',
                    domain,
                    table.name,
                )
                use_on_conflict = False
            else:
                raise

    if not use_on_conflict:
        # Fallback seguro cuando ON CONFLICT no es viable por restricción ausente/no compatible.
        if domain == 'cartera':
            keys = [
                (
                    str(v.get('contract_id') or ''),
                    v.get('close_date'),
                    str(v.get('gestion_month') or ''),
                )
                for v in values
            ]
            for chunk in _iter_chunks(keys, size=1200):
                db.query(CarteraFact).filter(
                    sa_tuple(CarteraFact.contract_id, CarteraFact.close_date, CarteraFact.gestion_month).in_(chunk)
                ).delete(synchronize_session=False)
        elif domain == 'cobranzas':
            keys = [str(v.get('source_row_id') or '').strip() for v in values if str(v.get('source_row_id') or '').strip()]
            if keys:
                for chunk in _iter_chunks(keys, size=3000):
                    db.query(CobranzasFact).filter(CobranzasFact.source_row_id.in_(chunk)).delete(synchronize_session=False)
        else:
            keys = [
                (
                    str(v.get('contract_id') or ''),
                    str(v.get('gestion_month') or ''),
                    str(v.get('supervisor') or ''),
                    str(v.get('un') or ''),
                    str(v.get('via') or ''),
                    int(v.get('tramo') or 0),
                )
                for v in values
            ]
            model_cls = FACT_TABLE_BY_DOMAIN[domain]
            for chunk in _iter_chunks(keys, size=900):
                db.query(model_cls).filter(
                    sa_tuple(
                        model_cls.contract_id,
                        model_cls.gestion_month,
                        model_cls.supervisor,
                        model_cls.un,
                        model_cls.via,
                        model_cls.tramo,
                    ).in_(chunk)
                ).delete(synchronize_session=False)
        db.bulk_insert_mappings(model, values)
        changed = len(values)
        unchanged = 0

    if commit:
        db.commit()
    return changed, unchanged


def _to_float(value: object) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _to_int(value: object, default: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return default


def _month_from_any(value: object) -> str:
    text = str(value or '').strip()
    if not text:
        return ''
    if len(text) == 7 and text[2] == '/':
        return text
    if len(text) >= 7 and text[4] in {'-', '/'}:
        y = text[0:4]
        m = text[5:7]
        if y.isdigit() and m.isdigit():
            return f'{int(m):02d}/{y}'
    if len(text) == 10 and text[2] == '/' and text[5] == '/':
        dd, mm, yyyy = text[0:2], text[3:5], text[6:10]
        if mm.isdigit() and yyyy.isdigit():
            return f'{int(mm):02d}/{yyyy}'
    return ''


def _year_from_month(mm_yyyy: str) -> int:
    parts = str(mm_yyyy or '').split('/')
    if len(parts) != 2 or not parts[1].isdigit():
        return 0
    return int(parts[1])


def _effective_cartera_month_by_cutoff(db: Session, cutoff_months: list[str]) -> dict[str, str]:
    """Resolve, for each cutoff month, the latest cartera month <= cutoff."""
    valid_cutoffs = sorted(
        {str(m).strip() for m in (cutoff_months or []) if _month_serial(str(m).strip()) > 0},
        key=_month_serial,
    )
    if not valid_cutoffs:
        return {}

    cartera_months = sorted(
        {
            str(v[0] or '').strip()
            for v in db.query(CarteraFact.gestion_month).distinct().all()
            if _month_serial(str(v[0] or '').strip()) > 0
        },
        key=_month_serial,
    )
    if not cartera_months:
        return {}

    mapping: dict[str, str] = {}
    idx = 0
    current_effective = ''
    cartera_with_serial = [(m, _month_serial(m)) for m in cartera_months]
    for cutoff in valid_cutoffs:
        cutoff_serial = _month_serial(cutoff)
        while idx < len(cartera_with_serial) and cartera_with_serial[idx][1] <= cutoff_serial:
            current_effective = cartera_with_serial[idx][0]
            idx += 1
        if current_effective:
            mapping[cutoff] = current_effective
    return mapping


def _build_cartera_categoria_expr(db: Session):
    _ = db
    # Regla de negocio AGENTS: VIGENTE=tramo 0..3, MOROSO=tramo > 3.
    return case((CarteraFact.tramo > 3, literal('MOROSO')), else_=literal('VIGENTE'))


def _build_cartera_contract_year_expr():
    if engine.dialect.name == 'postgresql':
        contract_month = func.coalesce(CarteraFact.contract_month, '')
        return case(
            (contract_month.op('~')(r'^\d{2}/\d{4}$'), cast(func.substring(contract_month, 4, 4), Integer)),
            else_=CarteraFact.close_year,
        )
    return CarteraFact.close_year


def _refresh_cartera_corte_agg(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=_month_serial)
    if not months:
        return 0, 0

    deleted = db.query(CarteraCorteAgg).filter(CarteraCorteAgg.gestion_month.in_(months)).delete(synchronize_session=False)
    db.commit()

    categoria_expr = _build_cartera_categoria_expr(db)
    contract_year_expr = _build_cartera_contract_year_expr()
    monto_cuota_expr = cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric)
    via_cartera_class_expr = case(
        (func.upper(func.coalesce(CarteraFact.via_cobro, '')) == literal('COBRADOR'), literal('COBRADOR')),
        else_=literal('DEBITO'),
    )
    supervisor_sq = (
        db.query(
            AnalyticsFact.contract_id.label('contract_id'),
            AnalyticsFact.gestion_month.label('gestion_month'),
            func.max(
                case(
                    (func.upper(func.coalesce(AnalyticsFact.supervisor, '')) != 'S/D', AnalyticsFact.supervisor),
                    else_=literal(''),
                )
            ).label('supervisor'),
        )
        .filter(AnalyticsFact.gestion_month.in_(months))
        .group_by(AnalyticsFact.contract_id, AnalyticsFact.gestion_month)
        .subquery()
    )
    supervisor_expr = case(
        (func.upper(func.coalesce(CarteraFact.supervisor, '')) != 'S/D', CarteraFact.supervisor),
        (func.coalesce(supervisor_sq.c.supervisor, '') != '', supervisor_sq.c.supervisor),
        else_=literal('S/D'),
    )

    paid_sq = (
        db.query(
            CobranzasFact.contract_id.label('contract_id'),
            CobranzasFact.payment_month.label('payment_month'),
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label('paid_total'),
            func.coalesce(
                func.sum(
                    case(
                        (CobranzasFact.payment_via_class == 'COBRADOR', CobranzasFact.payment_amount),
                        else_=literal(0.0),
                    )
                ),
                0.0,
            ).label('paid_via_cobrador'),
            func.coalesce(
                func.sum(
                    case(
                        (CobranzasFact.payment_via_class == 'DEBITO', CobranzasFact.payment_amount),
                        else_=literal(0.0),
                    )
                ),
                0.0,
            ).label('paid_via_debito'),
            func.max(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))).label('contracts_paid_total'),
            func.max(
                case(
                    (and_(CobranzasFact.payment_via_class == 'COBRADOR', CobranzasFact.payment_amount > 0), literal(1)),
                    else_=literal(0),
                )
            ).label('contracts_paid_via_cobrador'),
            func.max(
                case(
                    (and_(CobranzasFact.payment_via_class == 'DEBITO', CobranzasFact.payment_amount > 0), literal(1)),
                    else_=literal(0),
                )
            ).label('contracts_paid_via_debito'),
        )
        .filter(CobranzasFact.payment_month.in_(months))
        .group_by(CobranzasFact.contract_id, CobranzasFact.payment_month)
        .subquery()
    )

    grouped_rows = (
        db.query(
            CarteraFact.gestion_month.label('gestion_month'),
            CarteraFact.close_month.label('close_month'),
            CarteraFact.close_year.label('close_year'),
            contract_year_expr.label('contract_year'),
            CarteraFact.un.label('un'),
            supervisor_expr.label('supervisor'),
            via_cartera_class_expr.label('via_cobro'),
            categoria_expr.label('categoria'),
            CarteraFact.tramo.label('tramo'),
            func.coalesce(func.sum(CarteraFact.contracts_total), 0).label('contracts_total'),
            func.coalesce(
                func.sum(case((categoria_expr == 'VIGENTE', CarteraFact.contracts_total), else_=literal(0))),
                0,
            ).label('vigentes_total'),
            func.coalesce(
                func.sum(case((categoria_expr == 'MOROSO', CarteraFact.contracts_total), else_=literal(0))),
                0,
            ).label('morosos_total'),
            func.coalesce(func.sum(monto_cuota_expr + CarteraFact.monto_vencido), 0.0).label('monto_total'),
            func.coalesce(func.sum(CarteraFact.monto_vencido), 0.0).label('monto_vencido_total'),
            func.coalesce(
                func.sum(case((via_cartera_class_expr == 'COBRADOR', CarteraFact.contracts_total), else_=literal(0))),
                0,
            ).label('contracts_cobrador'),
            func.coalesce(
                func.sum(case((via_cartera_class_expr == 'DEBITO', CarteraFact.contracts_total), else_=literal(0))),
                0,
            ).label('contracts_debito'),
            func.coalesce(func.sum(paid_sq.c.paid_total), 0.0).label('paid_total'),
            func.coalesce(func.sum(paid_sq.c.paid_via_cobrador), 0.0).label('paid_via_cobrador'),
            func.coalesce(func.sum(paid_sq.c.paid_via_debito), 0.0).label('paid_via_debito'),
            func.coalesce(func.sum(paid_sq.c.contracts_paid_total), 0).label('contracts_paid_total'),
            func.coalesce(func.sum(paid_sq.c.contracts_paid_via_cobrador), 0).label('contracts_paid_via_cobrador'),
            func.coalesce(func.sum(paid_sq.c.contracts_paid_via_debito), 0).label('contracts_paid_via_debito'),
        )
        .outerjoin(
            paid_sq,
            and_(
                paid_sq.c.contract_id == CarteraFact.contract_id,
                paid_sq.c.payment_month == CarteraFact.gestion_month,
            ),
        )
        .outerjoin(
            supervisor_sq,
            and_(
                supervisor_sq.c.contract_id == CarteraFact.contract_id,
                supervisor_sq.c.gestion_month == CarteraFact.gestion_month,
            ),
        )
        .filter(CarteraFact.gestion_month.in_(months))
        .group_by(
            CarteraFact.gestion_month,
            CarteraFact.close_month,
            CarteraFact.close_year,
            contract_year_expr,
            CarteraFact.un,
            supervisor_expr,
            via_cartera_class_expr,
            categoria_expr,
            CarteraFact.tramo,
        )
        .all()
    )

    now = datetime.utcnow()
    mappings: list[dict] = []
    for row in grouped_rows:
        mappings.append(
            {
                'gestion_month': str(row.gestion_month),
                'close_month': str(row.close_month),
                'close_year': int(row.close_year or 0),
                'contract_year': int(row.contract_year) if row.contract_year is not None else 0,
                'un': str(row.un or 'S/D'),
                'supervisor': str(row.supervisor or 'S/D'),
                'via_cobro': str(row.via_cobro or 'S/D'),
                'categoria': str(row.categoria or 'VIGENTE'),
                'tramo': int(row.tramo or 0),
                'contracts_total': int(row.contracts_total or 0),
                'vigentes_total': int(row.vigentes_total or 0),
                'morosos_total': int(row.morosos_total or 0),
                'monto_total': float(row.monto_total or 0.0),
                'monto_vencido_total': float(row.monto_vencido_total or 0.0),
                'contracts_cobrador': int(row.contracts_cobrador or 0),
                'contracts_debito': int(row.contracts_debito or 0),
                'paid_total': float(row.paid_total or 0.0),
                'paid_via_cobrador': float(row.paid_via_cobrador or 0.0),
                'paid_via_debito': float(row.paid_via_debito or 0.0),
                'contracts_paid_total': int(row.contracts_paid_total or 0),
                'contracts_paid_via_cobrador': int(row.contracts_paid_via_cobrador or 0),
                'contracts_paid_via_debito': int(row.contracts_paid_via_debito or 0),
                'updated_at': now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(CarteraCorteAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_cobranzas_cohorte_agg(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted(
        {str(m).strip() for m in (affected_months or set()) if _month_serial(str(m).strip()) > 0},
        key=_month_serial,
    )
    if not months:
        return 0, 0

    effective_by_cutoff = _effective_cartera_month_by_cutoff(db, months)
    valid_cutoffs = sorted(effective_by_cutoff.keys(), key=_month_serial)
    if not valid_cutoffs:
        return 0, 0

    deleted = (
        db.query(CobranzasCohorteAgg)
        .filter(CobranzasCohorteAgg.cutoff_month.in_(valid_cutoffs))
        .delete(synchronize_session=False)
    )
    db.commit()

    categoria_expr = _build_cartera_categoria_expr(db)
    via_expr = case(
        (func.upper(func.coalesce(CarteraFact.via_cobro, '')) == literal('COBRADOR'), literal('COBRADOR')),
        else_=literal('DEBITO'),
    )
    monto_cuota_expr = cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric)

    payments_sq = (
        db.query(
            CobranzasFact.payment_month.label('cutoff_month'),
            CobranzasFact.contract_id.label('contract_id'),
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label('cobrado'),
            func.coalesce(
                func.sum(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))),
                0,
            ).label('transacciones'),
        )
        .filter(CobranzasFact.payment_month.in_(valid_cutoffs))
        .group_by(CobranzasFact.payment_month, CobranzasFact.contract_id)
        .subquery()
    )

    if engine.dialect.name == 'postgresql':
        payload_jsonb = cast(CarteraFact.payload_json, JSONB)
        fecha_contrato_raw = func.coalesce(payload_jsonb.op('->>')('fecha_contrato'), literal(''))
        fecha_iso_norm = func.replace(fecha_contrato_raw, '/', '-')
        sale_month_from_payload = case(
            (
                fecha_iso_norm.op('~')(r'^\d{4}-\d{1,2}-\d{1,2}$'),
                func.concat(
                    func.lpad(func.split_part(fecha_iso_norm, '-', 2), 2, '0'),
                    literal('/'),
                    func.split_part(fecha_iso_norm, '-', 1),
                ),
            ),
            (
                fecha_contrato_raw.op('~')(r'^\d{1,2}/\d{1,2}/\d{4}$'),
                func.concat(
                    func.lpad(func.split_part(fecha_contrato_raw, '/', 2), 2, '0'),
                    literal('/'),
                    func.split_part(fecha_contrato_raw, '/', 3),
                ),
            ),
            else_=literal(''),
        )
        sale_month_expr = func.coalesce(func.nullif(CarteraFact.contract_month, ''), sale_month_from_payload, literal(''))
    else:
        sale_month_expr = func.coalesce(CarteraFact.contract_month, literal(''))

    now = datetime.utcnow()
    mappings: list[dict] = []
    for cutoff_month in valid_cutoffs:
        effective_month = str(effective_by_cutoff.get(cutoff_month) or '').strip()
        if _month_serial(effective_month) <= 0:
            continue
        grouped_rows = (
            db.query(
                literal(cutoff_month).label('cutoff_month'),
                sale_month_expr.label('sale_month'),
                func.upper(func.coalesce(CarteraFact.un, 'S/D')).label('un'),
                func.upper(func.coalesce(CarteraFact.supervisor, 'S/D')).label('supervisor'),
                via_expr.label('via'),
                categoria_expr.label('categoria'),
                func.count().label('activos'),
                func.coalesce(
                    func.sum(case((func.coalesce(payments_sq.c.cobrado, 0.0) > 0, literal(1)), else_=literal(0))),
                    0,
                ).label('pagaron'),
                func.coalesce(func.sum(monto_cuota_expr + CarteraFact.monto_vencido), 0.0).label('deberia'),
                func.coalesce(func.sum(func.coalesce(payments_sq.c.cobrado, 0.0)), 0.0).label('cobrado'),
                func.coalesce(func.sum(func.coalesce(payments_sq.c.transacciones, 0)), 0).label('transacciones'),
            )
            .outerjoin(
                payments_sq,
                and_(
                    payments_sq.c.contract_id == CarteraFact.contract_id,
                    payments_sq.c.cutoff_month == literal(cutoff_month),
                ),
            )
            .filter(CarteraFact.gestion_month == effective_month)
            .group_by(
                sale_month_expr,
                func.upper(func.coalesce(CarteraFact.un, 'S/D')),
                func.upper(func.coalesce(CarteraFact.supervisor, 'S/D')),
                via_expr,
                categoria_expr,
            )
            .all()
        )
        cutoff_serial = _month_serial(cutoff_month)
        for row in grouped_rows:
            sale_month = str(row.sale_month or '').strip()
            sale_serial = _month_serial(sale_month)
            if sale_serial <= 0 or sale_serial > cutoff_serial:
                continue
            mappings.append(
                {
                    'cutoff_month': cutoff_month,
                    'sale_month': sale_month,
                    'sale_year': _year_from_month(sale_month),
                    'un': str(row.un or 'S/D').strip().upper(),
                    'supervisor': str(row.supervisor or 'S/D').strip().upper(),
                    'via_cobro': str(row.via or 'DEBITO').strip().upper(),
                    'categoria': str(row.categoria or 'VIGENTE').strip().upper(),
                    'activos': int(row.activos or 0),
                    'pagaron': int(row.pagaron or 0),
                    'deberia': float(row.deberia or 0.0),
                    'cobrado': float(row.cobrado or 0.0),
                    'transacciones': int(row.transacciones or 0),
                    'updated_at': now,
                }
            )
    if mappings:
        db.bulk_insert_mappings(CobranzasCohorteAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _load_un_canonical_map(db: Session) -> dict[str, str]:
    out: dict[str, str] = {}
    rows = (
        db.query(
            DimNegocioUnMap.source_un,
            DimNegocioUnMap.canonical_un,
            DimNegocioUnMap.active_from,
            DimNegocioUnMap.updated_at,
            DimNegocioUnMap.mapping_version,
        )
        .filter(DimNegocioUnMap.is_active.is_(True))
        .order_by(
            DimNegocioUnMap.source_un.asc(),
            DimNegocioUnMap.active_from.desc(),
            DimNegocioUnMap.updated_at.desc(),
            DimNegocioUnMap.mapping_version.desc(),
        )
        .all()
    )
    for src, dst, *_ in rows:
        s = str(src or '').strip().upper()
        d = str(dst or '').strip().upper()
        if s and d and s not in out:
            out[s] = d
    return out


def _seed_default_un_mappings(db: Session) -> None:
    now = datetime.utcnow()
    defaults = [
        {
            'source_un': 'ODONTOLOGIA',
            'canonical_un': 'ODONTOLOGIA',
            'mapping_version': 'v1',
            'is_active': True,
            'active_from': now,
            'active_to': None,
            'updated_at': now,
        },
        {
            'source_un': 'ODONTOLOGIA TTO',
            'canonical_un': 'ODONTOLOGIA TTO',
            'mapping_version': 'v1',
            'is_active': True,
            'active_from': now,
            'active_to': None,
            'updated_at': now,
        },
    ]
    table = DimNegocioUnMap.__table__
    if engine.dialect.name == 'postgresql':
        stmt = pg_insert(table).values(defaults)
        stmt = stmt.on_conflict_do_update(
            index_elements=[table.c.source_un, table.c.mapping_version],
            set_={
                'canonical_un': stmt.excluded.canonical_un,
                'is_active': True,
                'active_to': None,
                'updated_at': now,
            },
        )
    else:
        stmt = sqlite_insert(table).values(defaults)
        stmt = stmt.on_conflict_do_update(
            index_elements=['source_un', 'mapping_version'],
            set_={
                'canonical_un': stmt.excluded.canonical_un,
                'is_active': True,
                'active_to': None,
                'updated_at': now,
            },
        )
    db.execute(stmt)
    db.flush()


def _canonical_un(un_map: dict[str, str], value: object) -> str:
    raw = str(value or 'S/D').strip().upper() or 'S/D'
    return str(un_map.get(raw) or raw)


def _canonical_via(value: object) -> str:
    raw = str(value or '').strip().upper()
    if raw == 'COBRADOR' or 'COBR' in raw:
        return 'COBRADOR'
    return 'DEBITO'


def _refresh_dim_negocio_contrato(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=_month_serial)
    if not months:
        return 0, 0

    deleted = db.query(DimNegocioContrato).filter(DimNegocioContrato.gestion_month.in_(months)).delete(synchronize_session=False)
    db.commit()

    _seed_default_un_mappings(db)
    un_map = _load_un_canonical_map(db)
    supervisor_rows = (
        db.query(
            AnalyticsFact.contract_id.label('contract_id'),
            AnalyticsFact.gestion_month.label('gestion_month'),
            func.max(
                case(
                    (func.upper(func.coalesce(AnalyticsFact.supervisor, '')) != 'S/D', AnalyticsFact.supervisor),
                    else_=literal(''),
                )
            ).label('supervisor'),
        )
        .filter(AnalyticsFact.gestion_month.in_(months))
        .group_by(AnalyticsFact.contract_id, AnalyticsFact.gestion_month)
        .all()
    )
    supervisor_map: dict[tuple[str, str], str] = {}
    for row in supervisor_rows:
        key = (str(row.contract_id or '').strip(), str(row.gestion_month or '').strip())
        sup = str(row.supervisor or '').strip().upper()
        if key[0] and key[1] and sup:
            supervisor_map[key] = sup

    rows = (
        db.query(
            CarteraFact.contract_id,
            CarteraFact.gestion_month,
            func.max(CarteraFact.un).label('un_raw'),
            func.max(CarteraFact.supervisor).label('supervisor_raw'),
            func.max(CarteraFact.via_cobro).label('via_raw'),
            func.max(CarteraFact.tramo).label('tramo'),
            func.max(CarteraFact.contract_month).label('contract_month'),
        )
        .filter(CarteraFact.gestion_month.in_(months))
        .group_by(CarteraFact.contract_id, CarteraFact.gestion_month)
        .all()
    )
    now = datetime.utcnow()
    mappings: list[dict] = []
    for row in rows:
        contract_id = str(row.contract_id or '').strip()
        gestion_month = str(row.gestion_month or '').strip()
        if not contract_id or not gestion_month:
            continue
        tramo = int(row.tramo or 0)
        supervisor_raw = str(row.supervisor_raw or 'S/D').strip().upper() or 'S/D'
        supervisor_canon = supervisor_raw
        if supervisor_canon == 'S/D':
            supervisor_canon = str(supervisor_map.get((contract_id, gestion_month)) or 'S/D')
        via_canon = _canonical_via(row.via_raw)
        categoria = 'MOROSO' if tramo > 3 else 'VIGENTE'
        sale_month = _month_from_any(row.contract_month)
        sale_year = _year_of(sale_month)
        mappings.append(
            {
                'contract_id': contract_id,
                'gestion_month': gestion_month,
                'sale_month': sale_month,
                'sale_year': int(sale_year or 0),
                'un_raw': str(row.un_raw or 'S/D').strip().upper() or 'S/D',
                'supervisor_raw': supervisor_raw,
                'via_raw': str(row.via_raw or 'S/D').strip().upper() or 'S/D',
                'tramo': tramo,
                'categoria': categoria,
                'un_canonica': _canonical_un(un_map, row.un_raw),
                'supervisor_canonico': supervisor_canon,
                'via_canonica': via_canon,
                'categoria_canonica': categoria,
                'mapping_version': 'v1',
                'updated_at': now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(DimNegocioContrato, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_analytics_rendimiento_agg(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=_month_serial)
    if not months:
        return 0, 0

    deleted = (
        db.query(AnalyticsRendimientoAgg)
        .filter(AnalyticsRendimientoAgg.gestion_month.in_(months))
        .delete(synchronize_session=False)
    )
    db.commit()

    # Deuda asignada de rendimiento: monto_vencido + monto_cuota.
    # Si cuota_amount vino en 0/null, usar fallback desde payload_json->monto_cuota.
    if db.bind is not None and db.bind.dialect.name == 'postgresql':
        cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
        cuota_fallback_expr = case(
            (cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(cuota_text, Numeric)),
            else_=literal(0),
        )
    else:
        cuota_fallback_expr = literal(0)
    cuota_effective_expr = case(
        (cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric) > 0, cast(func.coalesce(CarteraFact.cuota_amount, 0.0), Numeric)),
        else_=cuota_fallback_expr,
    )
    debt_expr = cast(func.coalesce(CarteraFact.monto_vencido, 0.0), Numeric) + cuota_effective_expr

    debt_rows = (
        db.query(
            CarteraFact.contract_id,
            CarteraFact.gestion_month,
            func.coalesce(func.sum(debt_expr), 0.0).label('debt'),
        )
        .filter(CarteraFact.gestion_month.in_(months))
        .group_by(CarteraFact.contract_id, CarteraFact.gestion_month)
        .all()
    )
    debt_map: dict[tuple[str, str], float] = {}
    for row in debt_rows:
        debt_map[(str(row.contract_id or '').strip(), str(row.gestion_month or '').strip())] = float(row.debt or 0.0)

    dim_rows = (
        db.query(DimNegocioContrato)
        .filter(DimNegocioContrato.gestion_month.in_(months))
        .all()
    )
    contract_state: dict[tuple[str, str], dict[str, Any]] = {}
    for row in dim_rows:
        contract_id = str(row.contract_id or '').strip()
        month = str(row.gestion_month or '').strip()
        if not contract_id or not month:
            continue
        key = (contract_id, month)
        contract_state[key] = {
            'gestion_month': month,
            'un': str(row.un_canonica or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(row.supervisor_canonico or 'S/D').strip().upper() or 'S/D',
            'via_cobro': _canonical_via(row.via_canonica),
            'categoria': str(row.categoria_canonica or 'VIGENTE').strip().upper() or 'VIGENTE',
            'tramo': int(row.tramo or 0),
            'debt': float(debt_map.get(key, 0.0)),
            'paid_total': 0.0,
            'paid_via_cobrador': 0.0,
            'paid_via_debito': 0.0,
        }

    paid_rows = (
        db.query(
            CobranzasFact.contract_id,
            CobranzasFact.payment_month,
            CobranzasFact.payment_via_class,
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label('paid'),
        )
        .filter(CobranzasFact.payment_month.in_(months))
        .group_by(CobranzasFact.contract_id, CobranzasFact.payment_month, CobranzasFact.payment_via_class)
        .all()
    )
    for row in paid_rows:
        key = (str(row.contract_id or '').strip(), str(row.payment_month or '').strip())
        state = contract_state.get(key)
        if state is None:
            continue
        amount = float(row.paid or 0.0)
        via = _canonical_via(row.payment_via_class)
        state['paid_total'] += amount
        if via == 'COBRADOR':
            state['paid_via_cobrador'] += amount
        else:
            state['paid_via_debito'] += amount

    bucket_map: dict[tuple[str, str, str, str, str, int], dict[str, Any]] = {}
    for state in contract_state.values():
        debt_val = float(state['debt'] or 0.0)
        paid_raw = float(state['paid_total'] or 0.0)
        paid_capped = min(max(paid_raw, 0.0), max(debt_val, 0.0))
        if paid_raw > 0.0 and paid_capped < paid_raw:
            ratio = paid_capped / paid_raw
            paid_via_cobrador = float(state['paid_via_cobrador'] or 0.0) * ratio
            paid_via_debito = float(state['paid_via_debito'] or 0.0) * ratio
        else:
            paid_via_cobrador = float(state['paid_via_cobrador'] or 0.0)
            paid_via_debito = float(state['paid_via_debito'] or 0.0)
        bkey = (
            str(state['gestion_month']),
            str(state['un']),
            str(state['supervisor']),
            str(state['via_cobro']),
            str(state['categoria']),
            int(state['tramo']),
        )
        bucket = bucket_map.setdefault(
            bkey,
            {
                'gestion_month': bkey[0],
                'un': bkey[1],
                'supervisor': bkey[2],
                'via_cobro': bkey[3],
                'categoria': bkey[4],
                'tramo': bkey[5],
                'debt_total': 0.0,
                'paid_total': 0.0,
                'paid_via_cobrador': 0.0,
                'paid_via_debito': 0.0,
                'contracts_total': 0,
                'contracts_paid': 0,
            },
        )
        bucket['debt_total'] += debt_val
        bucket['paid_total'] += paid_capped
        bucket['paid_via_cobrador'] += paid_via_cobrador
        bucket['paid_via_debito'] += paid_via_debito
        bucket['contracts_total'] += 1
        if paid_capped > 0.0:
            bucket['contracts_paid'] += 1

    now = datetime.utcnow()
    mappings = []
    for bucket in bucket_map.values():
        item = dict(bucket)
        item['updated_at'] = now
        mappings.append(item)
    if mappings:
        db.bulk_insert_mappings(AnalyticsRendimientoAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_analytics_anuales_agg(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=_month_serial)
    if not months:
        return 0, 0
    cutoff = months[-1]
    deleted = (
        db.query(AnalyticsAnualesAgg)
        .filter(AnalyticsAnualesAgg.cutoff_month == cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()

    # Materialize a baseline annual aggregate from v1 summary for fast, no-filter rendering.
    base = AnalyticsService.fetch_anuales_summary_v1(db, AnalyticsFilters())
    rows = list(base.get('rows') or [])
    now = datetime.utcnow()
    mappings: list[dict] = []
    for row in rows:
        year = int(str(row.get('year') or 0) or 0)
        if year <= 0:
            continue
        contracts = int(row.get('contracts') or 0)
        contracts_vig = int(row.get('contractsVigentes') or 0)
        culminados = int(row.get('culminados') or 0)
        culminados_vig = int(row.get('culminadosVigentes') or 0)
        tkp_contrato = float(row.get('tkpContrato') or 0.0)
        tkp_pago = float(row.get('tkpPago') or 0.0)
        tkp_trans = float(row.get('tkpTransaccional') or 0.0)
        tkp_cul_contrato = float(row.get('tkpContratoCulminado') or 0.0)
        tkp_cul_pago = float(row.get('tkpPagoCulminado') or 0.0)
        tkp_cul_contrato_v = float(row.get('tkpContratoCulminadoVigente') or 0.0)
        tkp_cul_pago_v = float(row.get('tkpPagoCulminadoVigente') or 0.0)
        ltv = float(row.get('ltvCulminadoVigente') or 0.0)
        mappings.append(
            {
                'cutoff_month': cutoff,
                'sale_year': year,
                'sale_month': '*',
                'un': '*',
                'contracts': contracts,
                'contracts_vigentes': contracts_vig,
                'cuota_total': tkp_contrato * contracts,
                'paid_to_cutoff_total': tkp_trans * max(contracts, 1),
                'tx_to_cutoff_total': contracts,
                'paid_by_contract_month_total': tkp_pago * max(contracts, 1),
                'paid_by_contract_month_count': contracts,
                'culminados': culminados,
                'culminados_vigentes': culminados_vig,
                'cuota_cul_total': tkp_cul_contrato * max(culminados, 1),
                'cuota_cul_total_vigente': tkp_cul_contrato_v * max(culminados_vig, 1),
                'paid_by_contract_month_cul_total': tkp_cul_pago * max(culminados, 1),
                'paid_by_contract_month_cul_count': culminados,
                'paid_by_contract_month_cul_total_vigente': tkp_cul_pago_v * max(culminados_vig, 1),
                'paid_by_contract_month_cul_count_vigente': culminados_vig,
                'total_cobrado_cul_vigente': ltv * max(culminados_vig, 1),
                'total_deberia_cul_vigente': float(max(culminados_vig, 1)),
                'months_weighted_numerator_cul_vigente': float(max(culminados_vig, 1)),
                'updated_at': now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(AnalyticsAnualesAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_dim_time(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if _month_serial(str(m).strip()) > 0}, key=_month_serial)
    if not months:
        return 0, 0

    deleted = db.query(DimTime).filter(DimTime.month_key.in_(months)).delete(synchronize_session=False)
    db.commit()
    mappings: list[dict] = []
    now = datetime.utcnow()
    for mm in months:
        serial = _month_serial(mm)
        month = int(mm.split('/')[0])
        year = int(mm.split('/')[1])
        quarter = ((month - 1) // 3) + 1
        mappings.append(
            {
                'month_key': mm,
                'year': year,
                'quarter': quarter,
                'month': month,
                'month_name': f'{month:02d}',
                'sort_key': serial,
                'updated_at': now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(DimTime, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_dim_contract_month_and_catalogs(db: Session, affected_months: set[str]) -> tuple[int, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if _month_serial(str(m).strip()) > 0}, key=_month_serial)
    if not months:
        return 0, 0
    now = datetime.utcnow()

    deleted = db.query(DimContractMonth).filter(DimContractMonth.gestion_month.in_(months)).delete(synchronize_session=False)
    db.commit()
    rows = db.query(DimNegocioContrato).filter(DimNegocioContrato.gestion_month.in_(months)).all()
    mappings: list[dict] = []
    for row in rows:
        mappings.append(
            {
                'contract_id': str(row.contract_id or '').strip(),
                'gestion_month': str(row.gestion_month or '').strip(),
                'sale_month': str(row.sale_month or '').strip(),
                'sale_year': int(row.sale_year or 0),
                'un_canonica': str(row.un_canonica or 'S/D').strip().upper() or 'S/D',
                'supervisor_canonico': str(row.supervisor_canonico or 'S/D').strip().upper() or 'S/D',
                'categoria_canonica': str(row.categoria_canonica or 'VIGENTE').strip().upper() or 'VIGENTE',
                'via_canonica': str(row.via_canonica or 'DEBITO').strip().upper() or 'DEBITO',
                'tramo': int(row.tramo or 0),
                'updated_at': now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(DimContractMonth, mappings)
        db.commit()

    # Keep low-cardinality canonical catalogs fresh.
    db.query(DimUn).delete(synchronize_session=False)
    db.query(DimSupervisor).delete(synchronize_session=False)
    db.query(DimVia).delete(synchronize_session=False)
    db.query(DimCategoria).delete(synchronize_session=False)
    db.commit()
    un_values = {
        str(v[0] or '').strip().upper()
        for v in db.query(DimContractMonth.un_canonica).distinct().all()
        if str(v[0] or '').strip()
    }
    sup_values = {
        str(v[0] or '').strip().upper()
        for v in db.query(DimContractMonth.supervisor_canonico).distinct().all()
        if str(v[0] or '').strip()
    }
    via_values = {
        str(v[0] or '').strip().upper()
        for v in db.query(DimContractMonth.via_canonica).distinct().all()
        if str(v[0] or '').strip()
    }
    cat_values = {
        str(v[0] or '').strip().upper()
        for v in db.query(DimContractMonth.categoria_canonica).distinct().all()
        if str(v[0] or '').strip()
    }
    if un_values:
        db.bulk_insert_mappings(
            DimUn,
            [{'un_raw': val, 'un_canonica': val, 'mapping_version': 'v1', 'updated_at': now} for val in sorted(un_values)],
        )
    if sup_values:
        db.bulk_insert_mappings(
            DimSupervisor,
            [{'supervisor_raw': val, 'supervisor_canonico': val, 'updated_at': now} for val in sorted(sup_values)],
        )
    if via_values:
        db.bulk_insert_mappings(
            DimVia,
            [{'via_raw': val, 'via_canonica': val, 'updated_at': now} for val in sorted(via_values)],
        )
    if cat_values:
        db.bulk_insert_mappings(
            DimCategoria,
            [{'categoria_raw': val, 'categoria_canonica': val, 'updated_at': now} for val in sorted(cat_values)],
        )
    db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_mv_options_tables(db: Session, affected_months: set[str]) -> dict[str, int]:
    months = sorted({str(m).strip() for m in (affected_months or set()) if _month_serial(str(m).strip()) > 0}, key=_month_serial)
    if not months:
        return {'cartera': 0, 'cohorte': 0, 'rendimiento': 0, 'anuales': 0}

    now = datetime.utcnow()

    db.query(MvOptionsCartera).filter(MvOptionsCartera.gestion_month.in_(months)).delete(synchronize_session=False)
    rows_cartera = (
        db.query(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .filter(CarteraCorteAgg.gestion_month.in_(months))
        .group_by(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .all()
    )
    cartera_mappings = [
        {
            'gestion_month': str(r.gestion_month or '').strip(),
            'close_month': str(r.close_month or '').strip(),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(r.supervisor or 'S/D').strip().upper() or 'S/D',
            'via_cobro': str(r.via_cobro or 'DEBITO').strip().upper() or 'DEBITO',
            'categoria': str(r.categoria or 'VIGENTE').strip().upper() or 'VIGENTE',
            'tramo': int(r.tramo or 0),
            'contract_year': int(r.contract_year or 0),
            'updated_at': now,
        }
        for r in rows_cartera
    ]
    if cartera_mappings:
        db.bulk_insert_mappings(MvOptionsCartera, cartera_mappings)

    db.query(MvOptionsCohorte).filter(MvOptionsCohorte.cutoff_month.in_(months)).delete(synchronize_session=False)
    rows_cohorte = (
        db.query(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .filter(CobranzasCohorteAgg.cutoff_month.in_(months))
        .group_by(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .all()
    )
    cohorte_mappings = [
        {
            'cutoff_month': str(r.cutoff_month or '').strip(),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(r.supervisor or 'S/D').strip().upper() or 'S/D',
            'via_cobro': str(r.via_cobro or 'DEBITO').strip().upper() or 'DEBITO',
            'categoria': str(r.categoria or 'VIGENTE').strip().upper() or 'VIGENTE',
            'updated_at': now,
        }
        for r in rows_cohorte
    ]
    if cohorte_mappings:
        db.bulk_insert_mappings(MvOptionsCohorte, cohorte_mappings)

    db.query(MvOptionsRendimiento).filter(MvOptionsRendimiento.gestion_month.in_(months)).delete(synchronize_session=False)
    rows_rend = (
        db.query(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .filter(AnalyticsRendimientoAgg.gestion_month.in_(months))
        .group_by(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .all()
    )
    rend_mappings = [
        {
            'gestion_month': str(r.gestion_month or '').strip(),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(r.supervisor or 'S/D').strip().upper() or 'S/D',
            'via_cobro': str(r.via_cobro or 'DEBITO').strip().upper() or 'DEBITO',
            'categoria': str(r.categoria or 'VIGENTE').strip().upper() or 'VIGENTE',
            'tramo': int(r.tramo or 0),
            'updated_at': now,
        }
        for r in rows_rend
    ]
    if rend_mappings:
        db.bulk_insert_mappings(MvOptionsRendimiento, rend_mappings)

    db.query(MvOptionsAnuales).filter(MvOptionsAnuales.cutoff_month.in_(months)).delete(synchronize_session=False)
    rows_anuales = (
        db.query(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .filter(AnalyticsAnualesAgg.cutoff_month.in_(months))
        .group_by(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .all()
    )
    anuales_mappings = [
        {
            'cutoff_month': str(r.cutoff_month or '').strip(),
            'sale_month': str(r.sale_month or '').strip(),
            'sale_year': int(r.sale_year or 0),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'updated_at': now,
        }
        for r in rows_anuales
        if _month_serial(str(r.cutoff_month or '').strip()) > 0
    ]
    if anuales_mappings:
        db.bulk_insert_mappings(MvOptionsAnuales, anuales_mappings)

    db.commit()
    return {
        'cartera': len(cartera_mappings),
        'cohorte': len(cohorte_mappings),
        'rendimiento': len(rend_mappings),
        'anuales': len(anuales_mappings),
    }


def _bootstrap_mv_options_full(db: Session) -> dict[str, int]:
    now = datetime.utcnow()

    db.query(MvOptionsCartera).delete(synchronize_session=False)
    rows_cartera = (
        db.query(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .group_by(
            CarteraCorteAgg.gestion_month,
            CarteraCorteAgg.close_month,
            CarteraCorteAgg.un,
            CarteraCorteAgg.supervisor,
            CarteraCorteAgg.via_cobro,
            CarteraCorteAgg.categoria,
            CarteraCorteAgg.tramo,
            CarteraCorteAgg.contract_year,
        )
        .all()
    )
    cartera_mappings = [
        {
            'gestion_month': str(r.gestion_month or '').strip(),
            'close_month': str(r.close_month or '').strip(),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(r.supervisor or 'S/D').strip().upper() or 'S/D',
            'via_cobro': str(r.via_cobro or 'DEBITO').strip().upper() or 'DEBITO',
            'categoria': str(r.categoria or 'VIGENTE').strip().upper() or 'VIGENTE',
            'tramo': int(r.tramo or 0),
            'contract_year': int(r.contract_year or 0),
            'updated_at': now,
        }
        for r in rows_cartera
        if _month_serial(str(r.gestion_month or '').strip()) > 0
    ]
    if cartera_mappings:
        db.bulk_insert_mappings(MvOptionsCartera, cartera_mappings)

    db.query(MvOptionsCohorte).delete(synchronize_session=False)
    rows_cohorte = (
        db.query(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .group_by(
            CobranzasCohorteAgg.cutoff_month,
            CobranzasCohorteAgg.un,
            CobranzasCohorteAgg.supervisor,
            CobranzasCohorteAgg.via_cobro,
            CobranzasCohorteAgg.categoria,
        )
        .all()
    )
    cohorte_mappings = [
        {
            'cutoff_month': str(r.cutoff_month or '').strip(),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(r.supervisor or 'S/D').strip().upper() or 'S/D',
            'via_cobro': str(r.via_cobro or 'DEBITO').strip().upper() or 'DEBITO',
            'categoria': str(r.categoria or 'VIGENTE').strip().upper() or 'VIGENTE',
            'updated_at': now,
        }
        for r in rows_cohorte
        if _month_serial(str(r.cutoff_month or '').strip()) > 0
    ]
    if cohorte_mappings:
        db.bulk_insert_mappings(MvOptionsCohorte, cohorte_mappings)

    db.query(MvOptionsRendimiento).delete(synchronize_session=False)
    rows_rend = (
        db.query(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .group_by(
            AnalyticsRendimientoAgg.gestion_month,
            AnalyticsRendimientoAgg.un,
            AnalyticsRendimientoAgg.supervisor,
            AnalyticsRendimientoAgg.via_cobro,
            AnalyticsRendimientoAgg.categoria,
            AnalyticsRendimientoAgg.tramo,
        )
        .all()
    )
    rend_mappings = [
        {
            'gestion_month': str(r.gestion_month or '').strip(),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'supervisor': str(r.supervisor or 'S/D').strip().upper() or 'S/D',
            'via_cobro': str(r.via_cobro or 'DEBITO').strip().upper() or 'DEBITO',
            'categoria': str(r.categoria or 'VIGENTE').strip().upper() or 'VIGENTE',
            'tramo': int(r.tramo or 0),
            'updated_at': now,
        }
        for r in rows_rend
        if _month_serial(str(r.gestion_month or '').strip()) > 0
    ]
    if rend_mappings:
        db.bulk_insert_mappings(MvOptionsRendimiento, rend_mappings)

    db.query(MvOptionsAnuales).delete(synchronize_session=False)
    rows_anuales = (
        db.query(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .group_by(
            AnalyticsAnualesAgg.cutoff_month,
            AnalyticsAnualesAgg.sale_month,
            AnalyticsAnualesAgg.sale_year,
            AnalyticsAnualesAgg.un,
        )
        .all()
    )
    anuales_mappings = [
        {
            'cutoff_month': str(r.cutoff_month or '').strip(),
            'sale_month': str(r.sale_month or '').strip(),
            'sale_year': int(r.sale_year or 0),
            'un': str(r.un or 'S/D').strip().upper() or 'S/D',
            'updated_at': now,
        }
        for r in rows_anuales
        if _month_serial(str(r.cutoff_month or '').strip()) > 0
    ]
    if anuales_mappings:
        db.bulk_insert_mappings(MvOptionsAnuales, anuales_mappings)

    db.commit()
    return {
        'cartera': len(cartera_mappings),
        'cohorte': len(cohorte_mappings),
        'rendimiento': len(rend_mappings),
        'anuales': len(anuales_mappings),
    }


def _mv_options_consistency_report(db: Session) -> dict:
    def _distinct_months(model, column_name: str) -> set[str]:
        col = getattr(model, column_name)
        return {
            str(v[0] or '').strip()
            for v in db.query(col).distinct().all()
            if _month_serial(str(v[0] or '').strip()) > 0
        }

    checks = {
        'cartera': {
            'expected': _distinct_months(CarteraCorteAgg, 'gestion_month'),
            'actual': _distinct_months(MvOptionsCartera, 'gestion_month'),
        },
        'cohorte': {
            'expected': _distinct_months(CobranzasCohorteAgg, 'cutoff_month'),
            'actual': _distinct_months(MvOptionsCohorte, 'cutoff_month'),
        },
        'rendimiento': {
            'expected': _distinct_months(AnalyticsRendimientoAgg, 'gestion_month'),
            'actual': _distinct_months(MvOptionsRendimiento, 'gestion_month'),
        },
        'anuales': {
            'expected': _distinct_months(AnalyticsAnualesAgg, 'cutoff_month'),
            'actual': _distinct_months(MvOptionsAnuales, 'cutoff_month'),
        },
    }
    out: dict[str, dict] = {}
    ok = True
    for key, item in checks.items():
        expected = item['expected']
        actual = item['actual']
        missing = sorted(expected - actual, key=_month_serial)
        stale = sorted(actual - expected, key=_month_serial)
        row_ok = not missing and not stale
        ok = ok and row_ok
        out[key] = {
            'ok': row_ok,
            'expected_months': len(expected),
            'actual_months': len(actual),
            'missing_months': missing,
            'stale_months': stale,
        }
    return {
        'ok': ok,
        'checks': out,
        'last_checked_at': datetime.utcnow().isoformat(),
    }


def _refresh_source_freshness_snapshots(db: Session, last_job_id: str | None = None) -> None:
    table = AnalyticsSourceFreshness.__table__
    now = datetime.utcnow()
    sources = [
        ('cartera_fact', CarteraFact.updated_at),
        ('cobranzas_fact', CobranzasFact.updated_at),
        ('cartera_corte_agg', CarteraCorteAgg.updated_at),
        ('cobranzas_cohorte_agg', CobranzasCohorteAgg.updated_at),
        ('analytics_rendimiento_agg', AnalyticsRendimientoAgg.updated_at),
        ('analytics_anuales_agg', AnalyticsAnualesAgg.updated_at),
        ('dim_negocio_contrato', DimNegocioContrato.updated_at),
        ('analytics_contract_snapshot', AnalyticsContractSnapshot.created_at),
        ('mv_options_cartera', MvOptionsCartera.updated_at),
        ('mv_options_cohorte', MvOptionsCohorte.updated_at),
        ('mv_options_rendimiento', MvOptionsRendimiento.updated_at),
        ('mv_options_anuales', MvOptionsAnuales.updated_at),
    ]

    rows: list[dict] = []
    for source_name, source_col in sources:
        dt = db.query(source_col).order_by(source_col.desc()).limit(1).scalar()
        rows.append(
            {
                'source_table': source_name,
                'max_updated_at': dt,
                'updated_at': now,
                'last_job_id': last_job_id,
            }
        )
    if engine.dialect.name == 'postgresql':
        stmt = pg_insert(table).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[table.c.source_table],
            set_={
                'max_updated_at': stmt.excluded.max_updated_at,
                'updated_at': now,
                'last_job_id': stmt.excluded.last_job_id,
            },
        )
    else:
        stmt = sqlite_insert(table).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=['source_table'],
            set_={
                'max_updated_at': stmt.excluded.max_updated_at,
                'updated_at': now,
                'last_job_id': stmt.excluded.last_job_id,
            },
        )
    db.execute(stmt)
    db.commit()


def _ensure_agg_perf_indexes(db: Session) -> None:
    # Runtime-safe indexes used by refresh_agg joins/groupings.
    if engine.dialect.name != 'postgresql':
        return
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_cartera_fact_contract_gestion ON cartera_fact (contract_id, gestion_month)",
        "CREATE INDEX IF NOT EXISTS ix_cobranzas_fact_contract_payment_month ON cobranzas_fact (contract_id, payment_month)",
        "CREATE INDEX IF NOT EXISTS ix_cartera_fact_gestion_contract ON cartera_fact (gestion_month, contract_id)",
    ]
    for sql in statements:
        db.execute(sa_text(sql))
    db.commit()


def _ensure_cartera_conflict_unique_index(db: Session) -> None:
    """Deprecated for partitioned-by-expression schemas.

    In this deployment, cartera upsert is deterministic delete+insert.
    Creating UNIQUE indexes on parent partitioned table is not supported
    when partition keys include expressions.
    """
    return


def _refresh_analytics_snapshot(
    db: Session,
    mode: str,
    year_from: int | None,
    target_months: set[str],
    normalized_rows: list[dict] | None,
) -> None:
    q = db.query(AnalyticsContractSnapshot)
    if target_months:
        q = q.filter(AnalyticsContractSnapshot.sale_month.in_(target_months))
    elif mode == 'full_year' and year_from is not None:
        q = q.filter(func.substr(AnalyticsContractSnapshot.sale_month, 4, 4) == str(year_from))
    elif mode == 'full_all':
        pass
    q.delete(synchronize_session=False)
    db.commit()

    def _append_snapshot_rows(source_rows: list[dict], now: datetime) -> int:
        inserted = 0
        snapshot_rows: list[dict] = []
        for row in source_rows:
            contracts = max(1, _to_int(row.get('contracts_total'), 1))
            debt_total = _to_float(row.get('debt_total'))
            paid_total = _to_float(row.get('paid_total'))
            if contracts <= 0 or (debt_total == 0 and paid_total == 0):
                payload = json.loads(row.get('payload_json') or '{}')
                contracts = max(1, _to_int(payload.get('contracts_total'), 1))
                debt_total = _to_float(payload.get('debt_total'))
                paid_total = _to_float(payload.get('paid_total'))
            debt_per = debt_total / contracts
            paid_per = paid_total / contracts
            base_id = str(row.get('contract_id') or '')
            if not base_id:
                continue
            for i in range(contracts):
                snapshot_rows.append(
                    {
                        'contract_id': f'{base_id}_{i}',
                        'sale_month': row.get('gestion_month'),
                        'close_month': row.get('gestion_month'),
                        'supervisor': row.get('supervisor'),
                        'un': row.get('un'),
                        'via': row.get('via'),
                        'tramo': int(row.get('tramo') or 0),
                        'debt': debt_per,
                        'paid': paid_per,
                        'created_at': now,
                    }
                )
                if len(snapshot_rows) >= 5000:
                    db.bulk_insert_mappings(AnalyticsContractSnapshot, snapshot_rows)
                    db.commit()
                    inserted += len(snapshot_rows)
                    snapshot_rows = []
        if snapshot_rows:
            db.bulk_insert_mappings(AnalyticsContractSnapshot, snapshot_rows)
            db.commit()
            inserted += len(snapshot_rows)
        return inserted

    now = datetime.utcnow()
    source_rows = list(normalized_rows or [])
    if source_rows:
        _append_snapshot_rows(source_rows, now)
        return

    # Avoid server-side cursor invalidation on PostgreSQL:
    # this function commits while processing, so we paginate by id.
    page_size = 1000
    last_id = 0
    while True:
        q_fact = (
            db.query(AnalyticsFact)
            .filter(AnalyticsFact.id > last_id)
            .order_by(AnalyticsFact.id.asc())
        )
        if mode == 'full_year' and year_from is not None:
            q_fact = q_fact.filter(func.substr(AnalyticsFact.gestion_month, 4, 4) == str(year_from))
        elif mode != 'full_all' and target_months:
            q_fact = q_fact.filter(AnalyticsFact.gestion_month.in_(target_months))
        rows = q_fact.limit(page_size).all()
        if not rows:
            break
        batch: list[dict] = []
        for row in rows:
            batch.append(
                {
                    'contract_id': row.contract_id,
                    'gestion_month': row.gestion_month,
                    'supervisor': row.supervisor,
                    'un': row.un,
                    'via': row.via,
                    'tramo': row.tramo,
                    'contracts_total': row.contracts_total,
                    'debt_total': row.debt_total,
                    'paid_total': row.paid_total,
                    'payload_json': row.payload_json,
                }
            )
        _append_snapshot_rows(batch, now)
        last_id = int(rows[-1].id or last_id)


def _persist_sync_run(db: Session, payload: dict) -> None:
    row = db.query(SyncRun).filter(SyncRun.job_id == payload['job_id']).first()
    if row is None:
        row = SyncRun(job_id=payload['job_id'])
        db.add(row)
    for key, value in payload.items():
        if key == 'log':
            row.log_json = json.dumps(value or [], ensure_ascii=False)
        elif key == 'chunk_key':
            # DB column is varchar(256); avoid breaking status updates with long month lists.
            text_value = str(value or '')
            setattr(row, key, text_value[:250] if text_value else None)
        elif hasattr(row, key):
            setattr(row, key, value)
    # Heartbeat: keeps queue lock fresh while the worker is alive.
    # This prevents false "job_interrupted_on_restart" when another worker process boots.
    if bool(payload.get('running')):
        qrow = db.query(SyncJob).filter(SyncJob.job_id == payload['job_id']).first()
        if qrow is not None and str(qrow.status or '').strip().lower() == 'running':
            qrow.locked_at = datetime.utcnow()
    db.commit()


def _persist_job_step(db: Session, job_id: str, domain: str, step_name: str, status: str, details: dict | None = None) -> None:
    now = datetime.utcnow()
    details_json = json.dumps(details or {}, ensure_ascii=False)

    try:
        row = (
            db.query(SyncJobStep)
            .filter(SyncJobStep.job_id == job_id, SyncJobStep.domain == domain, SyncJobStep.step_name == step_name)
            .order_by(SyncJobStep.started_at.desc())
            .first()
        )
        if status == 'running':
            row = SyncJobStep(
                job_id=job_id,
                domain=domain,
                step_name=step_name,
                status='running',
                details_json=details_json,
                started_at=now,
            )
            db.add(row)
            db.commit()
            return
        if row is None:
            row = SyncJobStep(
                job_id=job_id,
                domain=domain,
                step_name=step_name,
                status=status,
                details_json=details_json,
                started_at=now,
                finished_at=now,
                duration_sec=0.0,
            )
            db.add(row)
            db.commit()
            return
        row.status = status
        row.details_json = details_json
        row.finished_at = now
        if row.started_at:
            row.duration_sec = round((now - row.started_at).total_seconds(), 2)
        db.commit()
    except Exception:
        # Si la transacción venía abortada por un error SQL previo, limpiarla
        # y reintentar registrar al menos el estado del paso.
        db.rollback()
        try:
            row = SyncJobStep(
                job_id=job_id,
                domain=domain,
                step_name=step_name,
                status=status,
                details_json=details_json,
                started_at=now,
                finished_at=now if status != 'running' else None,
                duration_sec=0.0,
            )
            db.add(row)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception('[sync:%s:%s] failed to persist job step=%s status=%s', domain, job_id, step_name, status)


def _watermark_partition_key(mode: str, year_from: int | None, close_month: str | None, close_month_from: str | None, close_month_to: str | None) -> str:
    if mode == 'full_month':
        return f'month:{close_month or "*"}'
    if mode == 'range_months':
        return f'range:{close_month_from or "*"}->{close_month_to or "*"}'
    if mode == 'full_year':
        return f'year:{year_from if year_from is not None else "*"}'
    return '*'


def _get_watermark(db: Session, domain: str, query_file: str, partition_key: str = '*') -> SyncWatermark | None:
    return (
        db.query(SyncWatermark)
        .filter(
            SyncWatermark.domain == domain,
            SyncWatermark.query_file == query_file,
            SyncWatermark.partition_key == partition_key,
        )
        .first()
    )


def _upsert_watermark(
    db: Session,
    *,
    domain: str,
    query_file: str,
    partition_key: str,
    last_updated_at: datetime | None,
    last_source_id: str | None,
    last_success_job_id: str,
    last_row_count: int,
) -> None:
    row = _get_watermark(db, domain=domain, query_file=query_file, partition_key=partition_key)
    if row is None:
        row = SyncWatermark(
            domain=domain,
            query_file=query_file,
            partition_key=partition_key,
        )
        db.add(row)
    row.last_updated_at = last_updated_at
    row.last_source_id = last_source_id
    row.last_success_job_id = last_success_job_id
    row.last_row_count = int(last_row_count or 0)
    row.updated_at = datetime.utcnow()
    db.commit()


def _reconcile_chunk_manifest(
    db: Session,
    *,
    domain: str,
    job_id: str,
    chunk_signals: dict[str, dict],
) -> tuple[set[str], int]:
    changed: set[str] = set()
    skipped = 0
    now = datetime.utcnow()
    for chunk_key, signal in chunk_signals.items():
        row_count = int(signal.get('count') or 0)
        chunk_hash = _chunk_hash_finalize(signal)
        row = (
            db.query(SyncChunkManifest)
            .filter(SyncChunkManifest.domain == domain, SyncChunkManifest.chunk_key == chunk_key)
            .first()
        )
        if row is None:
            row = SyncChunkManifest(
                domain=domain,
                chunk_key=chunk_key,
                chunk_hash=chunk_hash,
                row_count=row_count,
                first_seen_at=now,
                last_seen_at=now,
                status='changed',
                last_job_id=job_id,
                skipped_count=0,
                updated_at=now,
            )
            db.add(row)
            changed.add(chunk_key)
            continue
        if str(row.chunk_hash or '') == chunk_hash and int(row.row_count or 0) == row_count:
            row.status = 'unchanged'
            row.last_seen_at = now
            row.last_job_id = job_id
            row.skipped_count = int(row.skipped_count or 0) + 1
            row.updated_at = now
            skipped += 1
            continue
        row.chunk_hash = chunk_hash
        row.row_count = row_count
        row.status = 'changed'
        row.last_seen_at = now
        row.last_job_id = job_id
        row.updated_at = now
        changed.add(chunk_key)
    db.commit()
    return changed, skipped


def _log_extract_chunk(
    db: Session,
    *,
    job_id: str,
    domain: str,
    chunk_key: str,
    stage: str,
    status: str,
    rows: int,
    duration_sec: float,
    details: dict | None = None,
) -> None:
    dsec = max(0.0, float(duration_sec or 0.0))
    row_count = max(0, int(rows or 0))
    throughput = round((row_count / dsec), 2) if dsec > 0 else 0.0
    row = SyncExtractLog(
        job_id=job_id,
        domain=domain,
        chunk_key=str(chunk_key or '*'),
        stage=str(stage or 'extract'),
        status=str(status or 'completed'),
        rows=row_count,
        duration_sec=dsec,
        throughput_rows_per_sec=throughput,
        details_json=json.dumps(details or {}, ensure_ascii=False),
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()


def _queue_position(db: Session, job_id: str) -> int | None:
    target = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
    if target is None:
        return None
    if target.status == 'running':
        return 0
    if target.status != 'pending':
        return None
    ahead = (
        db.query(SyncJob.id)
        .filter(
            SyncJob.status == 'pending',
            SyncJob.created_at < target.created_at,
        )
        .count()
    )
    return int(ahead) + 1


def _cleanup_stale_running_jobs() -> None:
    """
    After process/container restarts, jobs can remain running=true in DB
    without a live worker thread. Mark them as failed to avoid frozen UI status.
    """
    db = SessionLocal()
    try:
        rows = db.query(SyncRun).filter(SyncRun.running.is_(True)).all()
        if not rows:
            return
        now = datetime.utcnow()
        for row in rows:
            queue_row = (
                db.query(SyncJob.status, SyncJob.locked_at, SyncJob.started_at, SyncJob.created_at)
                .filter(SyncJob.job_id == row.job_id)
                .first()
            )
            if queue_row is not None:
                queue_status = str(queue_row[0] or '').strip().lower()
                heartbeat_at = queue_row[1] or queue_row[2] or queue_row[3] or row.started_at
                if (
                    queue_status == 'running'
                    and heartbeat_at is not None
                    and (now - heartbeat_at).total_seconds() <= RUNNING_JOB_STALE_GRACE_SECONDS
                ):
                    # Another worker may still be actively processing this job.
                    continue
            row.running = False
            row.stage = 'failed'
            row.progress_pct = 100
            row.status_message = 'Sincronizacion interrumpida (reinicio del servicio)'
            row.error = 'job_interrupted_on_restart'
            row.finished_at = now
            if row.started_at:
                row.duration_sec = round((now - row.started_at).total_seconds(), 2)
            existing_log = []
            try:
                existing_log = json.loads(row.log_json or '[]')
            except Exception:
                existing_log = []
            existing_log.append(f'Error: job_interrupted_on_restart ({now.isoformat()})')
            row.log_json = json.dumps(existing_log[-200:], ensure_ascii=False)
        db.commit()
    finally:
        db.close()


def _cleanup_stale_running_queue_jobs() -> None:
    db = SessionLocal()
    try:
        stale = db.query(SyncJob).filter(SyncJob.status == 'running').all()
        if not stale:
            return
        now = datetime.utcnow()
        for row in stale:
            heartbeat_at = row.locked_at or row.started_at or row.created_at
            if (
                heartbeat_at is not None
                and (now - heartbeat_at).total_seconds() <= RUNNING_JOB_STALE_GRACE_SECONDS
            ):
                continue
            row.status = 'failed'
            row.error = 'job_interrupted_on_restart'
            row.finished_at = now
        db.commit()
    finally:
        db.close()


def _queue_has_running_or_pending(db: Session) -> bool:
    row = (
        db.query(SyncJob.id)
        .filter(SyncJob.status.in_(['pending', 'running']))
        .first()
    )
    return row is not None


def _queue_has_manual_running_or_pending(db: Session) -> bool:
    """True if there is a manual (non-scheduled) job pending or running."""
    row = (
        db.query(SyncJob.id)
        .filter(SyncJob.status.in_(['pending', 'running']))
        .filter(SyncJob.schedule_id.is_(None))
        .first()
    )
    return row is not None


def _queue_job(
    db: Session,
    *,
    job_id: str,
    domain: str,
    mode: str,
    actor: str,
    year_from: int | None,
    close_month: str | None,
    close_month_from: str | None,
    close_month_to: str | None,
    schedule_id: int | None = None,
    run_group_id: str | None = None,
) -> None:
    row = SyncJob(
        job_id=job_id,
        domain=domain,
        status='pending',
        mode=mode,
        actor=actor,
        year_from=year_from,
        close_month=close_month,
        close_month_from=close_month_from,
        close_month_to=close_month_to,
        priority=100,
        max_retries=1,
        retries=0,
        schedule_id=schedule_id,
        run_group_id=run_group_id,
    )
    db.add(row)
    db.commit()


def _claim_next_job(worker_name: str) -> dict[str, Any] | None:
    db = SessionLocal()
    try:
        row = (
            db.query(SyncJob)
            .filter(SyncJob.status == 'pending')
            .order_by(SyncJob.priority.asc(), SyncJob.created_at.asc())
            .first()
        )
        if row is None:
            return None
        row.status = 'running'
        row.locked_by = worker_name
        row.locked_at = datetime.utcnow()
        row.started_at = datetime.utcnow()
        db.commit()
        return {
            'job_id': row.job_id,
            'actor': row.actor,
            'domain': row.domain,
            'mode': row.mode,
            'year_from': row.year_from,
            'close_month': row.close_month,
            'close_month_from': row.close_month_from,
            'close_month_to': row.close_month_to,
            'schedule_id': getattr(row, 'schedule_id', None),
            'run_group_id': getattr(row, 'run_group_id', None),
        }
    finally:
        db.close()


def _mark_queue_job_done(job_id: str, status: str, error: str | None = None) -> None:
    db = SessionLocal()
    try:
        row = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if row is None:
            return
        schedule_id = getattr(row, 'schedule_id', None)
        run_group_id = getattr(row, 'run_group_id', None)
        row.status = status
        row.error = error
        row.finished_at = datetime.utcnow()
        db.commit()
        if schedule_id is not None and run_group_id:
            _update_schedule_after_run_if_done(db, schedule_id, run_group_id)
    finally:
        db.close()


def _is_queue_job_cancelled(db: Session, job_id: str) -> bool:
    row = db.query(SyncJob.status).filter(SyncJob.job_id == job_id).first()
    if not row:
        return False
    return str(row[0] or '').lower() == 'cancelled'


def _ensure_job_not_cancelled(db: Session, job_id: str, domain: str) -> None:
    if _is_queue_job_cancelled(db, job_id):
        _append_log(domain, 'Cancelado por solicitud del usuario')
        raise SyncCancelledError('cancelled_by_user')


def _compute_next_run_at(
    interval_value: int,
    interval_unit: str,
    from_dt: datetime | None = None,
) -> datetime:
    """Compute next run time. Minimum interval is 10 minutes."""
    now = from_dt or datetime.now(timezone.utc)
    value = max(1, int(interval_value))
    unit = (str(interval_unit) or 'minute').lower()
    if unit == 'minute':
        delta = timedelta(minutes=max(10, value))
    elif unit == 'hour':
        delta = timedelta(hours=value)
    elif unit == 'day':
        delta = timedelta(days=value)
    elif unit == 'month':
        # Approximate: add months then clamp to same day
        month = now.month + value
        year = now.year
        while month > 12:
            month -= 12
            year += 1
        try:
            next_dt = now.replace(year=year, month=month, day=min(now.day, 28))
        except ValueError:
            next_dt = now.replace(year=year, month=month, day=28)
        return next_dt.replace(tzinfo=timezone.utc)
    else:
        delta = timedelta(minutes=max(10, value))
    return (now + delta).replace(tzinfo=timezone.utc)


def _update_schedule_after_run_if_done(
    db: Session,
    schedule_id: int,
    run_group_id: str,
) -> None:
    """When the last job of a run_group completes, update schedule last_run_* and next_run_at."""
    remaining = (
        db.query(SyncJob.id)
        .filter(SyncJob.run_group_id == run_group_id)
        .filter(SyncJob.status.in_(['pending', 'running']))
        .count()
    )
    if remaining > 0:
        return
    schedule = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
    if not schedule:
        return
    jobs = (
        db.query(SyncJob)
        .filter(SyncJob.run_group_id == run_group_id)
        .order_by(SyncJob.created_at.asc())
        .all()
    )
    job_ids = [j.job_id for j in jobs]
    runs = (
        db.query(SyncRun)
        .filter(SyncRun.job_id.in_(job_ids))
        .all()
    ) if job_ids else []
    run_by_job = {r.job_id: r for r in runs}
    status = 'ok'
    rows_inserted = 0
    rows_updated = 0
    rows_upserted = 0
    rows_unchanged = 0
    rows_read = 0
    rows_skipped = 0
    error_msgs = []
    for j in jobs:
        r = run_by_job.get(j.job_id)
        if r and (getattr(r, 'error', None) or (str(getattr(r, 'stage', '') or '').lower() == 'failed')):
            status = 'failed'
            if r.error:
                error_msgs.append(r.error[:200])
        if r:
            rows_inserted += int(getattr(r, 'rows_inserted', 0) or 0)
            rows_updated += int(getattr(r, 'rows_updated', 0) or 0)
            rows_upserted += int(getattr(r, 'rows_upserted', 0) or 0)
            rows_unchanged += int(getattr(r, 'rows_unchanged', 0) or 0)
            rows_read += int(getattr(r, 'rows_read', 0) or 0)
            rows_skipped += int(getattr(r, 'rows_skipped', 0) or 0)
    rows_changed_total = rows_inserted + rows_updated + rows_upserted
    summary = {
        'job_count': len(jobs),
        'rows_inserted': rows_inserted,
        'rows_updated': rows_updated,
        'rows_upserted': rows_upserted,
        'rows_unchanged': rows_unchanged,
        'rows_read': rows_read,
        'rows_skipped': rows_skipped,
        'rows_changed_total': rows_changed_total,
        'had_new_data': rows_changed_total > 0,
        'errors': error_msgs[:5],
    }
    now = datetime.utcnow()
    schedule.last_run_at = now
    schedule.last_run_status = status
    schedule.last_run_summary = json.dumps(summary, ensure_ascii=False)
    db.commit()


def run_scheduler_tick() -> None:
    """Enqueue scheduled jobs whose next_run_at is due. Called periodically by the worker."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        schedules = (
            db.query(SyncSchedule)
            .filter(SyncSchedule.enabled == True)  # noqa: E712
            .filter(SyncSchedule.paused == False)   # noqa: E712
            .filter(
                (SyncSchedule.next_run_at.is_(None)) | (SyncSchedule.next_run_at <= now)
            )
            .all()
        )
        for s in schedules:
            try:
                domains = json.loads(s.domains or '[]')
                if not isinstance(domains, list) or not domains:
                    s.next_run_at = _compute_next_run_at(
                        s.interval_value, s.interval_unit, from_dt=now
                    )
                    db.commit()
                    continue
                run_group_id = str(uuid.uuid4())
                mode = s.mode or 'incremental'
                for domain in domains:
                    if domain not in SYNC_DOMAIN_QUERIES:
                        continue
                    job_id = str(uuid.uuid4())
                    _queue_job(
                        db,
                        job_id=job_id,
                        domain=domain,
                        mode=mode,
                        actor='schedule',
                        year_from=s.year_from,
                        close_month=s.close_month,
                        close_month_from=s.close_month_from,
                        close_month_to=s.close_month_to,
                        schedule_id=s.id,
                        run_group_id=run_group_id,
                    )
                    _persist_sync_run(
                        db,
                        {
                            'job_id': job_id,
                            'domain': domain,
                            'mode': mode,
                            'year_from': s.year_from,
                            'close_month': s.close_month,
                            'target_table': _target_table_name(domain),
                            'running': True,
                            'stage': 'queued',
                            'progress_pct': 0,
                            'status_message': 'Programado',
                            'rows_inserted': 0,
                            'rows_updated': 0,
                            'rows_skipped': 0,
                            'rows_read': 0,
                            'rows_upserted': 0,
                            'rows_unchanged': 0,
                            'throughput_rows_per_sec': 0.0,
                            'eta_seconds': None,
                            'current_query_file': _query_file_for(domain),
                            'job_step': 'queued',
                            'duplicates_detected': 0,
                            'error': None,
                            'started_at': now,
                            'finished_at': None,
                            'duration_sec': None,
                            'log': ['Estado: ejecución programada'],
                            'actor': 'schedule',
                        },
                    )
                s.next_run_at = _compute_next_run_at(s.interval_value, s.interval_unit, from_dt=now)
                db.commit()
            except Exception as e:
                logger.exception("scheduler tick schedule id=%s: %s", s.id, e)
                db.rollback()
    finally:
        db.close()


def emergency_stop_all_schedules() -> None:
    """Pause all schedules and cancel pending/running scheduled jobs."""
    db = SessionLocal()
    try:
        db.query(SyncSchedule).filter(SyncSchedule.enabled == True).update(  # noqa: E712
            {'paused': True}, synchronize_session=False
        )
        db.query(SyncJob).filter(
            SyncJob.status.in_(['pending', 'running']),
            SyncJob.schedule_id.isnot(None),
        ).update(
            {'status': 'cancelled', 'error': 'cancelled_by_user', 'finished_at': datetime.utcnow()},
            synchronize_session=False,
        )
        db.commit()
    finally:
        db.close()


def emergency_resume_all_schedules() -> None:
    """Resume all schedules (set paused=False)."""
    db = SessionLocal()
    try:
        db.query(SyncSchedule).update({'paused': False}, synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _execute_job(
    job_id: str,
    actor: str,
    domain: str,
    mode: str,
    year_from: int | None,
    close_month: str | None,
    close_month_from: str | None,
    close_month_to: str | None,
) -> None:
    started_at = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        logger.info(
            '[sync:%s:%s] start mode=%s year_from=%s close_month=%s close_month_from=%s close_month_to=%s actor=%s',
            domain,
            job_id,
            mode,
            year_from,
            close_month,
            close_month_from,
            close_month_to,
            actor,
        )
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'target_table': _target_table_name(domain),
                'running': True,
                'stage': 'starting',
                'progress_pct': 1,
                'status_message': 'Iniciando sincronizacion',
                'rows_inserted': 0,
                'rows_updated': 0,
                'rows_skipped': 0,
                'rows_read': 0,
                'rows_upserted': 0,
                'rows_unchanged': 0,
                'throughput_rows_per_sec': 0.0,
                'eta_seconds': 0,
                'current_query_file': _query_file_for(domain),
                'job_step': 'bootstrap',
                'affected_months': [],
                'agg_refresh_started': False,
                'agg_refresh_completed': False,
                'agg_rows_written': 0,
                'agg_duration_sec': None,
                'duplicates_detected': 0,
                'error': None,
                'started_at': started_at.replace(tzinfo=None),
                'finished_at': None,
                'duration_sec': None,
                'actor': actor,
                'log': [
                    f'Inicio: {started_at.isoformat()}',
                    f'Domain: {domain}',
                    f'Modo: {mode}',
                    f'Mes cierre: {close_month or "-"}',
                    f'Rango cierre: {(close_month_from or "-")} -> {(close_month_to or "-")}',
                ],
            },
        )
        _set_state(
            domain,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'target_table': _target_table_name(domain),
                'running': True,
                'stage': 'starting',
                'progress_pct': 1,
                'status_message': 'Iniciando sincronizacion',
                'rows_inserted': 0,
                'rows_updated': 0,
                'rows_skipped': 0,
                'rows_read': 0,
                'rows_upserted': 0,
                'rows_unchanged': 0,
                'throughput_rows_per_sec': 0.0,
                'eta_seconds': 0,
                'current_query_file': _query_file_for(domain),
                'job_step': 'bootstrap',
                'affected_months': [],
                'agg_refresh_started': False,
                'agg_refresh_completed': False,
                'agg_rows_written': 0,
                'agg_duration_sec': None,
                'duplicates_detected': 0,
                'error': None,
                'log': [
                    f'Inicio: {started_at.isoformat()}',
                    f'Domain: {domain}',
                    f'Modo: {mode}',
                    f'Mes cierre: {close_month or "-"}',
                    f'Rango cierre: {(close_month_from or "-")} -> {(close_month_to or "-")}',
                ],
                'started_at': started_at.isoformat(),
                'finished_at': None,
                'duration_sec': None,
            },
        )
        _persist_job_step(db, job_id, domain, 'bootstrap', 'running', {'mode': mode})

        range_months = _month_range(close_month_from or '', close_month_to or '') if mode == 'range_months' else []
        range_months_set = set(range_months)

        query_path = _query_path_for(domain)
        if not query_path.exists():
            raise RuntimeError(f'No existe query para dominio {domain}: {query_path.name}')
        mysql_cfg = _resolve_mysql_connection_config(db)
        _persist_job_step(db, job_id, domain, 'extract', 'running', {'query_file': _query_file_for(domain)})
        _set_state(domain, {'stage': 'connecting_mysql', 'progress_pct': 8, 'status_message': 'Conectando a MySQL'})
        _append_log(domain, 'Conectando a MySQL...')
        partition_key = _watermark_partition_key(mode, year_from, close_month, close_month_from, close_month_to)
        watermark_row = _get_watermark(
            db,
            domain=domain,
            query_file=_query_file_for(domain),
            partition_key=partition_key,
        )
        wm_filter_updated_at = watermark_row.last_updated_at if watermark_row is not None else None
        wm_filter_source_id = str(watermark_row.last_source_id or '').strip() if watermark_row is not None else ''
        # full_all must re-read the complete source snapshot.
        # Applying watermark here can shrink the dataset to only recent updates.
        if mode == 'full_all':
            wm_filter_updated_at = None
            wm_filter_source_id = ''
        watermark_filtered_rows = 0
        if wm_filter_updated_at is not None:
            _append_log(
                domain,
                f'Watermark activo: updated_at>{wm_filter_updated_at.isoformat()}'
                + (f' (id>{wm_filter_source_id})' if wm_filter_source_id else ''),
            )
        if getattr(settings, 'sync_precheck_enabled', True):
            if not _mysql_has_new_data(
                domain=domain,
                watermark_updated_at=wm_filter_updated_at,
                watermark_source_id=wm_filter_source_id or None,
                mysql_config=mysql_cfg,
            ):
                _append_log(domain, 'Pre-check: sin datos nuevos, omitiendo sync (skipped_no_changes).')
                finished_at = datetime.now(timezone.utc)
                duration_sec = round((finished_at - started_at).total_seconds(), 2)
                _set_state(
                    domain,
                    {
                        'running': False,
                        'stage': 'completed',
                        'progress_pct': 100,
                        'status_message': 'Sin datos nuevos (skipped_no_changes)',
                        'rows_read': 0,
                        'rows_upserted': 0,
                        'rows_unchanged': 0,
                        'finished_at': finished_at.isoformat(),
                        'duration_sec': duration_sec,
                        'job_step': 'finalize',
                    },
                )
                _persist_job_step(db, job_id, domain, 'extract', 'completed', {'rows_read': 0})
                _persist_job_step(db, job_id, domain, 'normalize', 'completed', {'rows_read': 0, 'normalized': 0})
                _persist_job_step(db, job_id, domain, 'replace_window', 'completed', {'months': []})
                _persist_job_step(db, job_id, domain, 'upsert', 'completed', {'rows_upserted': 0, 'rows_unchanged': 0})
                _persist_job_step(db, job_id, domain, 'finalize', 'completed', {'duration_sec': duration_sec})
                _persist_job_step(db, job_id, domain, 'bootstrap', 'completed')
                state_snap = _state_by_domain.get(domain) or {}
                _persist_sync_run(
                    db,
                    {
                        'job_id': job_id,
                        'domain': domain,
                        'mode': mode,
                        'year_from': year_from,
                        'close_month': close_month,
                        'close_month_from': close_month_from,
                        'close_month_to': close_month_to,
                        'target_table': _target_table_name(domain),
                        'running': False,
                        'stage': 'completed',
                        'progress_pct': 100,
                        'status_message': 'Sin datos nuevos (skipped_no_changes)',
                        'rows_inserted': 0,
                        'rows_updated': 0,
                        'rows_skipped': 0,
                        'rows_read': 0,
                        'rows_upserted': 0,
                        'rows_unchanged': 0,
                        'current_query_file': _query_file_for(domain),
                        'job_step': 'finalize',
                        'affected_months': [],
                        'error': None,
                        'finished_at': finished_at.replace(tzinfo=None),
                        'duration_sec': duration_sec,
                        'log': state_snap.get('log', [])[-200:],
                        'actor': actor,
                    },
                )
                logger.info('[sync:%s:%s] skipped_no_changes (pre-check)', domain, job_id)
                return
        max_rows = _max_rows_for_domain(domain)
        low_impact_mode = _is_low_impact_mode(mode)
        default_fetch_batch = _fetch_batch_size_for_domain(domain)
        effective_fetch_batch = _low_impact_fetch_batch_size(default_fetch_batch) if low_impact_mode else default_fetch_batch
        if low_impact_mode:
            _append_log(
                domain,
                (
                    'Modo protegido activo (micro-lotes): '
                    f'fetch_batch={effective_fetch_batch}, '
                    f'chunk_pause={int(getattr(settings, "sync_low_impact_chunk_pause_ms", 40) or 40)}ms'
                ),
            )
            _set_state(
                domain,
                {
                    'stage': 'normalizing',
                    'progress_pct': 35,
                    'status_message': 'Modo protegido activo: carga por micro-lotes',
                },
            )
        source_rows = 0
        _persist_job_step(db, job_id, domain, 'extract', 'completed', {'rows_read': 0})
        _persist_job_step(db, job_id, domain, 'normalize', 'running')
        _set_state(domain, {'stage': 'normalizing', 'progress_pct': 35, 'status_message': 'Normalizando filas'})

        normalized_rows: list[dict] = []
        source_months: set[str] = set()
        duplicates_detected = 0
        normalized_count = 0
        skipped_unchanged_chunks = 0
        chunk_signals: dict[str, dict] = {}
        wm_last_updated_at: datetime | None = None
        wm_last_source_id: str | None = None
        temp_rows_path: str | None = None
        temp_rows_file = None
        temp_rows_by_month: dict[str, str] = {}
        temp_file_by_month: dict[str, Any] = {}
        month_counts: dict[str, int] = {}
        # Stream large domains to disk to keep memory stable and show incremental progress.
        stream_to_disk_domains = {'cartera', 'cobranzas', 'contratos', 'gestores'}
        if low_impact_mode:
            stream_to_disk_domains.add('analytics')
        if domain in stream_to_disk_domains:
            if domain == 'cartera':
                temp_rows_path = None
            else:
                fd, temp_rows_path = tempfile.mkstemp(prefix=f'sync_{domain}_', suffix='.jsonl')
                os.close(fd)
                temp_rows_file = open(temp_rows_path, 'w', encoding='utf-8')
        seq = 0
        try:
            for batch in _iter_from_mysql(
                query_path,
                domain=domain,
                watermark_updated_at=wm_filter_updated_at,
                watermark_source_id=wm_filter_source_id or None,
                mysql_config=mysql_cfg,
                batch_size_override=effective_fetch_batch,
            ):
                _ensure_job_not_cancelled(db, job_id, domain)
                source_rows += len(batch)
                # Runtime resilience: never abort a running sync for size; process incrementally.
                hard_limit = None
                if hard_limit is not None and source_rows > hard_limit:
                    raise RuntimeError(
                        f'La consulta excede el maximo permitido ({hard_limit} filas). '
                        'Acota la query o ejecuta por anio.'
                    )
                norm_pct = min(74, 35 + int(source_rows / 25000))
                _set_state(
                    domain,
                    {
                        'stage': 'normalizing',
                        'progress_pct': norm_pct,
                        'status_message': f'Normalizando filas ({source_rows} leidas)',
                        'rows_read': source_rows,
                        'duplicates_detected': duplicates_detected,
                    },
                )
                for row in batch:
                    raw_updated_at, raw_source_id = _extract_source_markers(row)
                    n = _normalize_record(domain, row, seq)
                    seq += 1
                    if wm_filter_updated_at is not None and raw_updated_at is not None:
                        should_skip_by_watermark = raw_updated_at < wm_filter_updated_at
                        if (
                            not should_skip_by_watermark
                            and raw_updated_at == wm_filter_updated_at
                            and wm_filter_source_id
                            and raw_source_id
                        ):
                            try:
                                should_skip_by_watermark = int(raw_source_id) <= int(wm_filter_source_id)
                            except Exception:
                                should_skip_by_watermark = str(raw_source_id) <= str(wm_filter_source_id)
                        if should_skip_by_watermark:
                            watermark_filtered_rows += 1
                            continue
                    mode_month = str(n.get('close_month') or n.get('gestion_month') or '')
                    if domain != 'cartera':
                        mode_month = str(n.get('gestion_month') or '')
                    if not _matches_mode(mode_month, mode, year_from, close_month, range_months_set):
                        continue
                    source_months.add(n['gestion_month'])
                    if raw_updated_at is not None and (wm_last_updated_at is None or raw_updated_at > wm_last_updated_at):
                        wm_last_updated_at = raw_updated_at
                    if raw_source_id:
                        if wm_last_source_id is None:
                            wm_last_source_id = raw_source_id
                        else:
                            try:
                                if int(raw_source_id) > int(wm_last_source_id):
                                    wm_last_source_id = raw_source_id
                            except Exception:
                                if raw_source_id > wm_last_source_id:
                                    wm_last_source_id = raw_source_id
                    chunk_signals[n['gestion_month']] = _chunk_signal_update(chunk_signals.get(n['gestion_month']), n['source_hash'])
                    normalized_count += 1
                    month_key = str(n.get('gestion_month') or '')
                    if month_key:
                        month_counts[month_key] = month_counts.get(month_key, 0) + 1
                    if domain == 'cartera':
                        if month_key:
                            if month_key not in temp_file_by_month:
                                fd, path = tempfile.mkstemp(prefix=f'sync_{domain}_{month_key.replace("/", "_")}_', suffix='.jsonl')
                                os.close(fd)
                                temp_rows_by_month[month_key] = path
                                temp_file_by_month[month_key] = open(path, 'w', encoding='utf-8')
                            temp_file_by_month[month_key].write(json.dumps(n, ensure_ascii=False) + '\n')
                    elif temp_rows_file is not None:
                        temp_rows_file.write(json.dumps(n, ensure_ascii=False) + '\n')
                    else:
                        normalized_rows.append(n)
                if source_rows % 50000 == 0:
                    _append_log(
                        domain,
                        f'Normalizando... leidas={source_rows}, unicas={normalized_count}, duplicadas={duplicates_detected}',
                    )
        finally:
            if temp_rows_file is not None:
                temp_rows_file.close()
            for f in temp_file_by_month.values():
                try:
                    f.close()
                except Exception:
                    pass

        _append_log(domain, f'Filas fuente: {source_rows}')
        _persist_job_step(db, job_id, domain, 'normalize', 'completed', {'rows_read': source_rows, 'normalized': normalized_count})
        changed_months, skipped_unchanged_chunks = _reconcile_chunk_manifest(
            db,
            domain=domain,
            job_id=job_id,
            chunk_signals=chunk_signals,
        )
        _log_extract_chunk(
            db,
            job_id=job_id,
            domain=domain,
            chunk_key='*',
            stage='extract',
            status='completed',
            rows=normalized_count,
            duration_sec=round((datetime.now(timezone.utc) - started_at).total_seconds(), 2),
            details={
                'source_rows': source_rows,
                'months': sorted(source_months, key=_month_serial),
                'changed_months': sorted(changed_months, key=_month_serial),
                'skipped_unchanged_chunks': skipped_unchanged_chunks,
                'watermark_partition_key': partition_key,
                'watermark_filtered_rows': int(watermark_filtered_rows),
            },
        )
        detected_target_months = set(changed_months)
        target_months = set(detected_target_months)
        _set_state(
            domain,
            {
                'skipped_unchanged_chunks': int(skipped_unchanged_chunks),
                'chunk_status': 'changed' if target_months else 'unchanged',
                'chunk_key': ','.join(sorted(target_months, key=_month_serial)) if target_months else '*',
            },
        )
        if skipped_unchanged_chunks > 0:
            _append_log(domain, f'Chunks sin cambios detectados: {skipped_unchanged_chunks}')
        _ensure_cartera_partitions(db, target_months if domain == 'cartera' else set())
        if domain == 'cartera':
            _ensure_cartera_conflict_unique_index(db)

        _persist_job_step(db, job_id, domain, 'replace_window', 'running', {'months': sorted(target_months, key=_month_serial)})
        incremental_delta_mode = (str(mode or '').lower() == 'incremental' and wm_filter_updated_at is not None)
        _set_state(
            domain,
            {
                'stage': 'replacing_window',
                'progress_pct': 55,
                'status_message': 'Omitiendo replace window (incremental por watermark)' if incremental_delta_mode else 'Reemplazando ventana',
            },
        )
        if target_months and not incremental_delta_mode:
            _delete_target_window(db, domain, mode, year_from, target_months)
            _delete_target_window_fact(db, domain, mode, year_from, close_month, target_months)
        elif target_months and incremental_delta_mode:
            _append_log(domain, 'Incremental por watermark: se omite replace_window y se aplica UPSERT directo.')
        _persist_job_step(db, job_id, domain, 'replace_window', 'completed', {'months': sorted(target_months, key=_month_serial)})
        ordered_target_months = sorted(target_months, key=_month_serial)
        _set_state(domain, {'affected_months': ordered_target_months})
        _append_log(domain, f'Meses detectados (manifest): {", ".join(ordered_target_months) or "-"}')

        _persist_job_step(db, job_id, domain, 'upsert', 'running')
        _set_state(domain, {'stage': 'upserting', 'progress_pct': 75, 'status_message': 'Aplicando UPSERT'})
        persist_sync_records = _should_persist_sync_records(domain)
        persist_staging_rows = _should_persist_staging_rows()
        pre_fact_count = 0
        fact_model = FACT_TABLE_BY_DOMAIN.get(domain)
        if fact_model is not None:
            pre_fact_count = 1 if db.query(fact_model).first() is not None else 0
        rows_inserted = 0
        rows_upserted = 0
        rows_unchanged = 0
        applied_months: set[str] = set()
        processed_by_month: dict[str, int] = {}
        if temp_rows_path is not None or temp_rows_by_month:
            base_chunk_size = _adaptive_chunk_size(domain, int(settings.sync_fetch_batch_size or 5000))
            chunk_size = _low_impact_chunk_size(base_chunk_size) if low_impact_mode else base_chunk_size
            chunk_pause_seconds = _low_impact_chunk_pause_seconds() if low_impact_mode else 0.0
            processed = 0
            chunk: list[dict] = []

            def _apply_chunk(chunk_rows: list[dict], chunk_key: str) -> int:
                nonlocal rows_inserted, rows_upserted, rows_unchanged, duplicates_detected, processed, applied_months
                _ensure_job_not_cancelled(db, job_id, domain)
                if not chunk_rows:
                    return 0
                deduped_rows, chunk_duplicates = _dedupe_rows_in_chunk(chunk_rows)
                if not deduped_rows:
                    duplicates_detected += chunk_duplicates
                    return 0
                if getattr(settings, 'sync_postgres_prefilter_enabled', True) and deduped_rows:
                    deduped_rows = _filter_rows_changed_vs_postgres(db, domain, deduped_rows)
                if persist_staging_rows:
                    _persist_staging_rows(db, job_id, domain, chunk_key, deduped_rows, commit=False)
                if persist_sync_records:
                    rows_inserted += _upsert_sync_records(db, deduped_rows, commit=False)
                changed, unchanged = _upsert_fact_rows(db, domain, deduped_rows, commit=False)
                db.commit()
                rows_upserted += changed
                rows_unchanged += unchanged
                if changed > 0:
                    applied_months.update(
                        {
                            str(row.get('gestion_month') or '').strip()
                            for row in deduped_rows
                            if str(row.get('gestion_month') or '').strip()
                        }
                    )
                duplicates_detected += int(chunk_duplicates) + int(unchanged)
                processed += len(deduped_rows)
                if chunk_pause_seconds > 0:
                    time_sleep(chunk_pause_seconds)
                return len(deduped_rows)

            if domain == 'cartera' and temp_rows_by_month:
                ordered_months = sorted(
                    [m for m in month_counts.keys() if (not target_months or m in target_months)],
                    key=_month_serial,
                )
                for month_key in ordered_months:
                    month_path = temp_rows_by_month.get(month_key)
                    if not month_path:
                        continue
                    _append_log(domain, f'Procesando mes {month_key}...')
                    processed_by_month[month_key] = 0
                    with open(month_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            chunk.append(json.loads(line))
                            if len(chunk) >= chunk_size:
                                applied = _apply_chunk(chunk, month_key)
                                processed_by_month[month_key] = processed_by_month.get(month_key, 0) + applied
                                chunk = []
                                pct = 75 + int((processed / max(1, normalized_count)) * 20)
                                _set_state(
                                    domain,
                                    {
                                        'stage': 'upserting',
                                        'progress_pct': min(95, pct),
                                        'status_message': f'Aplicando UPSERT {month_key} ({processed_by_month.get(month_key, 0)}/{month_counts.get(month_key, 0)})',
                                        'rows_inserted': rows_inserted,
                                        'rows_read': source_rows,
                                        'rows_upserted': rows_upserted,
                                        'rows_unchanged': rows_unchanged,
                                        'target_table': _target_table_name(domain),
                                        'duplicates_detected': duplicates_detected,
                                    },
                                )
                    if chunk:
                        applied = _apply_chunk(chunk, month_key)
                        processed_by_month[month_key] = processed_by_month.get(month_key, 0) + applied
                        chunk = []
                    _append_log(
                        domain,
                        f'[OK] Mes {month_key} finalizado ({processed_by_month.get(month_key, 0)} filas, upsert={rows_upserted}, sin_cambios={rows_unchanged})',
                    )
                    pct = 75 + int((processed / max(1, normalized_count)) * 20)
                    _set_state(
                        domain,
                        {
                            'stage': 'upserting',
                            'progress_pct': min(95, pct),
                            'status_message': f'Mes {month_key} finalizado',
                            'rows_inserted': rows_inserted,
                            'rows_read': source_rows,
                            'rows_upserted': rows_upserted,
                            'rows_unchanged': rows_unchanged,
                            'target_table': _target_table_name(domain),
                            'duplicates_detected': duplicates_detected,
                        },
                    )
            else:
                with open(temp_rows_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        if not target_months:
                            continue
                        item = json.loads(line)
                        item_month = str(item.get('gestion_month') or '')
                        if target_months and item_month not in target_months:
                            continue
                        chunk.append(item)
                        if len(chunk) >= chunk_size:
                            _apply_chunk(chunk, _derive_chunk_key(chunk))
                            chunk = []
                            pct = 75 + int((processed / max(1, normalized_count)) * 20)
                            _set_state(
                                domain,
                                {
                                    'stage': 'upserting',
                                    'progress_pct': min(95, pct),
                                    'status_message': f'Aplicando UPSERT ({processed}/{normalized_count})',
                                    'rows_inserted': rows_inserted,
                                    'rows_read': source_rows,
                                    'rows_upserted': rows_upserted,
                                    'rows_unchanged': rows_unchanged,
                                    'target_table': _target_table_name(domain),
                                    'duplicates_detected': duplicates_detected,
                                },
                            )
                            if processed % 50000 == 0:
                                _append_log(
                                    domain,
                                    f'UPSERT... procesadas={processed}/{normalized_count}, upsert_destino={rows_upserted}, sin_cambios={rows_unchanged}',
                                )
                if chunk:
                    _apply_chunk(chunk, _derive_chunk_key(chunk))
                    chunk = []
                    _set_state(
                        domain,
                        {
                            'stage': 'upserting',
                            'progress_pct': 95,
                            'status_message': f'Aplicando UPSERT ({processed}/{normalized_count})',
                            'rows_inserted': rows_inserted,
                            'rows_read': source_rows,
                            'rows_upserted': rows_upserted,
                            'rows_unchanged': rows_unchanged,
                            'target_table': _target_table_name(domain),
                            'duplicates_detected': duplicates_detected,
                        },
                    )
                    _append_log(
                        domain,
                        f'UPSERT... procesadas={processed}/{normalized_count}, upsert_destino={rows_upserted}, sin_cambios={rows_unchanged}',
                    )
            try:
                if temp_rows_path:
                    os.remove(temp_rows_path)
            except Exception:
                pass
            for path in temp_rows_by_month.values():
                try:
                    os.remove(path)
                except Exception:
                    pass
        else:
            rows_for_upsert = normalized_rows
            if target_months:
                rows_for_upsert = [r for r in normalized_rows if str(r.get('gestion_month') or '') in target_months]
            else:
                rows_for_upsert = []
            rows_for_upsert, chunk_duplicates = _dedupe_rows_in_chunk(rows_for_upsert)
            duplicates_detected += chunk_duplicates
            if getattr(settings, 'sync_postgres_prefilter_enabled', True) and rows_for_upsert:
                rows_for_upsert = _filter_rows_changed_vs_postgres(db, domain, rows_for_upsert)
            if persist_sync_records:
                rows_inserted = _upsert_sync_records(db, rows_for_upsert, commit=False)
            rows_upserted, rows_unchanged = _upsert_fact_rows(db, domain, rows_for_upsert, commit=False)
            if rows_upserted > 0:
                applied_months.update(
                    {
                        str(r.get('gestion_month') or '').strip()
                        for r in rows_for_upsert
                        if str(r.get('gestion_month') or '').strip()
                    }
                )
            duplicates_detected += int(rows_unchanged)
            if persist_staging_rows:
                _persist_staging_rows(db, job_id, domain, _derive_chunk_key(rows_for_upsert), rows_for_upsert, commit=False)
            db.commit()
            _set_state(
                domain,
                {
                    'rows_inserted': rows_inserted,
                    'rows_read': source_rows,
                    'rows_upserted': rows_upserted,
                    'rows_unchanged': rows_unchanged,
                    'target_table': _target_table_name(domain),
                    'duplicates_detected': duplicates_detected,
                },
            )
        _persist_job_step(
            db,
            job_id,
            domain,
            'upsert',
            'completed',
            {
                'rows_inserted': rows_inserted,
                'rows_upserted': rows_upserted,
                'rows_unchanged': rows_unchanged,
            },
        )
        refresh_target_months: set[str] = set(detected_target_months)
        if not refresh_target_months and rows_upserted > 0:
            refresh_target_months = set(applied_months)
        if not refresh_target_months and normalized_count > 0 and pre_fact_count == 0:
            refresh_target_months = set(source_months)
        ordered_refresh_target_months = sorted(refresh_target_months, key=_month_serial)
        _set_state(
            domain,
            {
                'affected_months': ordered_refresh_target_months,
                'refresh_target_months': ordered_refresh_target_months,
            },
        )
        _append_log(
            domain,
            (
                f'Meses aplicados: {", ".join(sorted(applied_months, key=_month_serial)) or "-"} | '
                f'Meses refresh: {", ".join(ordered_refresh_target_months) or "-"}'
            ),
        )
        if domain == 'analytics':
            _persist_job_step(db, job_id, domain, 'refresh_snapshot', 'running')
            _set_state(domain, {'stage': 'refreshing_snapshot', 'progress_pct': 88, 'status_message': 'Actualizando snapshot analytics'})
            _refresh_analytics_snapshot(db, mode, year_from, refresh_target_months, normalized_rows)
            _persist_job_step(db, job_id, domain, 'refresh_snapshot', 'completed')

        agg_rows_written = 0
        agg_duration_sec = None
        if domain in {'cartera', 'cobranzas', 'analytics'}:
            agg_started_at = datetime.now(timezone.utc)
            _persist_job_step(db, job_id, domain, 'refresh_agg', 'running')
            _ensure_agg_perf_indexes(db)
            _set_state(
                domain,
                {
                    'stage': 'refreshing_corte_agg',
                    'progress_pct': 96,
                    'status_message': 'Recalculando agregados de corte',
                    'agg_refresh_started': True,
                    'agg_refresh_completed': False,
                },
            )
            if domain in {'cartera', 'cobranzas'}:
                _append_log(domain, 'Iniciando recalculo de cartera_corte_agg...')
                _set_state(
                    domain,
                    {
                        'stage': 'refreshing_corte_agg',
                        'progress_pct': 96,
                        'status_message': 'Recalculando cartera_corte_agg',
                    },
                )
                corte_started_at = datetime.now(timezone.utc)
                deleted_agg, agg_rows_written = _refresh_cartera_corte_agg(db, refresh_target_months)
                corte_duration_sec = round((datetime.now(timezone.utc) - corte_started_at).total_seconds(), 2)
                _append_log(
                    domain,
                    (
                        f'cartera_corte_agg listo: borradas={deleted_agg}, '
                        f'insertadas={agg_rows_written}, duracion={corte_duration_sec}s'
                    ),
                )
                _set_state(
                    domain,
                    {
                        'stage': 'refreshing_corte_agg',
                        'progress_pct': 97,
                        'status_message': 'Recalculando cohorte de cobranzas',
                    },
                )
                cohorte_started_at = datetime.now(timezone.utc)
                deleted_cohorte, cohorte_rows_written = _refresh_cobranzas_cohorte_agg(db, refresh_target_months)
                cohorte_duration_sec = round((datetime.now(timezone.utc) - cohorte_started_at).total_seconds(), 2)
                agg_rows_written += int(cohorte_rows_written)
                _append_log(
                    domain,
                    (
                        f'cohorte_agg listo: borradas={deleted_cohorte}, '
                        f'insertadas={cohorte_rows_written}, duracion={cohorte_duration_sec}s'
                    ),
                )
            else:
                deleted_agg = 0
                deleted_cohorte = 0
                cohorte_rows_written = 0

            _set_state(
                domain,
                {
                    'stage': 'refreshing_corte_agg',
                    'progress_pct': 97,
                    'status_message': 'Actualizando capa semantica analytics',
                },
            )
            deleted_dim = 0
            dim_rows_written = 0
            deleted_rend = 0
            rend_rows_written = 0
            deleted_anuales = 0
            anuales_rows_written = 0
            deleted_dim_contract = 0
            dim_contract_rows_written = 0
            deleted_dim_time = 0
            dim_time_rows_written = 0
            options_rows: dict[str, int] = {'cartera': 0, 'cohorte': 0, 'rendimiento': 0, 'anuales': 0}

            semantic_batches = _semantic_refresh_month_batches(refresh_target_months)
            total_batches = len(semantic_batches)
            for idx, months_batch in enumerate(semantic_batches, start=1):
                batch_set = set(months_batch)
                batch_label = months_batch[0] if len(months_batch) == 1 else f'{months_batch[0]}..{months_batch[-1]}'
                _set_state(
                    domain,
                    {
                        'stage': 'refreshing_corte_agg',
                        'progress_pct': 97,
                        'status_message': f'Actualizando capa semantica analytics ({idx}/{total_batches})',
                    },
                )
                _append_log(domain, f'Capa analytics lote {idx}/{total_batches}: meses={batch_label}')
                b_deleted_dim, b_dim_rows = _refresh_dim_negocio_contrato(db, batch_set)
                b_deleted_rend, b_rend_rows = _refresh_analytics_rendimiento_agg(db, batch_set)
                b_deleted_dim_contract, b_dim_contract_rows = _refresh_dim_contract_month_and_catalogs(db, batch_set)
                b_deleted_dim_time, b_dim_time_rows = _refresh_dim_time(db, batch_set)
                b_options_rows = _refresh_mv_options_tables(db, batch_set)

                deleted_dim += int(b_deleted_dim or 0)
                dim_rows_written += int(b_dim_rows or 0)
                deleted_rend += int(b_deleted_rend or 0)
                rend_rows_written += int(b_rend_rows or 0)
                deleted_dim_contract += int(b_deleted_dim_contract or 0)
                dim_contract_rows_written += int(b_dim_contract_rows or 0)
                deleted_dim_time += int(b_deleted_dim_time or 0)
                dim_time_rows_written += int(b_dim_time_rows or 0)
                options_rows['cartera'] += int((b_options_rows or {}).get('cartera', 0))
                options_rows['cohorte'] += int((b_options_rows or {}).get('cohorte', 0))
                options_rows['rendimiento'] += int((b_options_rows or {}).get('rendimiento', 0))
                options_rows['anuales'] += int((b_options_rows or {}).get('anuales', 0))

            latest_month_set = {ordered_refresh_target_months[-1]} if ordered_refresh_target_months else set()
            deleted_anuales, anuales_rows_written = _refresh_analytics_anuales_agg(db, latest_month_set)
            options_consistency = _mv_options_consistency_report(db)
            options_rebuilt_rows: dict[str, int] = {'cartera': 0, 'cohorte': 0, 'rendimiento': 0, 'anuales': 0}
            if not bool(options_consistency.get('ok')):
                options_rebuilt_rows = _bootstrap_mv_options_full(db)
                options_consistency = _mv_options_consistency_report(db)
                _append_log(
                    domain,
                    (
                        'Autorebuild options ejecutado por inconsistencia: '
                        f'cartera={options_rebuilt_rows.get("cartera", 0)}, '
                        f'cohorte={options_rebuilt_rows.get("cohorte", 0)}, '
                        f'rendimiento={options_rebuilt_rows.get("rendimiento", 0)}, '
                        f'anuales={options_rebuilt_rows.get("anuales", 0)}, '
                        f'ok={options_consistency.get("ok")}'
                    ),
                )
            agg_rows_written += (
                int(dim_rows_written)
                + int(rend_rows_written)
                + int(anuales_rows_written)
                + int(dim_contract_rows_written)
                + int(dim_time_rows_written)
                + int(options_rows.get('cartera', 0))
                + int(options_rows.get('cohorte', 0))
                + int(options_rows.get('rendimiento', 0))
                + int(options_rows.get('anuales', 0))
                + int(options_rebuilt_rows.get('cartera', 0))
                + int(options_rebuilt_rows.get('cohorte', 0))
                + int(options_rebuilt_rows.get('rendimiento', 0))
                + int(options_rebuilt_rows.get('anuales', 0))
            )
            agg_duration_sec = round((datetime.now(timezone.utc) - agg_started_at).total_seconds(), 2)
            _set_state(
                domain,
                {
                    'stage': 'refreshing_corte_agg',
                    'progress_pct': 98,
                    'status_message': 'Finalizando agregados de corte',
                    'agg_refresh_completed': True,
                    'agg_rows_written': int(agg_rows_written),
                    'agg_duration_sec': agg_duration_sec,
                },
            )
            _append_log(
                domain,
                (
                    'Capa analytics actualizada: '
                    f'dim_borradas={deleted_dim}, dim_insertadas={dim_rows_written}, '
                    f'rend_borradas={deleted_rend}, rend_insertadas={rend_rows_written}, '
                    f'anuales_borradas={deleted_anuales}, anuales_insertadas={anuales_rows_written}, '
                    f'dim_contract_borradas={deleted_dim_contract}, dim_contract_insertadas={dim_contract_rows_written}, '
                    f'dim_time_borradas={deleted_dim_time}, dim_time_insertadas={dim_time_rows_written}, '
                    f'options_cartera={options_rows.get("cartera", 0)}, '
                    f'options_cohorte={options_rows.get("cohorte", 0)}, '
                    f'options_rend={options_rows.get("rendimiento", 0)}, '
                    f'options_anuales={options_rows.get("anuales", 0)}, '
                    f'options_consistency_ok={options_consistency.get("ok")}'
                ),
            )
            _append_log(
                domain,
                (
                    f'Agregados actualizados: cartera_borradas={deleted_agg}, '
                    f'cohorte_borradas={deleted_cohorte}, cohorte_insertadas={cohorte_rows_written}, '
                    f'total_insertadas={agg_rows_written}, duracion={agg_duration_sec}s'
                ),
            )
            if domain in {'cartera', 'cobranzas'} and rows_upserted > 0 and int(agg_rows_written) == 0:
                fallback_months = set(source_months) or set(applied_months)
                _persist_job_step(
                    db,
                    job_id,
                    domain,
                    'refresh_agg_fallback',
                    'running',
                    {'months': sorted(fallback_months, key=_month_serial)},
                )
                _append_log(
                    domain,
                    (
                        'Guardrail activado: rows_upserted>0 y agg_rows_written=0. '
                        f'Reintentando refresh con meses={", ".join(sorted(fallback_months, key=_month_serial)) or "-"}'
                    ),
                )
                if fallback_months:
                    fb_deleted_agg, fb_agg_rows = _refresh_cartera_corte_agg(db, fallback_months)
                    fb_deleted_cohorte, fb_cohorte_rows = _refresh_cobranzas_cohorte_agg(db, fallback_months)
                    fb_deleted_dim, fb_dim_rows = _refresh_dim_negocio_contrato(db, fallback_months)
                    fb_deleted_rend, fb_rend_rows = _refresh_analytics_rendimiento_agg(db, fallback_months)
                    fb_deleted_anuales, fb_anuales_rows = _refresh_analytics_anuales_agg(db, fallback_months)
                    fb_deleted_dim_contract, fb_dim_contract_rows = _refresh_dim_contract_month_and_catalogs(db, fallback_months)
                    fb_deleted_dim_time, fb_dim_time_rows = _refresh_dim_time(db, fallback_months)
                    fb_options_rows = _refresh_mv_options_tables(db, fallback_months)
                    agg_rows_written = (
                        int(fb_agg_rows)
                        + int(fb_cohorte_rows)
                        + int(fb_dim_rows)
                        + int(fb_rend_rows)
                        + int(fb_anuales_rows)
                        + int(fb_dim_contract_rows)
                        + int(fb_dim_time_rows)
                        + int(fb_options_rows.get('cartera', 0))
                        + int(fb_options_rows.get('cohorte', 0))
                        + int(fb_options_rows.get('rendimiento', 0))
                        + int(fb_options_rows.get('anuales', 0))
                    )
                    refresh_target_months = set(fallback_months)
                    ordered_refresh_target_months = sorted(refresh_target_months, key=_month_serial)
                    _set_state(
                        domain,
                        {
                            'affected_months': ordered_refresh_target_months,
                            'refresh_target_months': ordered_refresh_target_months,
                            'agg_rows_written': int(agg_rows_written),
                        },
                    )
                    _append_log(
                        domain,
                        (
                            'Fallback refresh completado: '
                            f'cartera_borradas={fb_deleted_agg}, cohorte_borradas={fb_deleted_cohorte}, '
                            f'dim_borradas={fb_deleted_dim}, rend_borradas={fb_deleted_rend}, '
                            f'anuales_borradas={fb_deleted_anuales}, dim_contract_borradas={fb_deleted_dim_contract}, '
                            f'dim_time_borradas={fb_deleted_dim_time}, total_insertadas={agg_rows_written}'
                        ),
                    )
                _persist_job_step(
                    db,
                    job_id,
                    domain,
                    'refresh_agg_fallback',
                    'completed',
                    {
                        'months': sorted(fallback_months, key=_month_serial),
                        'agg_rows_written': int(agg_rows_written),
                    },
                )
            _persist_job_step(
                db,
                job_id,
                domain,
                'refresh_agg',
                'completed',
                {'agg_rows_written': int(agg_rows_written), 'agg_duration_sec': agg_duration_sec},
            )

        _persist_job_step(db, job_id, domain, 'analyze', 'running')
        _set_state(domain, {'stage': 'analyzing', 'progress_pct': 98, 'status_message': 'Actualizando estadisticas (ANALYZE)'})
        _analyze_after_sync(db, domain)
        _persist_job_step(db, job_id, domain, 'analyze', 'completed')

        finished_at = datetime.now(timezone.utc)
        duration_sec = round((finished_at - started_at).total_seconds(), 2)
        log = list((_state_by_domain.get(domain) or {}).get('log') or [])
        log.append(f'Filas aplicadas: {rows_inserted}')
        log.append(f'Filas upsert tabla destino: {rows_upserted}')
        log.append(f'Filas sin cambios tabla destino: {rows_unchanged}')
        log.append(f'Duplicados detectados en fuente: {duplicates_detected}')
        log.append(f'Fin: {finished_at.isoformat()}')

        final_state = {
            'job_id': job_id,
            'domain': domain,
            'mode': mode,
            'year_from': year_from,
            'close_month': close_month,
            'close_month_from': close_month_from,
            'close_month_to': close_month_to,
            'running': False,
            'stage': 'completed',
            'progress_pct': 100,
            'status_message': 'Sincronizacion finalizada',
            'rows_inserted': rows_inserted,
            'rows_updated': 0,
            'rows_skipped': int(skipped_unchanged_chunks),
            'rows_read': source_rows,
            'rows_upserted': rows_upserted,
            'rows_unchanged': rows_unchanged,
            'throughput_rows_per_sec': float((_state_by_domain.get(domain) or {}).get('throughput_rows_per_sec') or 0.0),
            'eta_seconds': 0,
            'current_query_file': _query_file_for(domain),
            'job_step': 'finalize',
            'chunk_status': 'changed' if ordered_refresh_target_months else 'unchanged',
            'chunk_key': ','.join(ordered_refresh_target_months) if ordered_refresh_target_months else '*',
            'skipped_unchanged_chunks': int(skipped_unchanged_chunks),
            'affected_months': ordered_refresh_target_months,
            'target_table': _target_table_name(domain),
            'agg_refresh_started': domain in {'cartera', 'cobranzas'},
            'agg_refresh_completed': domain in {'cartera', 'cobranzas'},
            'agg_rows_written': int(agg_rows_written),
            'agg_duration_sec': agg_duration_sec,
            'duplicates_detected': duplicates_detected,
            'error': None,
            'log': log[-200:],
            'started_at': started_at.isoformat(),
            'finished_at': finished_at.isoformat(),
            'duration_sec': duration_sec,
        }
        _set_state(domain, final_state)
        _persist_job_step(db, job_id, domain, 'bootstrap', 'completed')
        _persist_job_step(db, job_id, domain, 'finalize', 'completed', {'duration_sec': duration_sec})
        partition_key = _watermark_partition_key(mode, year_from, close_month, close_month_from, close_month_to)
        _upsert_watermark(
            db,
            domain=domain,
            query_file=_query_file_for(domain),
            partition_key=partition_key,
            last_updated_at=wm_last_updated_at,
            last_source_id=wm_last_source_id,
            last_success_job_id=job_id,
            last_row_count=rows_upserted + rows_unchanged,
        )
        _refresh_source_freshness_snapshots(db, last_job_id=job_id)
        cleaned_stg = _cleanup_staging_rows(db)
        if cleaned_stg > 0:
            _append_log(domain, f'Limpieza staging: {cleaned_stg} filas antiguas removidas')
        if domain == 'cartera':
            invalidated_options = invalidate_prefix('portfolio/options')
            invalidated_summary = invalidate_prefix('portfolio/summary')
            invalidated_rend_v2_options = invalidate_endpoint('rendimiento-v2/options', lambda _: True)
            invalidated_rend_v2_summary = invalidate_endpoint('rendimiento-v2/summary', lambda _: True)
            invalidated_anuales_v2_options = invalidate_endpoint('anuales-v2/options', lambda _: True)
            invalidated_anuales_v2_summary = invalidate_endpoint('anuales-v2/summary', lambda _: True)
            invalidated_portfolio_fp = invalidate_endpoint('portfolio-corte-v2/first-paint', lambda _: True)
            invalidated_rend_v2_fp = invalidate_endpoint('rendimiento-v2/first-paint', lambda _: True)
            invalidated_anuales_v2_fp = invalidate_endpoint('anuales-v2/first-paint', lambda _: True)
            invalidated_cohorte_v2_fp = invalidate_endpoint('cobranzas-cohorte-v2/first-paint', lambda _: True)
            invalidated_cohorte_v2_detail = invalidate_endpoint('cobranzas-cohorte-v2/detail', lambda _: True)
            target_months_set = set(ordered_refresh_target_months)
            invalidated_corte_options = invalidate_endpoint(
                'portfolio/corte/options',
                lambda _: True,
            )
            invalidated_corte_v2_options = invalidate_endpoint('portfolio-corte-v2/options', lambda _: True)
            invalidated_corte_summary = invalidate_endpoint(
                'portfolio/corte/summary',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('gestion_month')
                    or bool(set(filters.get('gestion_month') or []).intersection(target_months_set))
                ),
            )
            invalidated_corte_v2_summary = invalidate_endpoint('portfolio-corte-v2/summary', lambda _: True)
            _append_log(
                domain,
                (
                    'Cache invalido: '
                    f'portfolio/options={invalidated_options}, '
                    f'portfolio/summary={invalidated_summary}, '
                    f'portfolio/corte/options={invalidated_corte_options}, '
                    f'portfolio-corte-v2/options={invalidated_corte_v2_options}, '
                    f'portfolio/corte/summary={invalidated_corte_summary}, '
                    f'portfolio-corte-v2/summary={invalidated_corte_v2_summary}, '
                    f'portfolio-corte-v2/first-paint={invalidated_portfolio_fp}, '
                    f'rendimiento-v2/options={invalidated_rend_v2_options}, '
                    f'rendimiento-v2/summary={invalidated_rend_v2_summary}, '
                    f'rendimiento-v2/first-paint={invalidated_rend_v2_fp}, '
                    f'anuales-v2/options={invalidated_anuales_v2_options}, '
                    f'anuales-v2/summary={invalidated_anuales_v2_summary}, '
                    f'anuales-v2/first-paint={invalidated_anuales_v2_fp}, '
                    f'cobranzas-cohorte-v2/first-paint={invalidated_cohorte_v2_fp}, '
                    f'cobranzas-cohorte-v2/detail={invalidated_cohorte_v2_detail}'
                ),
            )
        if domain == 'cobranzas':
            target_months_set = set(ordered_refresh_target_months)
            invalidated_rend_v2_summary = invalidate_endpoint('rendimiento-v2/summary', lambda _: True)
            invalidated_anuales_v2_summary = invalidate_endpoint('anuales-v2/summary', lambda _: True)
            invalidated_corte_options = invalidate_endpoint('portfolio/corte/options', lambda _: True)
            invalidated_corte_v2_options = invalidate_endpoint('portfolio-corte-v2/options', lambda _: True)
            invalidated_corte_summary = invalidate_endpoint(
                'portfolio/corte/summary',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('gestion_month')
                    or bool(set(filters.get('gestion_month') or []).intersection(target_months_set))
                ),
            )
            invalidated_corte_v2_summary = invalidate_endpoint('portfolio-corte-v2/summary', lambda _: True)
            invalidated_cohorte_summary = invalidate_endpoint(
                'cobranzas-cohorte/summary',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('cutoff_month')
                    or str(filters.get('cutoff_month')) in target_months_set
                ),
            )
            invalidated_cohorte_options = invalidate_endpoint('cobranzas-cohorte/options', lambda _: True)
            invalidated_cohorte_v2_options = invalidate_endpoint('cobranzas-cohorte-v2/options', lambda _: True)
            invalidated_cohorte_v2_fp = invalidate_endpoint(
                'cobranzas-cohorte-v2/first-paint',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('cutoff_month')
                    or str(filters.get('cutoff_month')) in target_months_set
                ),
            )
            invalidated_cohorte_v2_detail = invalidate_endpoint(
                'cobranzas-cohorte-v2/detail',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('cutoff_month')
                    or str(filters.get('cutoff_month')) in target_months_set
                ),
            )
            invalidated_rend_v2_fp = invalidate_endpoint('rendimiento-v2/first-paint', lambda _: True)
            invalidated_anuales_v2_fp = invalidate_endpoint('anuales-v2/first-paint', lambda _: True)
            try:
                cohorte_base_cache_clear()
            except Exception:
                pass
            _append_log(
                domain,
                (
                    'Cache invalido: '
                    f'portfolio/corte/options={invalidated_corte_options}, '
                    f'portfolio-corte-v2/options={invalidated_corte_v2_options}, '
                    f'portfolio/corte/summary={invalidated_corte_summary}, '
                    f'portfolio-corte-v2/summary={invalidated_corte_v2_summary}, '
                    f'cobranzas-cohorte/options={invalidated_cohorte_options}, '
                    f'cobranzas-cohorte-v2/options={invalidated_cohorte_v2_options}, '
                    f'cobranzas-cohorte/summary={invalidated_cohorte_summary}, '
                    f'cobranzas-cohorte-v2/first-paint={invalidated_cohorte_v2_fp}, '
                    f'cobranzas-cohorte-v2/detail={invalidated_cohorte_v2_detail}, '
                    f'rendimiento-v2/summary={invalidated_rend_v2_summary}, '
                    f'rendimiento-v2/first-paint={invalidated_rend_v2_fp}, '
                    f'anuales-v2/summary={invalidated_anuales_v2_summary}, '
                    f'anuales-v2/first-paint={invalidated_anuales_v2_fp}'
                ),
            )
        if domain == 'analytics':
            invalidated_rend_v2_options = invalidate_endpoint('rendimiento-v2/options', lambda _: True)
            invalidated_rend_v2_summary = invalidate_endpoint('rendimiento-v2/summary', lambda _: True)
            invalidated_anuales_v2_options = invalidate_endpoint('anuales-v2/options', lambda _: True)
            invalidated_anuales_v2_summary = invalidate_endpoint('anuales-v2/summary', lambda _: True)
            invalidated_rend_v2_fp = invalidate_endpoint('rendimiento-v2/first-paint', lambda _: True)
            invalidated_anuales_v2_fp = invalidate_endpoint('anuales-v2/first-paint', lambda _: True)
            invalidated_corte_v2_options = invalidate_endpoint('portfolio-corte-v2/options', lambda _: True)
            invalidated_corte_v2_summary = invalidate_endpoint('portfolio-corte-v2/summary', lambda _: True)
            _append_log(
                domain,
                (
                    'Cache invalido: '
                    f'rendimiento-v2/options={invalidated_rend_v2_options}, '
                    f'rendimiento-v2/summary={invalidated_rend_v2_summary}, '
                    f'rendimiento-v2/first-paint={invalidated_rend_v2_fp}, '
                    f'anuales-v2/options={invalidated_anuales_v2_options}, '
                    f'anuales-v2/summary={invalidated_anuales_v2_summary}, '
                    f'anuales-v2/first-paint={invalidated_anuales_v2_fp}, '
                    f'portfolio-corte-v2/options={invalidated_corte_v2_options}, '
                    f'portfolio-corte-v2/summary={invalidated_corte_v2_summary}'
                ),
            )
        _prewarm_analytics_cache_after_sync(db, domain)
        logger.info(
            '[sync:%s:%s] completed rows_inserted=%s duplicates=%s duration_sec=%s',
            domain,
            job_id,
            rows_inserted,
            duplicates_detected,
            duration_sec,
        )
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'running': False,
                'stage': 'completed',
                'progress_pct': 100,
                'status_message': 'Sincronizacion finalizada',
                'rows_inserted': rows_inserted,
                'rows_updated': 0,
                'rows_skipped': int(skipped_unchanged_chunks),
                'rows_read': source_rows,
                'rows_upserted': rows_upserted,
                'rows_unchanged': rows_unchanged,
                'throughput_rows_per_sec': float((_state_by_domain.get(domain) or {}).get('throughput_rows_per_sec') or 0.0),
                'eta_seconds': 0,
                'current_query_file': _query_file_for(domain),
                'job_step': 'finalize',
                'chunk_status': 'changed' if ordered_refresh_target_months else 'unchanged',
                'chunk_key': ','.join(ordered_refresh_target_months) if ordered_refresh_target_months else '*',
                'skipped_unchanged_chunks': int(skipped_unchanged_chunks),
                'affected_months': ordered_refresh_target_months,
                'target_table': _target_table_name(domain),
                'agg_refresh_started': domain in {'cartera', 'cobranzas'},
                'agg_refresh_completed': domain in {'cartera', 'cobranzas'},
                'agg_rows_written': int(agg_rows_written),
                'agg_duration_sec': agg_duration_sec,
                'duplicates_detected': duplicates_detected,
                'error': None,
                'finished_at': finished_at.replace(tzinfo=None),
                'duration_sec': duration_sec,
                'log': final_state['log'],
                'actor': actor,
            },
        )
    except Exception as exc:
        finished_at = datetime.now(timezone.utc)
        duration_sec = round((finished_at - started_at).total_seconds(), 2)
        error = str(exc)
        _append_log(domain, f'Error: {error}')
        logger.exception('[sync:%s:%s] failed: %s', domain, job_id, error)
        try:
            db.rollback()
        except Exception:
            pass
        state_snapshot = dict(_state_by_domain.get(domain) or {})
        is_cancelled = isinstance(exc, SyncCancelledError) or str(error).lower() in {'cancelled', 'cancelled_by_user'}
        failed_state = {
            'running': False,
            'stage': 'cancelled' if is_cancelled else 'failed',
            'progress_pct': 100,
            'status_message': 'Sincronizacion cancelada' if is_cancelled else 'Sincronizacion con error',
            'rows_skipped': int(state_snapshot.get('rows_skipped') or 0),
            'skipped_unchanged_chunks': int(state_snapshot.get('skipped_unchanged_chunks') or 0),
            'chunk_key': state_snapshot.get('chunk_key'),
            'chunk_status': 'cancelled' if is_cancelled else 'failed',
            'error': None if is_cancelled else error,
            'finished_at': finished_at.isoformat(),
            'duration_sec': duration_sec,
        }
        _set_state(domain, failed_state)
        failed_step = _job_step_from_stage((_state_by_domain.get(domain) or {}).get('stage')) or 'bootstrap'
        _persist_job_step(db, job_id, domain, failed_step, 'cancelled' if is_cancelled else 'failed', {'error': error})
        _persist_sync_run(
            db,
            {
                'job_id': job_id,
                'domain': domain,
                'mode': mode,
                'year_from': year_from,
                'close_month': close_month,
                'close_month_from': close_month_from,
                'close_month_to': close_month_to,
                'target_table': _target_table_name(domain),
                'running': False,
                'stage': 'cancelled' if is_cancelled else 'failed',
                'progress_pct': 100,
                'status_message': 'Sincronizacion cancelada' if is_cancelled else 'Sincronizacion con error',
                'rows_inserted': int(state_snapshot.get('rows_inserted') or 0),
                'rows_updated': 0,
                'rows_skipped': int(state_snapshot.get('rows_skipped') or 0),
                'rows_read': int(state_snapshot.get('rows_read') or 0),
                'rows_upserted': int(state_snapshot.get('rows_upserted') or 0),
                'rows_unchanged': int(state_snapshot.get('rows_unchanged') or 0),
                'throughput_rows_per_sec': float(state_snapshot.get('throughput_rows_per_sec') or 0.0),
                'eta_seconds': 0,
                'current_query_file': _query_file_for(domain),
                'job_step': 'cancelled' if is_cancelled else 'failed',
                'chunk_status': 'cancelled' if is_cancelled else 'failed',
                'chunk_key': state_snapshot.get('chunk_key'),
                'skipped_unchanged_chunks': int(state_snapshot.get('skipped_unchanged_chunks') or 0),
                'error': None if is_cancelled else error,
                'finished_at': finished_at.replace(tzinfo=None),
                'duration_sec': duration_sec,
                'log': list((_state_by_domain.get(domain) or {}).get('log') or []),
                'actor': actor,
            },
        )
    finally:
        db.close()
        with _state_lock:
            _running_by_domain.discard(domain)


class SyncService:
    @staticmethod
    def resolve_mode(
        domain: str,
        year_from: int | None,
        close_month: str | None,
        close_month_from: str | None,
        close_month_to: str | None,
    ) -> str:
        if domain == 'cartera' and close_month_from and close_month_to:
            if close_month_from == close_month_to:
                return 'full_month'
            return 'range_months'
        if domain == 'cartera' and close_month:
            return 'full_month'
        return 'full_year' if year_from is not None else 'full_all'

    @staticmethod
    def start(
        domain: str,
        year_from: int | None,
        close_month: str | None,
        close_month_from: str | None,
        close_month_to: str | None,
        actor: str,
    ) -> dict:
        mode = SyncService.resolve_mode(domain, year_from, close_month, close_month_from, close_month_to)
        if bool(getattr(settings, 'sync_safe_mode', True)) and mode == 'full_all' and not _domain_has_effective_limit(domain):
            raise RuntimeError(
                f'Modo seguro activo: no se permite full_all para {domain} sin limite de filas (SYNC_MAX_ROWS o SYNC_MAX_ROWS_{domain.upper()}).'
            )
        if mode == 'full_month' and close_month_from and close_month_to and close_month_from == close_month_to:
            close_month = close_month_from
        job_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()
        db = SessionLocal()
        try:
            if _queue_has_manual_running_or_pending(db):
                raise RuntimeError('Ya existe una sincronizacion en curso')
            _queue_job(
                db,
                job_id=job_id,
                domain=domain,
                mode=mode,
                actor=actor,
                year_from=year_from,
                close_month=close_month,
                close_month_from=close_month_from,
                close_month_to=close_month_to,
            )
            _persist_sync_run(
                db,
                {
                    'job_id': job_id,
                    'domain': domain,
                    'mode': mode,
                    'year_from': year_from,
                    'close_month': close_month,
                    'target_table': _target_table_name(domain),
                    'running': True,
                    'stage': 'queued',
                    'progress_pct': 0,
                    'status_message': 'Sincronizacion en cola',
                    'rows_inserted': 0,
                    'rows_updated': 0,
                    'rows_skipped': 0,
                    'rows_read': 0,
                    'rows_upserted': 0,
                    'rows_unchanged': 0,
                    'throughput_rows_per_sec': 0.0,
                    'eta_seconds': None,
                    'current_query_file': _query_file_for(domain),
                    'job_step': 'queued',
                    'duplicates_detected': 0,
                    'error': None,
                    'started_at': datetime.utcnow(),
                    'finished_at': None,
                    'duration_sec': None,
                    'log': ['Estado: sincronizacion encolada. Esperando worker...'],
                    'actor': actor,
                },
            )
        finally:
            db.close()
        return {
            'job_id': job_id,
            'domain': domain,
            'mode': mode,
            'year_from': year_from,
            'close_month': close_month,
            'close_month_from': close_month_from,
            'close_month_to': close_month_to,
            'target_table': _target_table_name(domain),
            'started_at': started_at,
            'status': 'accepted',
        }

    @staticmethod
    def preview(
        domain: str,
        year_from: int | None,
        close_month: str | None,
        close_month_from: str | None,
        close_month_to: str | None,
        *,
        sampled: bool = False,
        sample_rows: int | None = None,
        timeout_seconds: int | None = None,
    ) -> dict:
        if not settings.sync_preview_enabled:
            raise RuntimeError('Preview de sincronizacion deshabilitado por configuracion.')
        mode = SyncService.resolve_mode(domain, year_from, close_month, close_month_from, close_month_to)
        if mode == 'full_month' and close_month_from and close_month_to and close_month_from == close_month_to:
            close_month = close_month_from
        range_months = _month_range(close_month_from or '', close_month_to or '') if mode == 'range_months' else []
        range_months_set = set(range_months)
        query_path = _query_path_for(domain)
        if not query_path.exists():
            raise RuntimeError(f'No existe query para dominio {domain}: {query_path.name}')
        partition_key = _watermark_partition_key(mode, year_from, close_month, close_month_from, close_month_to)
        wm_updated_at = None
        wm_source_id = None
        mysql_cfg = _resolve_mysql_connection_config(None)
        db = SessionLocal()
        try:
            wm = _get_watermark(
                db,
                domain=domain,
                query_file=_query_file_for(domain),
                partition_key=partition_key,
            )
            if wm is not None:
                wm_updated_at = wm.last_updated_at
                wm_source_id = str(wm.last_source_id or '').strip() or None
            mysql_cfg = _resolve_mysql_connection_config(db)
        finally:
            db.close()
        max_rows = _max_rows_for_domain(domain)
        estimated = 0
        scan_mode = 'sampled' if sampled else 'full'
        effective_sample_rows = int(sample_rows or settings.sync_preview_sample_rows or 20000)
        effective_sample_rows = max(1000, min(200000, effective_sample_rows))
        effective_timeout_sec = int(timeout_seconds or settings.sync_preview_sample_timeout_seconds or 8)
        effective_timeout_sec = max(2, min(60, effective_timeout_sec))
        scan_start = monotonic()
        sample_cutoff = effective_sample_rows if sampled else None
        seq = 0
        for batch in _iter_from_mysql(
            query_path,
            domain=domain,
            watermark_updated_at=wm_updated_at,
            watermark_source_id=wm_source_id,
            mysql_config=mysql_cfg,
        ):
            for row in batch:
                try:
                    n = _normalize_record(domain, row, seq)
                except Exception as norm_e:
                    raise
                seq += 1
                mode_month = str(n.get('close_month') or n.get('gestion_month') or '')
                if domain != 'cartera':
                    mode_month = str(n.get('gestion_month') or '')
                if not _matches_mode(mode_month, mode, year_from, close_month, range_months_set):
                    continue
                estimated += 1
                if max_rows is not None and estimated > max_rows:
                    duration_sec = _estimated_duration_seconds(domain, estimated)
                    confidence = 'medium' if sampled else 'high'
                    return {
                        'domain': domain,
                        'mode': mode,
                        'year_from': year_from,
                        'close_month': close_month,
                        'close_month_from': close_month_from,
                        'close_month_to': close_month_to,
                        'estimated_rows': estimated,
                        'max_rows_allowed': max_rows,
                        'would_exceed_limit': True,
                        'sampled': sampled,
                        'scan_mode': scan_mode,
                        'sample_rows': estimated if sampled else 0,
                        'estimate_confidence': confidence,
                        'estimated_duration_sec': duration_sec,
                        'risk_level': _preview_risk_level(
                            mode=mode,
                            would_exceed_limit=True,
                            estimate_confidence=confidence,
                            has_effective_limit=_domain_has_effective_limit(domain),
                        ),
                    }
                if sample_cutoff is not None and estimated >= sample_cutoff:
                    duration_sec = _estimated_duration_seconds(domain, estimated)
                    return {
                        'domain': domain,
                        'mode': mode,
                        'year_from': year_from,
                        'close_month': close_month,
                        'close_month_from': close_month_from,
                        'close_month_to': close_month_to,
                        'estimated_rows': estimated,
                        'max_rows_allowed': max_rows,
                        'would_exceed_limit': bool(max_rows is not None and estimated > max_rows),
                        'sampled': True,
                        'scan_mode': 'sampled',
                        'sample_rows': estimated,
                        'estimate_confidence': 'medium',
                        'estimated_duration_sec': duration_sec,
                        'risk_level': _preview_risk_level(
                            mode=mode,
                            would_exceed_limit=bool(max_rows is not None and estimated > max_rows),
                            estimate_confidence='medium',
                            has_effective_limit=_domain_has_effective_limit(domain),
                        ),
                    }
                if sampled and (monotonic() - scan_start) >= effective_timeout_sec:
                    duration_sec = _estimated_duration_seconds(domain, estimated)
                    return {
                        'domain': domain,
                        'mode': mode,
                        'year_from': year_from,
                        'close_month': close_month,
                        'close_month_from': close_month_from,
                        'close_month_to': close_month_to,
                        'estimated_rows': estimated,
                        'max_rows_allowed': max_rows,
                        'would_exceed_limit': bool(max_rows is not None and estimated > max_rows),
                        'sampled': True,
                        'scan_mode': 'sampled',
                        'sample_rows': estimated,
                        'estimate_confidence': 'low',
                        'estimated_duration_sec': duration_sec,
                        'risk_level': _preview_risk_level(
                            mode=mode,
                            would_exceed_limit=bool(max_rows is not None and estimated > max_rows),
                            estimate_confidence='low',
                            has_effective_limit=_domain_has_effective_limit(domain),
                        ),
                    }
        would_exceed = bool(max_rows is not None and estimated > max_rows)
        duration_sec = _estimated_duration_seconds(domain, estimated)
        confidence = 'medium' if sampled else 'high'
        return {
            'domain': domain,
            'mode': mode,
            'year_from': year_from,
            'close_month': close_month,
            'close_month_from': close_month_from,
            'close_month_to': close_month_to,
            'estimated_rows': estimated,
            'max_rows_allowed': max_rows,
            'would_exceed_limit': would_exceed,
            'sampled': sampled,
            'scan_mode': scan_mode,
            'sample_rows': estimated if sampled else 0,
            'estimate_confidence': confidence,
            'estimated_duration_sec': duration_sec,
            'risk_level': _preview_risk_level(
                mode=mode,
                would_exceed_limit=would_exceed,
                estimate_confidence=confidence,
                has_effective_limit=_domain_has_effective_limit(domain),
            ),
        }

    @staticmethod
    def poll_and_run_next(worker_name: str = 'sync-worker') -> bool:
        claimed = _claim_next_job(worker_name=worker_name)
        if not claimed:
            return False
        job_id = str(claimed['job_id'])
        try:
            _execute_job(
                job_id=job_id,
                actor=str(claimed['actor'] or 'system'),
                domain=str(claimed['domain']),
                mode=str(claimed['mode']),
                year_from=claimed.get('year_from'),
                close_month=claimed.get('close_month'),
                close_month_from=claimed.get('close_month_from'),
                close_month_to=claimed.get('close_month_to'),
            )
            db = SessionLocal()
            try:
                row = db.query(SyncRun).filter(SyncRun.job_id == job_id).first()
                if row is not None and (str(row.stage or '').lower() == 'failed' or bool(row.error)):
                    _mark_queue_job_done(job_id, 'failed', str(row.error or 'sync_failed'))
                elif row is not None and str(row.stage or '').lower() == 'cancelled':
                    _mark_queue_job_done(job_id, 'cancelled', 'cancelled_by_user')
                else:
                    _mark_queue_job_done(job_id, 'completed')
            finally:
                db.close()
        except Exception as exc:
            _mark_queue_job_done(job_id, 'failed', str(exc))
        return True

    @staticmethod
    def worker_bootstrap_cleanup() -> None:
        _cleanup_stale_running_jobs()
        _cleanup_stale_running_queue_jobs()

    @staticmethod
    def status(domain: str, job_id: str | None = None) -> dict:
        db_result: dict[str, Any] | None = None
        db = SessionLocal()
        try:
            q = db.query(SyncRun).filter(SyncRun.domain == domain)
            if job_id:
                q = q.filter(SyncRun.job_id == job_id)
            else:
                q = q.order_by(SyncRun.started_at.desc())
            row = q.first()
            if row is not None:
                partition_key = _watermark_partition_key(
                    str(row.mode or ''),
                    int(row.year_from) if row.year_from is not None else None,
                    getattr(row, 'close_month', None),
                    getattr(row, 'close_month_from', None),
                    getattr(row, 'close_month_to', None),
                )
                wm = _get_watermark(
                    db,
                    domain=domain,
                    query_file=_query_file_for(domain),
                    partition_key=partition_key,
                )
                queue_pos = _queue_position(db, row.job_id)
                queue_row = (
                    db.query(SyncJob.status, SyncJob.error, SyncJob.finished_at)
                    .filter(SyncJob.job_id == row.job_id)
                    .first()
                )
                chunk_row = (
                    db.query(SyncExtractLog)
                    .filter(SyncExtractLog.job_id == row.job_id)
                    .order_by(SyncExtractLog.created_at.desc())
                    .first()
                )
                skipped_unchanged = 0
                if chunk_row is not None:
                    try:
                        details = json.loads(chunk_row.details_json or '{}')
                    except Exception:
                        details = {}
                    skipped_unchanged = int(details.get('skipped_unchanged_chunks') or 0)
                running_value = bool(row.running)
                stage_value = row.stage
                status_message_value = row.status_message
                error_value = row.error
                finished_at_value = row.finished_at
                progress_value = int(row.progress_pct or 0)
                if queue_row is not None:
                    queue_status = str(queue_row[0] or '').strip().lower()
                    queue_error = str(queue_row[1] or '').strip()
                    queue_finished_at = queue_row[2]
                    if queue_status in {'cancelled', 'failed', 'completed'}:
                        running_value = False
                        stage_value = queue_status
                        if queue_status == 'cancelled':
                            status_message_value = 'Sincronizacion cancelada'
                            error_value = None if queue_error == 'cancelled_by_user' else (queue_error or error_value)
                            progress_value = max(progress_value, 100)
                        elif queue_status == 'failed':
                            status_message_value = 'Sincronizacion con error'
                            error_value = queue_error or error_value
                        elif queue_status == 'completed':
                            status_message_value = 'Sincronizacion finalizada'
                            error_value = None
                            progress_value = max(progress_value, 100)
                        if finished_at_value is None and queue_finished_at is not None:
                            finished_at_value = queue_finished_at
                        queue_pos = None
                elif running_value and str(stage_value or '').strip().lower() == 'queued':
                    # If the queue row disappeared, avoid frozen "queued 0%" in UI.
                    running_value = False
                    stage_value = 'failed'
                    status_message_value = 'Estado de cola inconsistente'
                    error_value = error_value or 'queue_job_missing'
                    finished_at_value = finished_at_value or datetime.utcnow()
                    queue_pos = None

                db_result = {
                    'job_id': row.job_id,
                    'domain': row.domain,
                    'running': running_value,
                    'stage': stage_value,
                    'progress_pct': progress_value,
                    'status_message': status_message_value,
                    'mode': row.mode,
                    'year_from': row.year_from,
                    'close_month': row.close_month,
                    'close_month_from': getattr(row, 'close_month_from', None),
                    'close_month_to': getattr(row, 'close_month_to', None),
                    'rows_inserted': int(row.rows_inserted or 0),
                    'rows_updated': int(row.rows_updated or 0),
                    'rows_skipped': int(row.rows_skipped or 0),
                    'rows_read': int(getattr(row, 'rows_read', 0) or 0),
                    'rows_upserted': int(getattr(row, 'rows_upserted', 0) or 0),
                    'rows_unchanged': int(getattr(row, 'rows_unchanged', 0) or 0),
                    'throughput_rows_per_sec': float(getattr(row, 'throughput_rows_per_sec', 0.0) or 0.0),
                    'eta_seconds': int(getattr(row, 'eta_seconds', 0) or 0),
                    'current_query_file': getattr(row, 'current_query_file', None) or _query_file_for(domain),
                    'job_step': getattr(row, 'job_step', None) or _job_step_from_stage(stage_value),
                    'queue_position': queue_pos,
                    'watermark': (
                        {
                            'domain': wm.domain,
                            'query_file': wm.query_file,
                            'partition_key': wm.partition_key,
                            'last_updated_at': wm.last_updated_at.isoformat() if wm.last_updated_at else None,
                            'last_source_id': wm.last_source_id,
                            'last_success_job_id': wm.last_success_job_id,
                            'last_row_count': int(wm.last_row_count or 0),
                            'updated_at': wm.updated_at.isoformat() if wm.updated_at else None,
                        }
                        if wm is not None
                        else None
                    ),
                    'chunk_key': getattr(row, 'chunk_key', None) if hasattr(row, 'chunk_key') else None,
                    'chunk_status': getattr(row, 'chunk_status', None) if hasattr(row, 'chunk_status') else None,
                    'skipped_unchanged_chunks': int(getattr(row, 'skipped_unchanged_chunks', 0) or skipped_unchanged),
                    'affected_months': [],
                    'target_table': getattr(row, 'target_table', None),
                    'agg_refresh_started': False,
                    'agg_refresh_completed': False,
                    'agg_rows_written': 0,
                    'agg_duration_sec': None,
                    'duplicates_detected': int(row.duplicates_detected or 0),
                    'error': error_value,
                    'log': _status_log_list(row.log_json),
                    'started_at': row.started_at.isoformat() if row.started_at else None,
                    'finished_at': finished_at_value.isoformat() if finished_at_value else None,
                    'duration_sec': row.duration_sec,
                }
        finally:
            db.close()
        if db_result is not None:
            return db_result
        with _state_lock:
            state = dict(_state_by_domain.get(domain) or {})
        if state and (job_id is None or state.get('job_id') == job_id):
            state.setdefault('domain', domain)
            state.setdefault('queue_position', None)
            state.setdefault('watermark', None)
            state.setdefault('chunk_key', None)
            state.setdefault('chunk_status', None)
            state.setdefault('skipped_unchanged_chunks', 0)
            raw_log = state.get('log') or []
            state['log'] = [str(x) for x in raw_log] if isinstance(raw_log, list) else []
            # Ensure SyncStatusOut-serializable types (Pydantic expects str | None for dates)
            for key in ('started_at', 'finished_at'):
                v = state.get(key)
                if hasattr(v, 'isoformat') and callable(getattr(v, 'isoformat')):
                    state[key] = v.isoformat() if v else None
            return state
        return {'domain': domain, 'running': False, 'progress_pct': 0, 'log': []}

    @staticmethod
    def options_consistency() -> dict:
        db = SessionLocal()
        try:
            return _mv_options_consistency_report(db)
        finally:
            db.close()

    @staticmethod
    def rebuild_options(scope: str, months: list[str] | None, actor: str) -> dict:
        normalized_scope = str(scope or 'full').strip().lower()
        if normalized_scope not in {'full', 'months'}:
            raise ValueError('scope invalido: usar "full" o "months"')
        requested_months = sorted(
            {str(m).strip() for m in (months or []) if _month_serial(str(m).strip()) > 0},
            key=_month_serial,
        )
        db = SessionLocal()
        try:
            if normalized_scope == 'months':
                if not requested_months:
                    raise ValueError('months requerido cuando scope=months')
                rebuilt_rows = _refresh_mv_options_tables(db, set(requested_months))
            else:
                rebuilt_rows = _bootstrap_mv_options_full(db)
            consistency = _mv_options_consistency_report(db)
            auto_rebuilt = False
            auto_rebuilt_rows = {'cartera': 0, 'cohorte': 0, 'rendimiento': 0, 'anuales': 0}
            if not bool(consistency.get('ok')):
                auto_rebuilt = True
                auto_rebuilt_rows = _bootstrap_mv_options_full(db)
                consistency = _mv_options_consistency_report(db)
            _refresh_source_freshness_snapshots(db, last_job_id=f'admin:{actor}')
            invalidated = {
                'portfolio_corte_options': invalidate_endpoint('portfolio/corte/options', lambda _: True),
                'portfolio_corte_v2_options': invalidate_endpoint('portfolio-corte-v2/options', lambda _: True),
                'cobranzas_cohorte_options': invalidate_endpoint('cobranzas-cohorte/options', lambda _: True),
                'cobranzas_cohorte_v2_options': invalidate_endpoint('cobranzas-cohorte-v2/options', lambda _: True),
                'rendimiento_v2_options': invalidate_endpoint('rendimiento-v2/options', lambda _: True),
                'anuales_v2_options': invalidate_endpoint('anuales-v2/options', lambda _: True),
                'portfolio_corte_summary': invalidate_endpoint('portfolio/corte/summary', lambda _: True),
                'portfolio_corte_v2_summary': invalidate_endpoint('portfolio-corte-v2/summary', lambda _: True),
                'cobranzas_cohorte_summary': invalidate_endpoint('cobranzas-cohorte/summary', lambda _: True),
                'rendimiento_v2_summary': invalidate_endpoint('rendimiento-v2/summary', lambda _: True),
                'anuales_v2_summary': invalidate_endpoint('anuales-v2/summary', lambda _: True),
                'portfolio_corte_first_paint': invalidate_endpoint('portfolio-corte-v2/first-paint', lambda _: True),
                'cobranzas_cohorte_first_paint': invalidate_endpoint('cobranzas-cohorte-v2/first-paint', lambda _: True),
                'cobranzas_cohorte_detail': invalidate_endpoint('cobranzas-cohorte-v2/detail', lambda _: True),
                'rendimiento_v2_first_paint': invalidate_endpoint('rendimiento-v2/first-paint', lambda _: True),
                'anuales_v2_first_paint': invalidate_endpoint('anuales-v2/first-paint', lambda _: True),
            }
            return {
                'scope': normalized_scope,
                'months': requested_months,
                'rebuilt_rows': rebuilt_rows,
                'auto_rebuilt': auto_rebuilt,
                'auto_rebuilt_rows': auto_rebuilt_rows,
                'consistency': consistency,
                'cache_invalidated': invalidated,
                'rebuilt_at': datetime.utcnow().isoformat(),
                'actor': actor,
            }
        finally:
            db.close()

    @staticmethod
    def source_freshness() -> dict:
        db = SessionLocal()
        try:
            return AnalyticsService.fetch_source_freshness_status(db)
        finally:
            db.close()

    @staticmethod
    def list_watermarks(domain: str | None = None) -> list[dict]:
        db = SessionLocal()
        try:
            q = db.query(SyncWatermark)
            if domain:
                q = q.filter(SyncWatermark.domain == domain)
            rows = q.order_by(SyncWatermark.domain, SyncWatermark.query_file, SyncWatermark.partition_key).all()
            return [
                {
                    'domain': row.domain,
                    'query_file': row.query_file,
                    'partition_key': row.partition_key,
                    'last_updated_at': row.last_updated_at.isoformat() if row.last_updated_at else None,
                    'last_source_id': row.last_source_id,
                    'last_success_job_id': row.last_success_job_id,
                    'last_row_count': int(row.last_row_count or 0),
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                }
                for row in rows
            ]
        finally:
            db.close()

    @staticmethod
    def reset_watermarks(domain: str, query_file: str | None = None, partition_key: str | None = None) -> dict:
        db = SessionLocal()
        try:
            q = db.query(SyncWatermark).filter(SyncWatermark.domain == domain)
            if query_file:
                q = q.filter(SyncWatermark.query_file == str(query_file).strip())
            if partition_key:
                q = q.filter(SyncWatermark.partition_key == str(partition_key).strip())
            deleted = q.delete(synchronize_session=False)
            db.commit()
            return {
                'domain': domain,
                'query_file': query_file,
                'partition_key': partition_key,
                'deleted': int(deleted or 0),
            }
        finally:
            db.close()

    @staticmethod
    def job_chunks(job_id: str) -> dict:
        db = SessionLocal()
        try:
            rows = (
                db.query(SyncExtractLog)
                .filter(SyncExtractLog.job_id == job_id)
                .order_by(SyncExtractLog.created_at.asc())
                .all()
            )
            domain = rows[0].domain if rows else None
            chunks = []
            for row in rows:
                try:
                    details = json.loads(row.details_json or '{}')
                except Exception:
                    details = {}
                chunks.append(
                    {
                        'chunk_key': row.chunk_key,
                        'stage': row.stage,
                        'status': row.status,
                        'rows': int(row.rows or 0),
                        'duration_sec': float(row.duration_sec or 0.0),
                        'throughput_rows_per_sec': float(row.throughput_rows_per_sec or 0.0),
                        'details': details,
                        'created_at': row.created_at.isoformat() if row.created_at else None,
                    }
                )
            return {'job_id': job_id, 'domain': domain, 'chunks': chunks}
        finally:
            db.close()

    @staticmethod
    def perf_summary(limit: int = 200) -> dict:
        db = SessionLocal()
        try:
            capped = max(20, min(1000, int(limit or 200)))
            rows = (
                db.query(SyncRun)
                .order_by(SyncRun.started_at.desc())
                .limit(capped)
                .all()
            )
            totals = {
                'jobs': 0,
                'completed': 0,
                'failed': 0,
                'avg_duration_sec': 0.0,
                'avg_throughput_rows_per_sec': 0.0,
            }
            by_domain: dict[str, dict[str, int | float]] = {}
            slowest: list[dict[str, str | int | float | None]] = []
            duration_sum = 0.0
            throughput_sum = 0.0
            throughput_count = 0
            for row in rows:
                domain = str(row.domain or 'unknown')
                totals['jobs'] += 1
                if str(row.stage or '').lower() == 'completed':
                    totals['completed'] += 1
                if str(row.stage or '').lower() == 'failed' or bool(row.error):
                    totals['failed'] += 1
                dur = float(row.duration_sec or 0.0)
                th = float(getattr(row, 'throughput_rows_per_sec', 0.0) or 0.0)
                duration_sum += dur
                if th > 0:
                    throughput_sum += th
                    throughput_count += 1
                bucket = by_domain.setdefault(
                    domain,
                    {
                        'jobs': 0,
                        'completed': 0,
                        'failed': 0,
                        'avg_duration_sec': 0.0,
                        'avg_throughput_rows_per_sec': 0.0,
                        '_duration_sum': 0.0,
                        '_throughput_sum': 0.0,
                        '_throughput_count': 0,
                    },
                )
                bucket['jobs'] += 1
                if str(row.stage or '').lower() == 'completed':
                    bucket['completed'] += 1
                if str(row.stage or '').lower() == 'failed' or bool(row.error):
                    bucket['failed'] += 1
                bucket['_duration_sum'] += dur
                if th > 0:
                    bucket['_throughput_sum'] += th
                    bucket['_throughput_count'] += 1
                slowest.append(
                    {
                        'job_id': row.job_id,
                        'domain': domain,
                        'mode': row.mode,
                        'stage': row.stage,
                        'duration_sec': dur,
                        'rows_read': int(row.rows_read or 0),
                        'rows_upserted': int(row.rows_upserted or 0),
                        'started_at': row.started_at.isoformat() if row.started_at else None,
                        'finished_at': row.finished_at.isoformat() if row.finished_at else None,
                    }
                )
            if totals['jobs'] > 0:
                totals['avg_duration_sec'] = round(duration_sum / totals['jobs'], 2)
                totals['avg_throughput_rows_per_sec'] = round(
                    throughput_sum / max(1, throughput_count),
                    2,
                )
            for domain, bucket in by_domain.items():
                jobs = int(bucket['jobs'] or 0)
                bucket['avg_duration_sec'] = round(float(bucket['_duration_sum']) / max(1, jobs), 2)
                tcount = int(bucket['_throughput_count'] or 0)
                bucket['avg_throughput_rows_per_sec'] = round(float(bucket['_throughput_sum']) / max(1, tcount), 2)
                bucket.pop('_duration_sum', None)
                bucket.pop('_throughput_sum', None)
                bucket.pop('_throughput_count', None)
                by_domain[domain] = bucket
            top_slowest_jobs = sorted(slowest, key=lambda item: float(item.get('duration_sec') or 0.0), reverse=True)[:10]
            return {
                'generated_at': datetime.utcnow().isoformat(),
                'totals': totals,
                'by_domain': by_domain,
                'top_slowest_jobs': top_slowest_jobs,
            }
        finally:
            db.close()

    @staticmethod
    def list_schedules() -> list[dict]:
        db = SessionLocal()
        try:
            rows = db.query(SyncSchedule).order_by(SyncSchedule.id.asc()).all()
            return [
                {
                    'id': r.id,
                    'name': r.name,
                    'interval_value': r.interval_value,
                    'interval_unit': r.interval_unit,
                    'domains': json.loads(r.domains or '[]') if isinstance(r.domains, str) else (r.domains or []),
                    'mode': r.mode,
                    'year_from': r.year_from,
                    'close_month': r.close_month,
                    'close_month_from': r.close_month_from,
                    'close_month_to': r.close_month_to,
                    'enabled': bool(r.enabled),
                    'paused': bool(r.paused),
                    'last_run_at': _iso_utc(r.last_run_at),
                    'last_run_status': r.last_run_status,
                    'last_run_summary': json.loads(r.last_run_summary) if isinstance(r.last_run_summary, str) and r.last_run_summary else r.last_run_summary,
                    'next_run_at': _iso_utc(r.next_run_at),
                    'created_at': _iso_utc(r.created_at),
                    'updated_at': _iso_utc(r.updated_at),
                }
                for r in rows
            ]
        finally:
            db.close()

    @staticmethod
    def get_schedule(schedule_id: int) -> dict | None:
        db = SessionLocal()
        try:
            r = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
            if not r:
                return None
            return {
                'id': r.id,
                'name': r.name,
                'interval_value': r.interval_value,
                'interval_unit': r.interval_unit,
                'domains': json.loads(r.domains or '[]') if isinstance(r.domains, str) else (r.domains or []),
                'mode': r.mode,
                'year_from': r.year_from,
                'close_month': r.close_month,
                'close_month_from': r.close_month_from,
                'close_month_to': r.close_month_to,
                'enabled': bool(r.enabled),
                'paused': bool(r.paused),
                'last_run_at': _iso_utc(r.last_run_at),
                'last_run_status': r.last_run_status,
                'last_run_summary': json.loads(r.last_run_summary) if isinstance(r.last_run_summary, str) and r.last_run_summary else r.last_run_summary,
                'next_run_at': _iso_utc(r.next_run_at),
                'created_at': _iso_utc(r.created_at),
                'updated_at': _iso_utc(r.updated_at),
            }
        finally:
            db.close()

    @staticmethod
    def create_schedule(
        name: str,
        interval_value: int,
        interval_unit: str,
        domains: list[str],
        *,
        mode: str | None = None,
        year_from: int | None = None,
        close_month: str | None = None,
        close_month_from: str | None = None,
        close_month_to: str | None = None,
        enabled: bool = True,
    ) -> dict:
        if interval_unit == 'minute' and interval_value < 10:
            raise ValueError('El intervalo mínimo es 10 minutos')
        db = SessionLocal()
        try:
            now = datetime.utcnow()
            r = SyncSchedule(
                name=name,
                interval_value=interval_value,
                interval_unit=interval_unit,
                domains=json.dumps(domains),
                mode=mode,
                year_from=year_from,
                close_month=close_month,
                close_month_from=close_month_from,
                close_month_to=close_month_to,
                enabled=enabled,
                paused=False,
                next_run_at=_compute_next_run_at(interval_value, interval_unit, from_dt=now),
            )
            db.add(r)
            db.commit()
            db.refresh(r)
            return {
                'id': r.id,
                'name': r.name,
                'interval_value': r.interval_value,
                'interval_unit': r.interval_unit,
                'domains': json.loads(r.domains or '[]'),
                'mode': r.mode,
                'next_run_at': _iso_utc(r.next_run_at),
            }
        finally:
            db.close()

    @staticmethod
    def update_schedule(
        schedule_id: int,
        *,
        name: str | None = None,
        interval_value: int | None = None,
        interval_unit: str | None = None,
        domains: list[str] | None = None,
        mode: str | None = None,
        year_from: int | None = None,
        close_month: str | None = None,
        close_month_from: str | None = None,
        close_month_to: str | None = None,
        enabled: bool | None = None,
        paused: bool | None = None,
    ) -> dict | None:
        db = SessionLocal()
        try:
            r = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
            if not r:
                return None
            if name is not None:
                r.name = name
            if interval_value is not None:
                r.interval_value = interval_value
            if interval_unit is not None:
                if interval_unit == 'minute' and (r.interval_value if interval_value is None else interval_value) < 10:
                    raise ValueError('El intervalo mínimo es 10 minutos')
                r.interval_unit = interval_unit
            if interval_value is not None and r.interval_unit == 'minute' and interval_value < 10:
                raise ValueError('El intervalo mínimo es 10 minutos')
            if domains is not None:
                r.domains = json.dumps(domains)
            if mode is not None:
                r.mode = mode
            if year_from is not None:
                r.year_from = year_from
            if close_month is not None:
                r.close_month = close_month
            if close_month_from is not None:
                r.close_month_from = close_month_from
            if close_month_to is not None:
                r.close_month_to = close_month_to
            if enabled is not None:
                r.enabled = enabled
            if paused is not None:
                r.paused = paused
            db.commit()
            db.refresh(r)
            return {
                'id': r.id,
                'name': r.name,
                'interval_value': r.interval_value,
                'interval_unit': r.interval_unit,
                'domains': json.loads(r.domains or '[]'),
                'next_run_at': _iso_utc(r.next_run_at),
            }
        finally:
            db.close()

    @staticmethod
    def delete_schedule(schedule_id: int) -> bool:
        db = SessionLocal()
        try:
            # Keep historical jobs/runs, but detach them from the schedule before deleting
            # to satisfy FK constraints on sync_jobs.schedule_id.
            db.query(SyncJob).filter(SyncJob.schedule_id == schedule_id).update(
                {'schedule_id': None},
                synchronize_session=False,
            )
            deleted = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).delete(synchronize_session=False)
            db.commit()
            return deleted > 0
        finally:
            db.close()

    @staticmethod
    def run_schedule_now(schedule_id: int) -> dict | None:
        """Enqueue one-shot run for this schedule's domains (same run_group)."""
        db = SessionLocal()
        try:
            s = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
            if not s:
                return None
            domains = json.loads(s.domains or '[]') if isinstance(s.domains, str) else (s.domains or [])
            if not domains:
                return {'schedule_id': schedule_id, 'job_ids': [], 'message': 'Sin dominios'}
            run_group_id = str(uuid.uuid4())
            mode = s.mode or 'incremental'
            job_ids = []
            for domain in domains:
                if domain not in SYNC_DOMAIN_QUERIES:
                    continue
                job_id = str(uuid.uuid4())
                _queue_job(
                    db,
                    job_id=job_id,
                    domain=domain,
                    mode=mode,
                    actor='schedule_run_now',
                    year_from=s.year_from,
                    close_month=s.close_month,
                    close_month_from=s.close_month_from,
                    close_month_to=s.close_month_to,
                    schedule_id=s.id,
                    run_group_id=run_group_id,
                )
                _persist_sync_run(
                    db,
                    {
                        'job_id': job_id,
                        'domain': domain,
                        'mode': mode,
                        'year_from': s.year_from,
                        'close_month': s.close_month,
                        'target_table': _target_table_name(domain),
                        'running': True,
                        'stage': 'queued',
                        'progress_pct': 0,
                        'status_message': 'Ejecutar ahora',
                        'rows_inserted': 0,
                        'rows_updated': 0,
                        'rows_skipped': 0,
                        'rows_read': 0,
                        'rows_upserted': 0,
                        'rows_unchanged': 0,
                        'throughput_rows_per_sec': 0.0,
                        'eta_seconds': None,
                        'current_query_file': _query_file_for(domain),
                        'job_step': 'queued',
                        'duplicates_detected': 0,
                        'error': None,
                        'started_at': datetime.utcnow(),
                        'finished_at': None,
                        'duration_sec': None,
                        'log': ['Ejecutar ahora (manual)'],
                        'actor': 'schedule_run_now',
                    },
                )
                job_ids.append(job_id)
            db.commit()
            return {'schedule_id': schedule_id, 'job_ids': job_ids}
        finally:
            db.close()

    @staticmethod
    def pause_schedule(schedule_id: int) -> bool:
        db = SessionLocal()
        try:
            r = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
            if not r:
                return False
            r.paused = True
            db.query(SyncJob).filter(
                SyncJob.schedule_id == schedule_id,
                SyncJob.status.in_(['pending', 'running']),
            ).update(
                {'status': 'cancelled', 'error': 'cancelled_by_user', 'finished_at': datetime.utcnow()},
                synchronize_session=False,
            )
            db.commit()
            return True
        finally:
            db.close()

    @staticmethod
    def resume_schedule(schedule_id: int) -> bool:
        db = SessionLocal()
        try:
            r = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
            if not r:
                return False
            r.paused = False
            db.commit()
            return True
        finally:
            db.close()

    @staticmethod
    def emergency_stop_schedules() -> None:
        emergency_stop_all_schedules()

    @staticmethod
    def emergency_resume_schedules() -> None:
        emergency_resume_all_schedules()

    @staticmethod
    def run_scheduler_tick_service() -> None:
        """Called by worker every 60s to enqueue due schedules."""
        _cleanup_stale_running_jobs()
        _cleanup_stale_running_queue_jobs()
        run_scheduler_tick()
