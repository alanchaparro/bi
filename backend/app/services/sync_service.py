import hashlib
import json
import logging
import os
import threading
import tempfile
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import mysql.connector
from sqlalchemy import Integer, Numeric, and_, case, cast, func, literal, text as sa_text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.analytics_cache import invalidate_endpoint, invalidate_prefix
from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.models.brokers import (
    AnalyticsContractSnapshot,
    AnalyticsFact,
    CarteraFact,
    CarteraCorteAgg,
    CobranzasCohorteAgg,
    CobranzasFact,
    ContratosFact,
    GestoresFact,
    SyncChunkManifest,
    SyncExtractLog,
    SyncStagingRow,
    SyncRecord,
    SyncJobStep,
    SyncJob,
    SyncRun,
    SyncWatermark,
)
from app.services.brokers_config_service import BrokersConfigService


SYNC_DOMAIN_QUERIES = {
    'analytics': 'query_analytics.sql',
    'cartera': 'query.sql',
    'cobranzas': 'query_cobranzas.sql',
    'contratos': 'query_contratos.sql',
    'gestores': 'query_gestores.sql',
}

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
    'contratos': {'updated_col': 'date', 'id_col': 'id', 'format': '%Y-%m-%d'},
    'gestores': {'updated_col': 'from_date', 'id_col': 'contract_id', 'format': '%Y-%m-%d'},
}


def _target_table_name(domain: str) -> str:
    return FACT_TABLE_BY_DOMAIN[domain].__tablename__


def _query_file_for(domain: str) -> str:
    return SYNC_DOMAIN_QUERIES.get(domain, '')


def _job_step_from_stage(stage: str | None) -> str | None:
    mapping = {
        'starting': 'bootstrap',
        'connecting_mysql': 'extract',
        'normalizing': 'normalize',
        'replacing_window': 'replace_window',
        'upserting': 'upsert',
        'refreshing_snapshot': 'refresh_snapshot',
        'refreshing_corte_agg': 'refresh_agg',
        'analyzing': 'analyze',
        'completed': 'finalize',
        'failed': 'failed',
    }
    return mapping.get(str(stage or '').strip().lower())

_state_lock = threading.Lock()
_state_by_domain: dict[str, dict] = {}
_running_by_domain: set[str] = set()
logger = logging.getLogger(__name__)


def _query_path_for(domain: str) -> Path:
    filename = SYNC_DOMAIN_QUERIES[domain]
    return Path(__file__).resolve().parents[3] / filename


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
    day = _normalize_key(row, 'Dia', 'day')
    month = _normalize_key(row, 'Mes', 'mes', 'month')
    year = _normalize_key(row, 'Año', 'AÃ±o', 'AÃƒÂ±o', 'anio', 'year')
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

    gestion_month = _normalize_key(row, 'gestion_month')
    if not gestion_month:
        y = _normalize_key(row, 'Año', 'AÃ±o', 'AÃƒÂ±o', 'anio', 'year')
        m = _normalize_key(row, 'Mes', 'mes', 'month')
        if y.isdigit() and m.isdigit():
            gestion_month = f'{int(m):02d}/{y}'
    if not gestion_month:
        # Business rule: for cartera, the processing year must map to close date.
        if domain == 'cartera':
            gestion_month = _parse_month(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
        if not gestion_month:
            gestion_month = _parse_month(
                _normalize_key(row, 'from_date', 'date', 'fecha_contrato', 'fecha_cierre', 'Actualizado_al')
            )
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

    payload_json = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
    source_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
    close_date = _parse_date_key(_normalize_key(row, 'fecha_cierre', 'closed_date', 'close_date'))
    payment_date = None
    payment_month = ''
    payment_year = 0
    payment_amount = 0.0
    payment_via_class = ''
    if domain == 'cobranzas':
        parsed_payment_date = _parse_payment_date(row)
        payment_date = parsed_payment_date.strftime('%Y-%m-%d') if parsed_payment_date else ''
        payment_month = _parse_month(parsed_payment_date.strftime('%Y-%m-%d') if parsed_payment_date else '') or gestion_month
        payment_year = _year_of(payment_month) or datetime.utcnow().year
        payment_amount = _to_float(_normalize_key(row, 'monto', 'amount', 'payment_amount'))
        payment_via_class = _normalize_payment_via_class(via)

    return {
        'domain': domain,
        'contract_id': str(contract_id)[:64],
        'gestion_month': str(gestion_month)[:7],
        'supervisor': str(supervisor)[:128],
        'un': str(un)[:128],
        'via': str(via)[:32],
        'tramo': tramo,
        'close_date': close_date,
        'payment_date': payment_date,
        'payment_month': payment_month,
        'payment_year': payment_year,
        'payment_amount': payment_amount,
        'payment_via_class': payment_via_class,
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
    close_year = _year_of(gestion_month) or datetime.utcnow().year
    close_date = _parse_iso_date(normalized.get('close_date'))
    if close_date is None:
        try:
            close_date = datetime.strptime(f'01/{gestion_month}', '%d/%m/%Y').date()
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
        return {
            **base,
            'close_date': close_date,
            'close_month': gestion_month,
            'close_year': close_year,
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
        return {
            **base,
            'via': normalized['via'],
            'tramo': tramo,
            'contracts_total': max(1, _to_int(payload.get('contracts_total') or 1, 1)),
            'debt_total': _to_float(payload.get('debt_total') or payload.get('debt') or payload.get('total_saldo')),
            'paid_total': _to_float(payload.get('paid_total') or payload.get('paid')),
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
            normalized.get('contract_id'),
            normalized.get('payment_date') or normalized.get('gestion_month'),
            normalized.get('payment_amount'),
            normalized.get('payment_via_class') or normalized.get('via'),
        )
    return tuple(normalized[k] for k in BUSINESS_KEY_FIELDS)


def _set_state(domain: str, updates: dict) -> None:
    with _state_lock:
        current = dict(_state_by_domain.get(domain) or {})
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
    updated_col = str(hint.get('updated_col') or '').strip()
    id_col = str(hint.get('id_col') or '').strip()
    date_format = str(hint.get('format') or '%Y-%m-%d %H:%i:%s')
    if not updated_col:
        return base_sql, tuple(), False
    dt_value = watermark_updated_at.strftime('%Y-%m-%d %H:%M:%S')
    wrapped_sql = _strip_sql_trailing_semicolon(base_sql)
    if not wrapped_sql:
        return base_sql, tuple(), False
    if id_col and str(watermark_source_id or '').strip():
        sql = (
            f"SELECT * FROM ({wrapped_sql}) _src "
            f"WHERE ("
            f"STR_TO_DATE(CAST(_src.`{updated_col}` AS CHAR), '{date_format}') > %s "
            f"OR (STR_TO_DATE(CAST(_src.`{updated_col}` AS CHAR), '{date_format}') = %s "
            f"AND CAST(_src.`{id_col}` AS CHAR) > %s)"
            f")"
        )
        params = (dt_value, dt_value, str(watermark_source_id))
        return sql, params, True
    sql = (
        f"SELECT * FROM ({wrapped_sql}) _src "
        f"WHERE STR_TO_DATE(CAST(_src.`{updated_col}` AS CHAR), '{date_format}') > %s"
    )
    params = (dt_value,)
    return sql, params, True


def _iter_from_mysql(
    query_path: Path,
    *,
    domain: str | None = None,
    watermark_updated_at: datetime | None = None,
    watermark_source_id: str | None = None,
):
    cfg = {
        'host': settings.mysql_host,
        'port': settings.mysql_port,
        'user': settings.mysql_user,
        'password': settings.mysql_password,
        'database': settings.mysql_database,
        'connection_timeout': 20,
        'consume_results': True,
    }
    conn = mysql.connector.connect(**cfg)
    try:
        cursor = conn.cursor(dictionary=True)
        try:
            query_text = query_path.read_text(encoding='utf-8')
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
            except Exception:
                if used_pushdown:
                    logger.warning(
                        '[sync:%s] fallback to base query (incremental pushdown not applicable at source)',
                        str(domain or 'unknown'),
                    )
                    cursor.execute(query_text)
                else:
                    raise
            batch_size = max(100, int(settings.sync_fetch_batch_size or 5000))
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
    if mode == 'full_year' and year_from is not None:
        q = q.filter(func.substr(SyncRecord.gestion_month, 4, 4) == str(year_from))
    elif mode == 'full_all':
        pass
    elif target_months:
        q = q.filter(SyncRecord.gestion_month.in_(target_months))
    q.delete(synchronize_session=False)
    db.commit()


def _adaptive_chunk_size(domain: str, configured: int) -> int:
    base = max(500, int(configured or 5000))
    domain_hint = {
        'cobranzas': 4000,
        'cartera': 2500,
        'analytics': 5000,
        'contratos': 6000,
        'gestores': 6000,
    }.get(domain, base)
    return max(500, min(12000, int((base + domain_hint) / 2)))


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


def _persist_staging_rows(db: Session, job_id: str, domain: str, chunk_key: str, rows: list[dict]) -> int:
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


def _upsert_sync_records(db: Session, rows: list[dict]) -> int:
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
        insert_stmt = pg_insert(table).values(values)
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_cols,
            set_={
                'payload_json': insert_stmt.excluded.payload_json,
                'source_hash': insert_stmt.excluded.source_hash,
                'updated_at': now,
            },
        )
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
    for mm_yyyy in months:
        parts = str(mm_yyyy).split('/')
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        month = int(parts[0])
        year = int(parts[1])
        if month < 1 or month > 12:
            continue
        part_name = f'cartera_fact_{year}_{month:02d}'
        start = f'{year:04d}-{month:02d}-01'
        if month == 12:
            end = f'{year + 1:04d}-01-01'
        else:
            end = f'{year:04d}-{month + 1:02d}-01'
        db.execute(
            sa_text(
                f"""
                CREATE TABLE IF NOT EXISTS {part_name}
                PARTITION OF cartera_fact
                FOR VALUES FROM ('{start}') TO ('{end}')
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
        if mode == 'full_month' and close_month:
            q = q.filter(CarteraFact.close_month == close_month)
        elif mode == 'full_year' and year_from is not None:
            q = q.filter(CarteraFact.close_year == int(year_from))
        elif mode == 'full_all':
            pass
        elif target_months:
            q = q.filter(CarteraFact.close_month.in_(target_months))
    elif domain == 'cobranzas':
        if mode == 'full_year' and year_from is not None:
            q = q.filter(CobranzasFact.payment_year == int(year_from))
        elif mode == 'full_all':
            pass
        elif target_months:
            q = q.filter(CobranzasFact.payment_month.in_(target_months))
    else:
        if mode == 'full_year' and year_from is not None:
            q = q.filter(func.substr(model.gestion_month, 4, 4) == str(year_from))
        elif mode == 'full_all':
            pass
        elif target_months:
            q = q.filter(model.gestion_month.in_(target_months))
    q.delete(synchronize_session=False)
    db.commit()


def _upsert_fact_rows(db: Session, domain: str, rows: list[dict]) -> tuple[int, int]:
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
        index_cols = [table.c.contract_id, table.c.close_date]
    elif domain == 'cobranzas':
        index_cols = [table.c.contract_id, table.c.payment_date, table.c.payment_amount, table.c.payment_via_class]
    else:
        index_cols = [table.c.contract_id, table.c.gestion_month, table.c.supervisor, table.c.un, table.c.via, table.c.tramo]

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
    stmt = insert_stmt.on_conflict_do_update(
        index_elements=index_cols,
        set_=set_map,
        where=table.c.source_hash != excluded.source_hash,
    )
    result = db.execute(stmt)
    db.commit()
    changed = int(result.rowcount or 0)
    unchanged = max(0, len(values) - changed)
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


def _build_cartera_categoria_expr(db: Session):
    cfg = BrokersConfigService.get_cartera_tramo_rules(db)
    category_expr = case((CarteraFact.tramo > 3, literal('MOROSO')), else_=literal('VIGENTE'))
    for rule in (cfg.get('rules') or []):
        if not isinstance(rule, dict):
            continue
        un_rule = str(rule.get('un') or '').strip().upper()
        category = str(rule.get('category') or '').strip().upper()
        if not un_rule or category not in {'VIGENTE', 'MOROSO'}:
            continue
        tramos_raw = rule.get('tramos', [])
        tramos_norm: list[int] = []
        if isinstance(tramos_raw, list):
            for t in tramos_raw:
                try:
                    tramos_norm.append(max(0, min(7, int(float(t)))))
                except Exception:
                    continue
        if tramos_norm:
            category_expr = case(
                (and_(CarteraFact.un == un_rule, CarteraFact.tramo.in_(tramos_norm)), literal(category)),
                else_=category_expr,
            )
    return category_expr


def _build_cartera_contract_year_expr():
    if engine.dialect.name == 'postgresql':
        fecha_contrato_expr = cast(CarteraFact.payload_json, JSONB).op('->>')('fecha_contrato')
        return case(
            (fecha_contrato_expr.op('~')(r'^\d{4}[-/]'), cast(func.substring(fecha_contrato_expr, 1, 4), Integer)),
            (fecha_contrato_expr.op('~')(r'^\d{2}/\d{2}/\d{4}$'), cast(func.substring(fecha_contrato_expr, 7, 4), Integer)),
            else_=None,
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
    if engine.dialect.name == 'postgresql':
        monto_cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
        monto_cuota_expr = case(
            (monto_cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(monto_cuota_text, Numeric)),
            else_=literal(0),
        )
    else:
        monto_cuota_expr = literal(0)
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
    months = sorted({str(m).strip() for m in (affected_months or set()) if str(m).strip()}, key=_month_serial)
    if not months:
        return 0, 0
    deleted = db.query(CobranzasCohorteAgg).filter(CobranzasCohorteAgg.cutoff_month.in_(months)).delete(synchronize_session=False)
    db.commit()

    categoria_expr = _build_cartera_categoria_expr(db)
    via_expr = case(
        (func.upper(func.coalesce(CarteraFact.via_cobro, '')) == literal('COBRADOR'), literal('COBRADOR')),
        else_=literal('DEBITO'),
    )
    if engine.dialect.name == 'postgresql':
        monto_cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
        monto_cuota_expr = case(
            (monto_cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(monto_cuota_text, Numeric)),
            else_=literal(0),
        )
    else:
        monto_cuota_expr = literal(0)

    payments = (
        db.query(
            CobranzasFact.payment_month.label('cutoff_month'),
            CobranzasFact.contract_id.label('contract_id'),
            func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label('cobrado'),
            func.coalesce(
                func.sum(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))),
                0,
            ).label('transacciones'),
        )
        .filter(CobranzasFact.payment_month.in_(months))
        .group_by(CobranzasFact.payment_month, CobranzasFact.contract_id)
        .all()
    )
    payment_map: dict[tuple[str, str], tuple[float, int]] = {}
    for row in payments:
        payment_map[(str(row.cutoff_month), str(row.contract_id))] = (float(row.cobrado or 0.0), int(row.transacciones or 0))

    cartera_rows = (
        db.query(
            CarteraFact.contract_id,
            CarteraFact.gestion_month,
            CarteraFact.un,
            CarteraFact.supervisor,
            via_expr.label('via'),
            categoria_expr.label('categoria'),
            CarteraFact.monto_vencido,
            monto_cuota_expr.label('monto_cuota'),
            CarteraFact.payload_json,
        )
        .filter(CarteraFact.gestion_month.in_(months))
        .all()
    )
    now = datetime.utcnow()
    bucket: dict[tuple[str, str, str, str, str, str], dict[str, float | int]] = {}
    for row in cartera_rows:
        contract_id = str(row.contract_id or '').strip()
        if not contract_id:
            continue
        payload = {}
        try:
            payload = json.loads(row.payload_json or '{}')
        except Exception:
            payload = {}
        sale_month = _month_from_any(payload.get('fecha_contrato'))
        if _month_serial(sale_month) <= 0:
            continue
        cutoff_month = str(row.gestion_month or '').strip()
        if _month_serial(cutoff_month) <= 0:
            continue
        should_pay = float(_to_float(row.monto_cuota) + _to_float(row.monto_vencido))
        paid, tx = payment_map.get((cutoff_month, contract_id), (0.0, 0))
        key = (
            cutoff_month,
            sale_month,
            str(row.un or 'S/D').strip().upper(),
            str(row.supervisor or 'S/D').strip().upper(),
            str(row.via or 'DEBITO').strip().upper(),
            str(row.categoria or 'VIGENTE').strip().upper(),
        )
        acc = bucket.setdefault(
            key,
            {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
        )
        acc['activos'] = int(acc['activos']) + 1
        acc['pagaron'] = int(acc['pagaron']) + (1 if paid > 0 else 0)
        acc['deberia'] = float(acc['deberia']) + should_pay
        acc['cobrado'] = float(acc['cobrado']) + float(paid)
        acc['transacciones'] = int(acc['transacciones']) + int(tx)

    mappings: list[dict] = []
    for key, values in bucket.items():
        cutoff_month, sale_month, un, supervisor, via, categoria = key
        mappings.append(
            {
                'cutoff_month': cutoff_month,
                'sale_month': sale_month,
                'sale_year': _year_from_month(sale_month),
                'un': un,
                'supervisor': supervisor,
                'via_cobro': via,
                'categoria': categoria,
                'activos': int(values['activos'] or 0),
                'pagaron': int(values['pagaron'] or 0),
                'deberia': float(values['deberia'] or 0.0),
                'cobrado': float(values['cobrado'] or 0.0),
                'transacciones': int(values['transacciones'] or 0),
                'updated_at': now,
            }
        )
    if mappings:
        db.bulk_insert_mappings(CobranzasCohorteAgg, mappings)
        db.commit()
    return int(deleted or 0), len(mappings)


def _refresh_analytics_snapshot(
    db: Session,
    mode: str,
    year_from: int | None,
    target_months: set[str],
    normalized_rows: list[dict],
) -> None:
    q = db.query(AnalyticsContractSnapshot)
    if mode == 'full_year' and year_from is not None:
        q = q.filter(func.substr(AnalyticsContractSnapshot.sale_month, 4, 4) == str(year_from))
    elif mode == 'full_all':
        pass
    elif target_months:
        q = q.filter(AnalyticsContractSnapshot.sale_month.in_(target_months))
    q.delete(synchronize_session=False)
    db.commit()

    now = datetime.utcnow()
    snapshot_rows: list[dict] = []
    for row in normalized_rows:
        payload = json.loads(row['payload_json'])
        contracts = max(1, _to_int(payload.get('contracts_total'), 1))
        debt_total = _to_float(payload.get('debt_total'))
        paid_total = _to_float(payload.get('paid_total'))
        debt_per = debt_total / contracts
        paid_per = paid_total / contracts
        base_id = str(row['contract_id'])
        for i in range(contracts):
            snapshot_rows.append(
                {
                    'contract_id': f'{base_id}_{i}',
                    'sale_month': row['gestion_month'],
                    'close_month': row['gestion_month'],
                    'supervisor': row['supervisor'],
                    'un': row['un'],
                    'via': row['via'],
                    'tramo': int(row['tramo']),
                    'debt': debt_per,
                    'paid': paid_per,
                    'created_at': now,
                }
            )
    if snapshot_rows:
        db.bulk_insert_mappings(AnalyticsContractSnapshot, snapshot_rows)
        db.commit()


def _persist_sync_run(db: Session, payload: dict) -> None:
    row = db.query(SyncRun).filter(SyncRun.job_id == payload['job_id']).first()
    if row is None:
        row = SyncRun(job_id=payload['job_id'])
        db.add(row)
    for key, value in payload.items():
        if key == 'log':
            row.log_json = json.dumps(value or [], ensure_ascii=False)
        elif hasattr(row, key):
            setattr(row, key, value)
    db.commit()


def _persist_job_step(db: Session, job_id: str, domain: str, step_name: str, status: str, details: dict | None = None) -> None:
    now = datetime.utcnow()
    row = (
        db.query(SyncJobStep)
        .filter(SyncJobStep.job_id == job_id, SyncJobStep.domain == domain, SyncJobStep.step_name == step_name)
        .order_by(SyncJobStep.started_at.desc())
        .first()
    )
    details_json = json.dumps(details or {}, ensure_ascii=False)
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
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for row in rows:
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
        }
    finally:
        db.close()


def _mark_queue_job_done(job_id: str, status: str, error: str | None = None) -> None:
    db = SessionLocal()
    try:
        row = db.query(SyncJob).filter(SyncJob.job_id == job_id).first()
        if row is None:
            return
        row.status = status
        row.error = error
        row.finished_at = datetime.utcnow()
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
        watermark_filtered_rows = 0
        if wm_filter_updated_at is not None:
            _append_log(
                domain,
                f'Watermark activo: updated_at>{wm_filter_updated_at.isoformat()}'
                + (f' (id>{wm_filter_source_id})' if wm_filter_source_id else ''),
            )
        max_rows = _max_rows_for_domain(domain)
        source_rows = 0
        _persist_job_step(db, job_id, domain, 'extract', 'completed', {'rows_read': 0})
        _persist_job_step(db, job_id, domain, 'normalize', 'running')
        _set_state(domain, {'stage': 'normalizing', 'progress_pct': 35, 'status_message': 'Normalizando filas'})

        normalized_rows: list[dict] = []
        source_months: set[str] = set()
        source_keys: set[tuple] = set()
        duplicates_detected = 0
        normalized_count = 0
        skipped_unchanged_chunks = 0
        chunk_signals: dict[str, dict] = {}
        wm_last_updated_at: datetime | None = None
        wm_last_source_id: str | None = None
        temp_rows_path: str | None = None
        temp_rows_file = None
        # Stream large domains to disk to keep memory stable and show incremental progress.
        if domain in {'cartera', 'cobranzas', 'contratos', 'gestores'}:
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
            ):
                source_rows += len(batch)
                # Keep hard cap only for full_all; scoped modes are streamed safely.
                hard_limit = max_rows if mode == 'full_all' else None
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
                    if not _matches_mode(n['gestion_month'], mode, year_from, close_month, range_months_set):
                        continue
                    source_months.add(n['gestion_month'])
                    key = _source_dedupe_key(n)
                    if key in source_keys:
                        duplicates_detected += 1
                        continue
                    source_keys.add(key)
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
                    if temp_rows_file is not None:
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
        target_months = set(changed_months)
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

        _persist_job_step(db, job_id, domain, 'replace_window', 'running', {'months': sorted(target_months, key=_month_serial)})
        _set_state(domain, {'stage': 'replacing_window', 'progress_pct': 55, 'status_message': 'Reemplazando ventana'})
        if target_months:
            _delete_target_window(db, domain, mode, year_from, target_months)
            _delete_target_window_fact(db, domain, mode, year_from, close_month, target_months)
        _persist_job_step(db, job_id, domain, 'replace_window', 'completed', {'months': sorted(target_months, key=_month_serial)})
        ordered_target_months = sorted(target_months, key=_month_serial)
        _set_state(domain, {'affected_months': ordered_target_months})
        _append_log(domain, f'Meses objetivo: {", ".join(ordered_target_months) or "-"}')

        _persist_job_step(db, job_id, domain, 'upsert', 'running')
        _set_state(domain, {'stage': 'upserting', 'progress_pct': 75, 'status_message': 'Aplicando UPSERT'})
        rows_inserted = 0
        rows_upserted = 0
        rows_unchanged = 0
        month_counts: dict[str, int] = {}
        processed_by_month: dict[str, int] = {}
        if temp_rows_path is not None:
            if domain == 'cartera':
                with open(temp_rows_path, 'r', encoding='utf-8') as f_count:
                    for line in f_count:
                        line = line.strip()
                        if not line:
                            continue
                        item = json.loads(line)
                        month_key = str(item.get('gestion_month') or '')
                        if not month_key:
                            continue
                        if target_months and month_key not in target_months:
                            continue
                        month_counts[month_key] = month_counts.get(month_key, 0) + 1
                        processed_by_month.setdefault(month_key, 0)
            chunk_size = _adaptive_chunk_size(domain, int(settings.sync_fetch_batch_size or 5000))
            processed = 0
            if domain == 'cartera' and month_counts:
                ordered_months = sorted(month_counts.keys(), key=_month_serial)
                for month_key in ordered_months:
                    _append_log(domain, f'Procesando mes {month_key}...')
                    chunk: list[dict] = []
                    with open(temp_rows_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            item = json.loads(line)
                            if str(item.get('gestion_month') or '') != month_key:
                                continue
                            chunk.append(item)
                            if len(chunk) >= chunk_size:
                                _persist_staging_rows(db, job_id, domain, month_key, chunk)
                                rows_inserted += _upsert_sync_records(db, chunk)
                                changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                                rows_upserted += changed
                                rows_unchanged += unchanged
                                processed += len(chunk)
                                processed_by_month[month_key] = processed_by_month.get(month_key, 0) + len(chunk)
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
                        _persist_staging_rows(db, job_id, domain, month_key, chunk)
                        rows_inserted += _upsert_sync_records(db, chunk)
                        changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                        rows_upserted += changed
                        rows_unchanged += unchanged
                        processed += len(chunk)
                        processed_by_month[month_key] = processed_by_month.get(month_key, 0) + len(chunk)
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
                chunk: list[dict] = []
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
                            _persist_staging_rows(db, job_id, domain, _derive_chunk_key(chunk), chunk)
                            rows_inserted += _upsert_sync_records(db, chunk)
                            changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                            rows_upserted += changed
                            rows_unchanged += unchanged
                            processed += len(chunk)
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
                    _persist_staging_rows(db, job_id, domain, _derive_chunk_key(chunk), chunk)
                    rows_inserted += _upsert_sync_records(db, chunk)
                    changed, unchanged = _upsert_fact_rows(db, domain, chunk)
                    rows_upserted += changed
                    rows_unchanged += unchanged
                    processed += len(chunk)
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
                os.remove(temp_rows_path)
            except Exception:
                pass
        else:
            rows_for_upsert = normalized_rows
            if target_months:
                rows_for_upsert = [r for r in normalized_rows if str(r.get('gestion_month') or '') in target_months]
            else:
                rows_for_upsert = []
            rows_inserted = _upsert_sync_records(db, rows_for_upsert)
            rows_upserted, rows_unchanged = _upsert_fact_rows(db, domain, rows_for_upsert)
            _persist_staging_rows(db, job_id, domain, _derive_chunk_key(rows_for_upsert), rows_for_upsert)
            _set_state(
                domain,
                {
                    'rows_inserted': rows_inserted,
                    'rows_read': source_rows,
                    'rows_upserted': rows_upserted,
                    'rows_unchanged': rows_unchanged,
                    'target_table': _target_table_name(domain),
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
        if domain == 'analytics':
            _persist_job_step(db, job_id, domain, 'refresh_snapshot', 'running')
            _set_state(domain, {'stage': 'refreshing_snapshot', 'progress_pct': 88, 'status_message': 'Actualizando snapshot analytics'})
            _refresh_analytics_snapshot(db, mode, year_from, target_months, normalized_rows)
            _persist_job_step(db, job_id, domain, 'refresh_snapshot', 'completed')

        agg_rows_written = 0
        agg_duration_sec = None
        if domain in {'cartera', 'cobranzas'}:
            agg_started_at = datetime.now(timezone.utc)
            _persist_job_step(db, job_id, domain, 'refresh_agg', 'running')
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
            _append_log(domain, 'Iniciando recÃƒÂ¡lculo de cartera_corte_agg...')
            deleted_agg, agg_rows_written = _refresh_cartera_corte_agg(db, target_months)
            deleted_cohorte, cohorte_rows_written = _refresh_cobranzas_cohorte_agg(db, target_months)
            agg_rows_written += int(cohorte_rows_written)
            agg_duration_sec = round((datetime.now(timezone.utc) - agg_started_at).total_seconds(), 2)
            _set_state(
                domain,
                {
                    'agg_refresh_completed': True,
                    'agg_rows_written': int(agg_rows_written),
                    'agg_duration_sec': agg_duration_sec,
                },
            )
            _append_log(
                domain,
                (
                    f'Agregado corte actualizado: borradas={deleted_agg}, '
                    f'insertadas={agg_rows_written}, cohorte_borradas={deleted_cohorte}, '
                    f'cohorte_insertadas={cohorte_rows_written}, duracion={agg_duration_sec}s'
                ),
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
            'chunk_status': 'changed' if ordered_target_months else 'unchanged',
            'chunk_key': ','.join(ordered_target_months) if ordered_target_months else '*',
            'skipped_unchanged_chunks': int(skipped_unchanged_chunks),
            'affected_months': ordered_target_months,
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
        cleaned_stg = _cleanup_staging_rows(db)
        if cleaned_stg > 0:
            _append_log(domain, f'Limpieza staging: {cleaned_stg} filas antiguas removidas')
        if domain == 'cartera':
            invalidated_options = invalidate_prefix('portfolio/options')
            invalidated_summary = invalidate_prefix('portfolio/summary')
            target_months_set = set(ordered_target_months)
            invalidated_corte_options = invalidate_endpoint(
                'portfolio/corte/options',
                lambda _: True,
            )
            invalidated_corte_summary = invalidate_endpoint(
                'portfolio/corte/summary',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('gestion_month')
                    or bool(set(filters.get('gestion_month') or []).intersection(target_months_set))
                ),
            )
            _append_log(
                domain,
                (
                    'Cache invalido: '
                    f'portfolio/options={invalidated_options}, '
                    f'portfolio/summary={invalidated_summary}, '
                    f'portfolio/corte/options={invalidated_corte_options}, '
                    f'portfolio/corte/summary={invalidated_corte_summary}'
                ),
            )
        if domain == 'cobranzas':
            target_months_set = set(ordered_target_months)
            invalidated_corte_options = invalidate_endpoint('portfolio/corte/options', lambda _: True)
            invalidated_corte_summary = invalidate_endpoint(
                'portfolio/corte/summary',
                lambda filters: (
                    not target_months_set
                    or not isinstance(filters, dict)
                    or not filters.get('gestion_month')
                    or bool(set(filters.get('gestion_month') or []).intersection(target_months_set))
                ),
            )
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
            _append_log(
                domain,
                (
                    'Cache invalido: '
                    f'portfolio/corte/options={invalidated_corte_options}, '
                    f'portfolio/corte/summary={invalidated_corte_summary}, '
                    f'cobranzas-cohorte/options={invalidated_cohorte_options}, '
                    f'cobranzas-cohorte/summary={invalidated_cohorte_summary}'
                ),
            )
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
                'chunk_status': 'changed' if ordered_target_months else 'unchanged',
                'chunk_key': ','.join(ordered_target_months) if ordered_target_months else '*',
                'skipped_unchanged_chunks': int(skipped_unchanged_chunks),
                'affected_months': ordered_target_months,
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
        state_snapshot = dict(_state_by_domain.get(domain) or {})
        failed_state = {
            'running': False,
            'stage': 'failed',
            'progress_pct': 100,
            'status_message': 'Sincronizacion con error',
            'rows_skipped': int(state_snapshot.get('rows_skipped') or 0),
            'skipped_unchanged_chunks': int(state_snapshot.get('skipped_unchanged_chunks') or 0),
            'chunk_key': state_snapshot.get('chunk_key'),
            'chunk_status': 'failed',
            'error': error,
            'finished_at': finished_at.isoformat(),
            'duration_sec': duration_sec,
        }
        _set_state(domain, failed_state)
        failed_step = _job_step_from_stage((_state_by_domain.get(domain) or {}).get('stage')) or 'bootstrap'
        _persist_job_step(db, job_id, domain, failed_step, 'failed', {'error': error})
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
                'stage': 'failed',
                'progress_pct': 100,
                'status_message': 'Sincronizacion con error',
                'rows_inserted': int(state_snapshot.get('rows_inserted') or 0),
                'rows_updated': 0,
                'rows_skipped': int(state_snapshot.get('rows_skipped') or 0),
                'rows_read': int(state_snapshot.get('rows_read') or 0),
                'rows_upserted': int(state_snapshot.get('rows_upserted') or 0),
                'rows_unchanged': int(state_snapshot.get('rows_unchanged') or 0),
                'throughput_rows_per_sec': float(state_snapshot.get('throughput_rows_per_sec') or 0.0),
                'eta_seconds': 0,
                'current_query_file': _query_file_for(domain),
                'job_step': 'failed',
                'chunk_status': 'failed',
                'chunk_key': state_snapshot.get('chunk_key'),
                'skipped_unchanged_chunks': int(state_snapshot.get('skipped_unchanged_chunks') or 0),
                'error': error,
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
        if mode == 'full_month' and close_month_from and close_month_to and close_month_from == close_month_to:
            close_month = close_month_from
        job_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()
        db = SessionLocal()
        try:
            if _queue_has_running_or_pending(db):
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
    ) -> dict:
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
        finally:
            db.close()
        max_rows = _max_rows_for_domain(domain)
        estimated = 0
        sampled = False
        seq = 0
        for batch in _iter_from_mysql(
            query_path,
            domain=domain,
            watermark_updated_at=wm_updated_at,
            watermark_source_id=wm_source_id,
        ):
            for row in batch:
                n = _normalize_record(domain, row, seq)
                seq += 1
                if not _matches_mode(n['gestion_month'], mode, year_from, close_month, range_months_set):
                    continue
                estimated += 1
                if max_rows is not None and estimated > max_rows:
                    sampled = True
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
                    }
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
            'sampled': sampled,
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
        with _state_lock:
            state = dict(_state_by_domain.get(domain) or {})
        if state and (job_id is None or state.get('job_id') == job_id):
            state.setdefault('domain', domain)
            state.setdefault('queue_position', None)
            state.setdefault('watermark', None)
            state.setdefault('chunk_key', None)
            state.setdefault('chunk_status', None)
            state.setdefault('skipped_unchanged_chunks', 0)
            return state

        db = SessionLocal()
        try:
            q = db.query(SyncRun).filter(SyncRun.domain == domain)
            if job_id:
                q = q.filter(SyncRun.job_id == job_id)
            else:
                q = q.order_by(SyncRun.started_at.desc())
            row = q.first()
            if row is None:
                return {'domain': domain, 'running': False, 'progress_pct': 0, 'log': []}
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
            return {
                'job_id': row.job_id,
                'domain': row.domain,
                'running': bool(row.running),
                'stage': row.stage,
                'progress_pct': int(row.progress_pct or 0),
                'status_message': row.status_message,
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
                'job_step': getattr(row, 'job_step', None) or _job_step_from_stage(row.stage),
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
                'error': row.error,
                'log': json.loads(row.log_json or '[]'),
                'started_at': row.started_at.isoformat() if row.started_at else None,
                'finished_at': row.finished_at.isoformat() if row.finished_at else None,
                'duration_sec': row.duration_sec,
            }
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
