from __future__ import annotations

import csv
import io
import json
import re
import time
from collections import defaultdict
from datetime import datetime
from threading import Lock
from urllib.parse import urlencode
from sqlalchemy import Integer, Numeric, String, and_, case, cast, func, literal
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import category_expr_for_tramo, latest_month, month_from_any, month_serial, normalize_tramo
from app.models.brokers import (
    AnalyticsContractSnapshot,
    AnalyticsSourceFreshness,
    AnalyticsAnualesAgg,
    AnalyticsRendimientoAgg,
    BrokersSupervisorScope,
    CarteraCorteAgg,
    CarteraFact,
    CobranzasCohorteAgg,
    CobranzasFact,
    MvOptionsAnuales,
    MvOptionsCartera,
    MvOptionsCohorte,
    MvOptionsRendimiento,
    CommissionRules,
    DimNegocioContrato,
    DimNegocioUnMap,
    PrizeRules,
)
from app.schemas.analytics import (
    AnalyticsFilters,
    CobranzasCohorteDetailIn,
    CobranzasCohorteFirstPaintIn,
    CobranzasCohorteIn,
    PortfolioSummaryIn,
)


_COHORTE_BASE_CACHE_TTL_SEC = 900
_COHORTE_BASE_CACHE: dict[str, tuple[float, list[dict]]] = {}
_COHORTE_BASE_CACHE_LOCK = Lock()
ANALYTICS_PIPELINE_VERSION = '2026.03.v2'
STANDARD_GESTION_CALENDAR_START = '01/2021'
STANDARD_CONTRACT_CALENDAR_START = '01/2014'


def _cohorte_base_cache_get(cache_key: str) -> list[dict] | None:
    now = time.time()
    with _COHORTE_BASE_CACHE_LOCK:
        entry = _COHORTE_BASE_CACHE.get(cache_key)
        if not entry:
            return None
        ts, data = entry
        if now - ts > _COHORTE_BASE_CACHE_TTL_SEC:
            _COHORTE_BASE_CACHE.pop(cache_key, None)
            return None
        return list(data)


def _cohorte_base_cache_set(cache_key: str, data: list[dict]) -> None:
    with _COHORTE_BASE_CACHE_LOCK:
        _COHORTE_BASE_CACHE[cache_key] = (time.time(), list(data))


def cohorte_base_cache_clear() -> None:
    """Vaciar caché de base cohorte para que el siguiente request use cobranzas actualizadas."""
    with _COHORTE_BASE_CACHE_LOCK:
        _COHORTE_BASE_CACHE.clear()


def _filters_to_query(filters: AnalyticsFilters) -> str:
    items: list[tuple[str, str]] = []
    for key, values in filters.model_dump().items():
        if not isinstance(values, list):
            continue
        for v in values:
            vv = str(v).strip()
            if vv:
                items.append((key, vv))
    return urlencode(items)


def _month_serial(mm_yyyy: str) -> int:
    return month_serial(mm_yyyy)


def _latest_month(values: list[str]) -> str:
    return latest_month(values)


def _month_from_serial(serial: int) -> str:
    if serial <= 0:
        return ''
    year = serial // 12
    month = serial % 12
    if month == 0:
        month = 12
        year -= 1
    if year <= 0:
        return ''
    return f'{month:02d}/{year}'


def _standard_calendar_months(start_mm_yyyy: str, end_mm_yyyy: str | None = None) -> list[str]:
    start_serial = _month_serial(start_mm_yyyy)
    if start_serial <= 0:
        return []
    if end_mm_yyyy and _month_serial(end_mm_yyyy) > 0:
        end_serial = _month_serial(end_mm_yyyy)
    else:
        now = datetime.utcnow()
        end_serial = (now.year * 12) + now.month
    if end_serial < start_serial:
        return []
    out: list[str] = []
    for serial in range(start_serial, end_serial + 1):
        mm = _month_from_serial(serial)
        if mm:
            out.append(mm)
    return out


def _fetch_canonical_uns(db: Session) -> list[str]:
    """UN canónicas activas desde dim_negocio_un_map (is_active=true)."""
    rows = (
        db.query(DimNegocioUnMap.canonical_un)
        .filter(DimNegocioUnMap.is_active.is_(True))
        .distinct()
        .all()
    )
    return sorted({str(v[0]).strip().upper() for v in rows if str(v[0] or '').strip()})


def _cap_paid_to_debt(paid: float | int | None, debt: float | int | None) -> float:
    paid_num = float(paid or 0.0)
    debt_num = float(debt or 0.0)
    if paid_num <= 0.0 or debt_num <= 0.0:
        return 0.0
    return paid_num if paid_num <= debt_num else debt_num


def _effective_cartera_month_for_cutoff(db: Session, cutoff_month: str) -> str:
    cutoff_serial = _month_serial(cutoff_month)
    if cutoff_serial <= 0:
        return ''
    months = [
        str(v[0]).strip()
        for v in db.query(CarteraCorteAgg.gestion_month).distinct().all()
        if _month_serial(str(v[0] or '').strip()) > 0
    ]
    effective = ''
    for mm in sorted(set(months), key=_month_serial):
        if _month_serial(mm) <= cutoff_serial:
            effective = mm
    return effective


def _month_from_date(value: object) -> str:
    s = str(value or '').strip()
    if not s:
        return ''
    if re.match(r'^\d{1,2}/\d{4}$', s):
        parts = s.split('/')
        return f'{parts[0].zfill(2)}/{parts[1]}'
    m = re.match(r'^(\d{4})[-/](\d{1,2})[-/]\d{1,2}$', s)
    if m:
        return f'{str(m.group(2)).zfill(2)}/{m.group(1)}'
    m = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$', s)
    if m:
        return f'{str(m.group(2)).zfill(2)}/{m.group(3)}'
    return ''


def _year_of(mm_yyyy: str) -> str:
    s = str(mm_yyyy or '').strip()
    parts = s.split('/')
    return parts[1] if len(parts) == 2 and len(parts[1]) == 4 else ''


def _months_between_date_and_month(date_yyyy_mm_dd: object, mm_yyyy: object) -> int:
    date_val = str(date_yyyy_mm_dd or '').strip()
    month_val = str(mm_yyyy or '').strip()
    d = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', date_val)
    m = re.match(r'^(\d{1,2})/(\d{4})$', month_val)
    if not d or not m:
        return 0
    contract_year = int(d.group(1))
    contract_month = int(d.group(2))
    gestion_month = int(m.group(1))
    gestion_year = int(m.group(2))
    diff = (gestion_year - contract_year) * 12 + (gestion_month - contract_month)
    if diff < 0:
        diff = 0
    return 1 if diff == 0 else diff


def _iter_chunks(values: list[str], size: int = 1000):
    for i in range(0, len(values), size):
        yield values[i:i + size]


def _payment_month_variants(mm_yyyy: str) -> list[str]:
    """Devuelve variantes de mes (MM/YYYY, M/YYYY, YYYY-MM) por si la BD guardó distinto."""
    s = str(mm_yyyy or '').strip()
    if not s:
        return []
    out = [s]
    parts = s.split('/')
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit() and len(parts[1]) == 4:
        m, y = parts[0], parts[1]
        m2 = m.zfill(2)
        alt_iso = f'{y}-{m2}'
        if alt_iso not in out:
            out.append(alt_iso)
        if m != m2 and m not in out:
            out.append(f'{m}/{y}')
    if '-' in s and s not in out:
        part = s.split('-')
        if len(part) == 2 and part[0].isdigit() and part[1].isdigit():
            y, m = part[0], part[1].zfill(2)
            if len(y) == 4:
                alt = f'{m}/{y}'
                if alt not in out:
                    out.append(alt)
                if part[1] != m and f"{int(part[1])}/{y}" not in out:
                    out.append(f"{int(part[1])}/{y}")
    return out


def _normalize_contract_id_for_lookup(cid: str | int | None) -> str:
    """Clave única para cruce contract_id: sin espacios y sin ceros a la izquierda si es numérico."""
    s = str(cid or '').strip()
    if not s:
        return ''
    if s.isdigit():
        return str(int(s))
    return s


def _nest_un_by_gestion_month(rows: list[tuple]) -> dict[str, dict[str, int]]:
    """gestion_month -> { un -> contracts_total } para tabla pivote en resumen cartera."""
    out: dict[str, dict[str, int]] = {}
    for gestion_m, un, cnt in rows:
        gm = str(gestion_m or '').strip()
        u = str(un or '').strip()
        if not gm or not u:
            continue
        if gm not in out:
            out[gm] = {}
        out[gm][u] = int(cnt or 0)
    return out


def _normalize_str_set(values: list[str]) -> set[str]:
    return {str(v).strip().upper() for v in (values or []) if str(v).strip()}


def _load_json_list(value: str | None) -> list:
    if not value:
        return []
    try:
        data = json.loads(value)
    except Exception:
        return []
    return data if isinstance(data, list) else []


def _rule_match(values: list[str], current: str) -> bool:
    normalized = {str(v).strip().upper() for v in (values or []) if str(v).strip()}
    if not normalized or '__ALL__' in normalized:
        return True
    return str(current or '').strip().upper() in normalized


def _normalize_supervisor_for_prize(supervisor: str) -> str:
    s = str(supervisor or '').strip().upper()
    if s in {'FVBROKEREAS', 'FVBROKEREASCDE', 'FVBROKERS'}:
        return 'FVBROKERS'
    return s or 'S/D'


def _to_float(value: object) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _normalize_tramo(value: object) -> str:
    return str(normalize_tramo(value))


def _month_from_any(value: object) -> str:
    return month_from_any(value)


def _via_class_expr():
    return case(
        (func.upper(func.coalesce(CarteraFact.via_cobro, '')) == literal('COBRADOR'), literal('COBRADOR')),
        else_=literal('DEBITO'),
    )


def _compute_commission_amount(monto: float, supervisor: str, un: str, via: str, month: str, rules: list[dict]) -> float:
    amount = 0.0
    sup = str(supervisor or '').strip().upper()
    un_v = str(un or '').strip().upper()
    via_v = str(via or '').strip().upper()
    month_v = str(month or '').strip()
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        if not _rule_match(rule.get('supervisors', []), sup):
            continue
        if not _rule_match(rule.get('uns', []), un_v):
            continue
        if not _rule_match(rule.get('vias', []), via_v):
            continue
        if not _rule_match(rule.get('months', []), month_v):
            continue
        rate = float(rule.get('rate') or 0.0)
        amount += monto * rate
    return amount


def _compute_prize(count: int, supervisor: str, un: str, rules: list[dict]) -> float:
    sup = _normalize_supervisor_for_prize(supervisor)
    un_v = str(un or '').strip().upper()
    best = 0.0
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        if not _rule_match([_normalize_supervisor_for_prize(v) for v in rule.get('supervisors', [])], sup):
            continue
        if not _rule_match(rule.get('uns', []), un_v):
            continue
        for scale in (rule.get('scales') or []):
            if not isinstance(scale, dict):
                continue
            threshold = int(scale.get('threshold') or 0)
            prize = float(scale.get('prize') or 0.0)
            if count >= threshold and prize >= best:
                best = prize
    return best


def _is_mora_3m(sale_month: str, close_month: str, tramo: int) -> bool:
    if int(tramo or 0) < 4:
        return False
    sale = _month_serial(sale_month)
    close = _month_serial(close_month)
    if sale <= 0 or close <= 0:
        return False
    antig = close - sale
    return antig > 3 and antig <= 6


class AnalyticsService:
    @staticmethod
    def _latest_timestamp_for_source(db: Session, source_table: str) -> datetime | None:
        source = str(source_table or '').strip().lower()
        try:
            if source == 'cartera_fact':
                return db.query(CarteraFact.updated_at).order_by(CarteraFact.updated_at.desc()).limit(1).scalar()
            if source == 'cobranzas_fact':
                return db.query(CobranzasFact.updated_at).order_by(CobranzasFact.updated_at.desc()).limit(1).scalar()
            if source == 'cartera_corte_agg':
                return db.query(CarteraCorteAgg.updated_at).order_by(CarteraCorteAgg.updated_at.desc()).limit(1).scalar()
            if source == 'cobranzas_cohorte_agg':
                return db.query(CobranzasCohorteAgg.updated_at).order_by(CobranzasCohorteAgg.updated_at.desc()).limit(1).scalar()
            if source == 'analytics_rendimiento_agg':
                return db.query(AnalyticsRendimientoAgg.updated_at).order_by(AnalyticsRendimientoAgg.updated_at.desc()).limit(1).scalar()
            if source == 'analytics_anuales_agg':
                return db.query(AnalyticsAnualesAgg.updated_at).order_by(AnalyticsAnualesAgg.updated_at.desc()).limit(1).scalar()
            if source == 'dim_negocio_contrato':
                return db.query(DimNegocioContrato.updated_at).order_by(DimNegocioContrato.updated_at.desc()).limit(1).scalar()
            if source == 'analytics_contract_snapshot':
                return db.query(AnalyticsContractSnapshot.created_at).order_by(AnalyticsContractSnapshot.created_at.desc()).limit(1).scalar()
            if source == 'mv_options_cartera':
                return db.query(MvOptionsCartera.updated_at).order_by(MvOptionsCartera.updated_at.desc()).limit(1).scalar()
            if source == 'mv_options_cohorte':
                return db.query(MvOptionsCohorte.updated_at).order_by(MvOptionsCohorte.updated_at.desc()).limit(1).scalar()
            if source == 'mv_options_rendimiento':
                return (
                    db.query(MvOptionsRendimiento.updated_at)
                    .order_by(MvOptionsRendimiento.updated_at.desc())
                    .limit(1)
                    .scalar()
                )
            if source == 'mv_options_anuales':
                return db.query(MvOptionsAnuales.updated_at).order_by(MvOptionsAnuales.updated_at.desc()).limit(1).scalar()
        except Exception:
            return None
        return None

    @staticmethod
    def _source_freshness_iso(db: Session, source_table: str | None) -> str | None:
        source = str(source_table or '').strip().lower()
        if not source:
            return None
        tables = [s.strip() for s in source.replace('+', ',').split(',') if s.strip()]
        freshness_rows = (
            db.query(AnalyticsSourceFreshness.source_table, AnalyticsSourceFreshness.max_updated_at)
            .filter(AnalyticsSourceFreshness.source_table.in_(tables))
            .all()
        )
        freshness_map = {str(row[0] or '').strip().lower(): row[1] for row in freshness_rows}
        max_dt: datetime | None = None
        for name in tables:
            dt = freshness_map.get(name)
            if dt is None:
                dt = AnalyticsService._latest_timestamp_for_source(db, name)
            if dt is not None and (max_dt is None or dt > max_dt):
                max_dt = dt
        return max_dt.isoformat() if max_dt is not None else None

    @staticmethod
    def fetch_source_freshness_status(db: Session) -> dict:
        tracked_sources = [
            'cartera_fact',
            'cobranzas_fact',
            'cartera_corte_agg',
            'cobranzas_cohorte_agg',
            'analytics_rendimiento_agg',
            'analytics_anuales_agg',
            'dim_negocio_contrato',
            'analytics_contract_snapshot',
            'mv_options_cartera',
            'mv_options_cohorte',
            'mv_options_rendimiento',
            'mv_options_anuales',
        ]
        rows = db.query(AnalyticsSourceFreshness).all()
        existing = {str(row.source_table or '').strip().lower(): row for row in rows}
        out_rows: list[dict] = []
        for source in sorted(set(tracked_sources + list(existing.keys()))):
            row = existing.get(source)
            max_updated_at = row.max_updated_at if row else None
            if max_updated_at is None:
                max_updated_at = AnalyticsService._latest_timestamp_for_source(db, source)
            out_rows.append(
                {
                    'source_table': source,
                    'max_updated_at': max_updated_at.isoformat() if max_updated_at else None,
                    'tracked_updated_at': row.updated_at.isoformat() if row and row.updated_at else None,
                    'last_job_id': str(row.last_job_id or '') if row and row.last_job_id else None,
                    'from_tracker': bool(row),
                }
            )
        return {
            'generated_at': datetime.utcnow().isoformat(),
            'rows': out_rows,
        }

    @staticmethod
    def attach_meta(db: Session, payload: dict, *, cache_hit: bool, source_table: str | None = None) -> dict:
        out = dict(payload or {})
        meta = dict(out.get('meta') or {})
        if source_table:
            meta['source_table'] = source_table
        data_freshness_at = AnalyticsService._source_freshness_iso(db, meta.get('source_table'))
        if data_freshness_at:
            meta['data_freshness_at'] = data_freshness_at
        else:
            meta.setdefault('data_freshness_at', None)
        meta['cache_hit'] = bool(cache_hit)
        meta['pipeline_version'] = ANALYTICS_PIPELINE_VERSION
        meta.setdefault('generated_at', datetime.utcnow().isoformat())
        out['meta'] = meta
        return out

    @staticmethod
    def fetch_brokers_summary_v1(db: Session, filters: AnalyticsFilters) -> dict:
        supervisor_filter = _normalize_str_set(filters.supervisor)
        un_filter = _normalize_str_set(filters.un)
        via_filter = _normalize_str_set(filters.via_cobro)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}
        month_filter = {str(v).strip() for v in (filters.contract_month or []) if str(v).strip()}

        scope_row = db.query(BrokersSupervisorScope).filter(BrokersSupervisorScope.id == 1).first()
        enabled_supervisors = _normalize_str_set(_load_json_list(scope_row.supervisors_json if scope_row else '[]'))

        commission_row = db.query(CommissionRules).filter(CommissionRules.id == 1).first()
        commission_rules = _load_json_list(commission_row.rules_json if commission_row else '[]')

        prize_row = db.query(PrizeRules).filter(PrizeRules.id == 1).first()
        prize_rules = _load_json_list(prize_row.rules_json if prize_row else '[]')

        by_key: dict[str, dict] = {}
        by_supervisor: dict[str, int] = {}
        count_by_month_super: dict[str, int] = {}
        total_contracts = 0
        grouped_q = db.query(
            AnalyticsContractSnapshot.sale_month.label('sale_month'),
            AnalyticsContractSnapshot.supervisor.label('supervisor'),
            AnalyticsContractSnapshot.un.label('un'),
            AnalyticsContractSnapshot.via.label('via'),
            AnalyticsContractSnapshot.close_month.label('close_month'),
            AnalyticsContractSnapshot.tramo.label('tramo'),
            func.count().label('contracts_count'),
            func.coalesce(func.sum(AnalyticsContractSnapshot.debt), 0.0).label('debt_sum'),
        )
        if enabled_supervisors:
            grouped_q = grouped_q.filter(AnalyticsContractSnapshot.supervisor.in_(enabled_supervisors))
        if supervisor_filter:
            grouped_q = grouped_q.filter(AnalyticsContractSnapshot.supervisor.in_(supervisor_filter))
        if un_filter:
            grouped_q = grouped_q.filter(AnalyticsContractSnapshot.un.in_(un_filter))
        if via_filter:
            grouped_q = grouped_q.filter(AnalyticsContractSnapshot.via.in_(via_filter))
        if month_filter:
            grouped_q = grouped_q.filter(AnalyticsContractSnapshot.sale_month.in_(month_filter))
        if year_filter:
            grouped_q = grouped_q.filter(func.substr(AnalyticsContractSnapshot.sale_month, 4, 4).in_(year_filter))
        grouped_q = grouped_q.group_by(
            AnalyticsContractSnapshot.sale_month,
            AnalyticsContractSnapshot.supervisor,
            AnalyticsContractSnapshot.un,
            AnalyticsContractSnapshot.via,
            AnalyticsContractSnapshot.close_month,
            AnalyticsContractSnapshot.tramo,
        )

        for row in grouped_q.yield_per(2000):
            sale_month = str(row.sale_month or '').strip()
            supervisor = str(row.supervisor or 'S/D').strip().upper() or 'S/D'
            un = str(row.un or 'S/D').strip().upper() or 'S/D'
            via = str(row.via or 'S/D').strip().upper() or 'S/D'
            count = int(row.contracts_count or 0)
            amount_sum = float(row.debt_sum or 0.0)
            key = f'{sale_month}__{supervisor}__{un}__{via}'
            if key not in by_key:
                by_key[key] = {
                    'count': 0,
                    'mora3m': 0,
                    'montoCuota': 0.0,
                    'commission': 0.0,
                    'sale_month': sale_month,
                    'supervisor': supervisor,
                    'un': un,
                    'via': via,
                }
            by_key[key]['count'] += count
            by_key[key]['montoCuota'] += amount_sum
            by_key[key]['commission'] += _compute_commission_amount(
                amount_sum,
                supervisor,
                un,
                via,
                sale_month,
                commission_rules,
            )
            if _is_mora_3m(sale_month, str(row.close_month or ''), int(row.tramo or 0)):
                by_key[key]['mora3m'] += count
            by_supervisor[supervisor] = by_supervisor.get(supervisor, 0) + count
            count_by_month_super[f'{sale_month}__{supervisor}'] = count_by_month_super.get(f'{sale_month}__{supervisor}', 0) + count
            total_contracts += count

        out_rows = []
        for item in by_key.values():
            sale_month = item['sale_month']
            year = _year_of(sale_month) or 'S/D'
            month_part = sale_month.split('/')[0] if '/' in sale_month else ''
            prize = _compute_prize(
                count_by_month_super.get(f"{sale_month}__{item['supervisor']}", 0),
                item['supervisor'],
                item['un'],
                prize_rules,
            )
            out_rows.append(
                {
                    'month': sale_month,
                    'year': year,
                    'monthPart': month_part,
                    'supervisor': item['supervisor'],
                    'un': item['un'],
                    'via': item['via'],
                    'count': int(item['count']),
                    'mora3m': int(item['mora3m']),
                    'montoCuota': float(round(item['montoCuota'], 6)),
                    'commission': float(round(item['commission'], 6)),
                    'prize': float(round(prize, 6)),
                }
            )

        out_rows.sort(key=lambda r: (_month_serial(r['month']), r['supervisor'], r['un'], r['via']))
        return {
            'rows': out_rows,
            'totalContracts': int(total_contracts),
            'bySupervisor': by_supervisor,
            'meta': {
                'source': 'api-v1',
                'generated_at': datetime.utcnow().isoformat(),
                'count': len(out_rows),
            },
        }

    @staticmethod
    def fetch_portfolio_options_v1(db: Session, filters: AnalyticsFilters) -> dict:
        supervisor_filter = _normalize_str_set(filters.supervisor)
        un_filter = _normalize_str_set(filters.un)
        via_filter = _normalize_str_set(filters.via_cobro)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}
        month_filter = {str(v).strip() for v in (filters.contract_month or []) if str(v).strip()}
        close_month_filter = {str(v).strip() for v in (filters.close_month or []) if str(v).strip()}
        category_filter = _normalize_str_set(filters.categoria)
        tramo_filter = _normalize_str_set(filters.tramo)
        via_expr = _via_class_expr()
        category_expr = category_expr_for_tramo(CarteraFact.tramo)

        base = db.query(CarteraFact)
        if supervisor_filter:
            base = base.filter(CarteraFact.supervisor.in_(supervisor_filter))
        if un_filter:
            base = base.filter(CarteraFact.un.in_(un_filter))
        if via_filter:
            base = base.filter(via_expr.in_(via_filter))
        if year_filter:
            years = [int(y) for y in year_filter if y.isdigit()]
            if years:
                base = base.filter(CarteraFact.close_year.in_(years))
        if month_filter:
            base = base.filter(CarteraFact.gestion_month.in_(month_filter))
        if close_month_filter:
            base = base.filter(CarteraFact.close_month.in_(close_month_filter))
        if tramo_filter:
            tramos = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramos:
                base = base.filter(CarteraFact.tramo.in_(tramos))
        if category_filter:
            base = base.filter(category_expr.in_(category_filter))

        uns = [str(v[0]).strip().upper() for v in base.with_entities(CarteraFact.un).distinct().all() if str(v[0] or '').strip()]
        months = [str(v[0]) for v in base.with_entities(CarteraFact.gestion_month).distinct().all() if str(v[0] or '').strip()]
        close_months = [str(v[0]) for v in base.with_entities(CarteraFact.close_month).distinct().all() if str(v[0] or '').strip()]
        vias = [str(v[0]).strip().upper() for v in base.with_entities(via_expr.label('via_class')).distinct().all() if str(v[0] or '').strip()]
        tramos = [str(v[0]) for v in base.with_entities(CarteraFact.tramo).distinct().order_by(CarteraFact.tramo).all() if v[0] is not None]
        categories = [
            str(v[0])
            for v in base.with_entities(category_expr.label('category')).distinct().all()
            if str(v[0] or '').strip()
        ]

        return {
            'options': {
                'uns': sorted(set(uns)),
                'months': sorted(set(months), key=_month_serial),
                'close_months': sorted(set(close_months), key=_month_serial),
                'vias': sorted(set(vias)),
                'tramos': sorted(set(tramos), key=lambda x: int(x) if str(x).isdigit() else 999),
                'categories': sorted(set(categories)),
            },
            'meta': {
                'source_table': 'cartera_fact',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_portfolio_summary_v1(db: Session, filters: PortfolioSummaryIn) -> dict:
        supervisor_filter = _normalize_str_set(filters.supervisor)
        un_filter = _normalize_str_set(filters.un)
        via_filter = _normalize_str_set(filters.via_cobro)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}
        month_filter = {str(v).strip() for v in (filters.contract_month or []) if str(v).strip()}
        close_month_filter = {str(v).strip() for v in (filters.close_month or []) if str(v).strip()}
        category_filter = _normalize_str_set(filters.categoria)
        tramo_filter = _normalize_str_set(filters.tramo)
        via_expr = _via_class_expr()
        category_expr = category_expr_for_tramo(CarteraFact.tramo)

        base = db.query(CarteraFact)
        if supervisor_filter:
            base = base.filter(CarteraFact.supervisor.in_(supervisor_filter))
        if un_filter:
            base = base.filter(CarteraFact.un.in_(un_filter))
        if via_filter:
            base = base.filter(via_expr.in_(via_filter))
        if year_filter:
            years = [int(y) for y in year_filter if y.isdigit()]
            if years:
                base = base.filter(CarteraFact.close_year.in_(years))
        if month_filter:
            base = base.filter(CarteraFact.gestion_month.in_(month_filter))
        if close_month_filter:
            base = base.filter(CarteraFact.close_month.in_(close_month_filter))
        if tramo_filter:
            tramos = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramos:
                base = base.filter(CarteraFact.tramo.in_(tramos))
        if category_filter:
            base = base.filter(category_expr.in_(category_filter))

        if db.bind is not None and db.bind.dialect.name == 'postgresql':
            monto_cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
            monto_cuota_expr = case(
                (monto_cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(monto_cuota_text, Numeric)),
                else_=literal(0),
            )
        else:
            monto_cuota_expr = literal(0)

        totals = (
            base.with_entities(
                func.coalesce(func.sum(CarteraFact.contracts_total), 0),
                func.coalesce(func.sum(CarteraFact.total_saldo), 0.0),
                func.coalesce(func.sum(CarteraFact.monto_vencido), 0.0),
                func.coalesce(func.sum(monto_cuota_expr), 0),
                func.count(CarteraFact.id),
            )
            .first()
        )
        total_contracts = int(totals[0] or 0)
        debt_total = float(totals[1] or 0.0)
        expired_total = float(totals[2] or 0.0)
        cuota_total = float(totals[3] or 0.0)
        total_rows = int(totals[4] or 0)

        by_un_rows = (
            base.with_entities(CarteraFact.un, func.coalesce(func.sum(CarteraFact.contracts_total), 0))
            .group_by(CarteraFact.un)
            .all()
        )
        by_tramo_rows = (
            base.with_entities(CarteraFact.tramo, func.coalesce(func.sum(CarteraFact.contracts_total), 0))
            .group_by(CarteraFact.tramo)
            .all()
        )
        by_via_rows = (
            base.with_entities(via_expr.label('via_class'), func.coalesce(func.sum(CarteraFact.contracts_total), 0))
            .group_by(via_expr)
            .all()
        )
        by_category_rows = (
            base.with_entities(category_expr.label('category'), func.coalesce(func.sum(CarteraFact.contracts_total), 0))
            .group_by(category_expr)
            .all()
        )
        if db.bind is not None and db.bind.dialect.name == 'postgresql':
            fecha_contrato_expr = cast(CarteraFact.payload_json, JSONB).op('->>')('fecha_contrato')
            contract_year_expr = case(
                (fecha_contrato_expr.op('~')(r'^\d{4}[-/]'), cast(func.substring(fecha_contrato_expr, 1, 4), Integer)),
                (fecha_contrato_expr.op('~')(r'^\d{2}/\d{2}/\d{4}$'), cast(func.substring(fecha_contrato_expr, 7, 4), Integer)),
                else_=None,
            )
        else:
            contract_year_expr = CarteraFact.close_year
        by_contract_year_rows = (
            base.with_entities(contract_year_expr.label('contract_year'), func.coalesce(func.sum(CarteraFact.contracts_total), 0))
            .filter(contract_year_expr.isnot(None))
            .group_by(contract_year_expr)
            .order_by(contract_year_expr)
            .all()
        )

        out_rows: list[dict] = []
        if bool(filters.include_rows):
            row_query = (
                base.with_entities(
                    CarteraFact.contract_id,
                    CarteraFact.supervisor,
                    CarteraFact.un,
                    via_expr.label('via_class'),
                    CarteraFact.tramo,
                    CarteraFact.close_month,
                    CarteraFact.close_year,
                    CarteraFact.contracts_total,
                    CarteraFact.total_saldo,
                    CarteraFact.monto_vencido,
                    category_expr.label('category'),
                )
                .order_by(CarteraFact.close_year, CarteraFact.close_month, CarteraFact.supervisor, CarteraFact.un)
                .limit(1200)
            )
            for r in row_query.all():
                out_rows.append(
                    {
                        'contract_id': str(r.contract_id),
                        'supervisor': str(r.supervisor or 'S/D'),
                        'un': str(r.un or 'S/D'),
                        'via': str(r.via_class or 'S/D'),
                        'tramo': str(r.tramo),
                        'category': str(r.category),
                        'month': str(r.close_month),
                        'year': str(r.close_year),
                        'contracts_total': int(r.contracts_total or 0),
                        'debt': float(round(float(r.total_saldo or 0.0), 2)),
                        'expired': float(round(float(r.monto_vencido or 0.0), 2)),
                    }
                )

        by_un = {str(k): int(v or 0) for k, v in by_un_rows}
        by_tramo = {str(k): int(v or 0) for k, v in by_tramo_rows}
        by_via = {str(k): int(v or 0) for k, v in by_via_rows}
        by_category = {str(k): int(v or 0) for k, v in by_category_rows}
        by_contract_year = {str(k): int(v or 0) for k, v in by_contract_year_rows if k is not None}

        max_payload_rows = 1200
        return {
            'rows': out_rows[:max_payload_rows],
            'charts': {
                'by_un': by_un,
                'by_tramo': by_tramo,
                'by_via': by_via,
                'by_category': by_category,
                'by_contract_year': by_contract_year,
            },
            'total_contracts': int(total_contracts),
            'total_rows': total_rows,
            'rows_limited': total_rows > max_payload_rows,
            'debt_total': round(debt_total, 2),
            'expired_total': round(expired_total, 2),
            'cuota_total': round(cuota_total, 2),
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def _portfolio_corte_month_filter(filters: AnalyticsFilters) -> set[str]:
        months = {str(v).strip() for v in (filters.gestion_month or []) if str(v).strip()}
        months.update({str(v).strip() for v in (filters.contract_month or []) if str(v).strip()})
        return months

    @staticmethod
    def _portfolio_corte_base(db: Session, filters: AnalyticsFilters):
        q = db.query(CarteraCorteAgg)
        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        categoria_filter = _normalize_str_set(filters.categoria)
        tramo_filter = _normalize_str_set(filters.tramo)
        close_month_filter = {str(v).strip() for v in (filters.close_month or []) if str(v).strip()}
        months_filter = AnalyticsService._portfolio_corte_month_filter(filters)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}

        if un_filter:
            q = q.filter(CarteraCorteAgg.un.in_(un_filter))
        if supervisor_filter:
            q = q.filter(CarteraCorteAgg.supervisor.in_(supervisor_filter))
        if via_filter:
            q = q.filter(CarteraCorteAgg.via_cobro.in_(via_filter))
        if categoria_filter:
            q = q.filter(CarteraCorteAgg.categoria.in_(categoria_filter))
        if tramo_filter:
            tramos = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramos:
                q = q.filter(CarteraCorteAgg.tramo.in_(tramos))
        if close_month_filter:
            q = q.filter(CarteraCorteAgg.close_month.in_(close_month_filter))
        if months_filter:
            q = q.filter(CarteraCorteAgg.gestion_month.in_(months_filter))
        if year_filter:
            years = [int(y) for y in year_filter if y.isdigit()]
            if years:
                q = q.filter(CarteraCorteAgg.contract_year.in_(years))
        return q

    @staticmethod
    def fetch_portfolio_corte_options_v2(db: Session, filters: AnalyticsFilters) -> dict:
        q = db.query(MvOptionsCartera)
        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        categoria_filter = _normalize_str_set(filters.categoria)
        tramo_filter = _normalize_str_set(filters.tramo)
        close_month_filter = {str(v).strip() for v in (filters.close_month or []) if str(v).strip()}
        months_filter = AnalyticsService._portfolio_corte_month_filter(filters)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}

        if un_filter:
            q = q.filter(MvOptionsCartera.un.in_(un_filter))
        if supervisor_filter:
            q = q.filter(MvOptionsCartera.supervisor.in_(supervisor_filter))
        if via_filter:
            q = q.filter(MvOptionsCartera.via_cobro.in_(via_filter))
        if categoria_filter:
            q = q.filter(MvOptionsCartera.categoria.in_(categoria_filter))
        if tramo_filter:
            tramos = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramos:
                q = q.filter(MvOptionsCartera.tramo.in_(tramos))
        if close_month_filter:
            q = q.filter(MvOptionsCartera.close_month.in_(close_month_filter))
        if months_filter:
            q = q.filter(MvOptionsCartera.gestion_month.in_(months_filter))
        if year_filter:
            years = [int(y) for y in year_filter if y.isdigit()]
            if years:
                q = q.filter(MvOptionsCartera.contract_year.in_(years))

        uns = [str(v[0]).strip().upper() for v in q.with_entities(MvOptionsCartera.un).distinct().all() if str(v[0] or '').strip()]
        supervisors = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsCartera.supervisor).distinct().all()
            if str(v[0] or '').strip()
        ]
        vias = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsCartera.via_cobro).distinct().all()
            if str(v[0] or '').strip()
        ]
        tramos = [
            str(v[0])
            for v in q.with_entities(MvOptionsCartera.tramo).distinct().order_by(MvOptionsCartera.tramo).all()
            if v[0] is not None
        ]
        categories = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsCartera.categoria).distinct().all()
            if str(v[0] or '').strip()
        ]
        gestion_months = [
            str(v[0])
            for v in q.with_entities(MvOptionsCartera.gestion_month).distinct().all()
            if str(v[0] or '').strip()
        ]
        close_months = [
            str(v[0])
            for v in q.with_entities(MvOptionsCartera.close_month).distinct().all()
            if str(v[0] or '').strip()
        ]
        contract_years = [
            str(v[0])
            for v in q.with_entities(MvOptionsCartera.contract_year).distinct().order_by(MvOptionsCartera.contract_year).all()
            if v[0] is not None and int(v[0]) > 0
        ]

        source_table = 'mv_options_cartera'
        if not any([uns, supervisors, vias, tramos, categories, gestion_months, close_months, contract_years]):
            base = AnalyticsService._portfolio_corte_base(db, filters)
            uns = [str(v[0]).strip().upper() for v in base.with_entities(CarteraCorteAgg.un).distinct().all() if str(v[0] or '').strip()]
            supervisors = [
                str(v[0]).strip().upper()
                for v in base.with_entities(CarteraCorteAgg.supervisor).distinct().all()
                if str(v[0] or '').strip()
            ]
            vias = [
                str(v[0]).strip().upper()
                for v in base.with_entities(CarteraCorteAgg.via_cobro).distinct().all()
                if str(v[0] or '').strip()
            ]
            tramos = [
                str(v[0])
                for v in base.with_entities(CarteraCorteAgg.tramo).distinct().order_by(CarteraCorteAgg.tramo).all()
                if v[0] is not None
            ]
            categories = [
                str(v[0]).strip().upper()
                for v in base.with_entities(CarteraCorteAgg.categoria).distinct().all()
                if str(v[0] or '').strip()
            ]
            gestion_months = [
                str(v[0])
                for v in base.with_entities(CarteraCorteAgg.gestion_month).distinct().all()
                if str(v[0] or '').strip()
            ]
            close_months = [
                str(v[0])
                for v in base.with_entities(CarteraCorteAgg.close_month).distinct().all()
                if str(v[0] or '').strip()
            ]
            contract_years = [
                str(v[0])
                for v in base.with_entities(CarteraCorteAgg.contract_year).distinct().order_by(CarteraCorteAgg.contract_year).all()
                if v[0] is not None and int(v[0]) > 0
            ]
            source_table = 'cartera_corte_agg'

        uns = sorted(set(uns) | set(_fetch_canonical_uns(db)))
        agg_gestion = [
            str(v[0])
            for v in db.query(CarteraCorteAgg.gestion_month).distinct().all()
            if str(v[0] or '').strip() and _month_serial(str(v[0]).strip()) > 0
        ]
        agg_close = [
            str(v[0])
            for v in db.query(CarteraCorteAgg.close_month).distinct().all()
            if str(v[0] or '').strip() and _month_serial(str(v[0]).strip()) > 0
        ]
        gestion_months_data = sorted(set(gestion_months), key=_month_serial)
        close_months_data = sorted(set(close_months), key=_month_serial)
        standard_gestion_months = _standard_calendar_months(STANDARD_GESTION_CALENDAR_START)
        standard_close_months = [
            _month_from_serial(_month_serial(mm) - 1)
            for mm in standard_gestion_months
            if _month_serial(mm) > 1
        ]
        all_gestion_months = gestion_months_data if gestion_months_data else standard_gestion_months
        all_close_months = close_months_data if close_months_data else standard_close_months
        return {
            'options': {
                'uns': sorted(set(uns)),
                'supervisors': sorted(set(supervisors)),
                'vias': sorted(set(vias)),
                'tramos': sorted(set(tramos), key=lambda x: int(x) if str(x).isdigit() else 999),
                'categories': sorted(set(categories)),
                'gestion_months': all_gestion_months,
                'close_months': all_close_months,
                'contract_years': sorted(set(contract_years), key=lambda x: int(x) if x.isdigit() else 0),
            },
            'meta': {
                'source_table': source_table,
                'last_data_gestion_month': gestion_months_data[-1] if gestion_months_data else None,
                'last_data_close_month': close_months_data[-1] if close_months_data else None,
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_portfolio_corte_summary_v2(db: Session, filters: PortfolioSummaryIn) -> dict:
        base = AnalyticsService._portfolio_corte_base(db, filters)
        totals = (
            base.with_entities(
                func.coalesce(func.sum(CarteraCorteAgg.contracts_total), 0),
                func.coalesce(func.sum(CarteraCorteAgg.vigentes_total), 0),
                func.coalesce(func.sum(CarteraCorteAgg.morosos_total), 0),
                func.coalesce(func.sum(CarteraCorteAgg.contracts_cobrador), 0),
                func.coalesce(func.sum(CarteraCorteAgg.contracts_debito), 0),
                func.coalesce(func.sum(CarteraCorteAgg.monto_total), 0.0),
                func.coalesce(func.sum(CarteraCorteAgg.monto_vencido_total), 0.0),
                func.coalesce(func.sum(CarteraCorteAgg.paid_total), 0.0),
            )
            .first()
        )

        total_contracts = int(totals[0] or 0)
        vigentes_total = int(totals[1] or 0)
        morosos_total = int(totals[2] or 0)
        contracts_cobrador = int(totals[3] or 0)
        contracts_debito = int(totals[4] or 0)
        monto_total = float(totals[5] or 0.0)
        monto_vencido_total = float(totals[6] or 0.0)
        paid_total = float(totals[7] or 0.0)

        by_un_rows = (
            base.with_entities(CarteraCorteAgg.un, func.coalesce(func.sum(CarteraCorteAgg.contracts_total), 0))
            .group_by(CarteraCorteAgg.un)
            .all()
        )
        by_un_gestion_rows = (
            base.with_entities(
                CarteraCorteAgg.gestion_month,
                CarteraCorteAgg.un,
                func.coalesce(func.sum(CarteraCorteAgg.contracts_total), 0),
            )
            .group_by(CarteraCorteAgg.gestion_month, CarteraCorteAgg.un)
            .all()
        )
        by_tramo_rows = (
            base.with_entities(CarteraCorteAgg.tramo, func.coalesce(func.sum(CarteraCorteAgg.contracts_total), 0))
            .group_by(CarteraCorteAgg.tramo)
            .all()
        )
        by_via_rows = (
            base.with_entities(CarteraCorteAgg.via_cobro, func.coalesce(func.sum(CarteraCorteAgg.contracts_total), 0))
            .group_by(CarteraCorteAgg.via_cobro)
            .all()
        )
        by_contract_year_rows = (
            base.with_entities(CarteraCorteAgg.contract_year, func.coalesce(func.sum(CarteraCorteAgg.contracts_total), 0))
            .filter(CarteraCorteAgg.contract_year > 0)
            .group_by(CarteraCorteAgg.contract_year)
            .order_by(CarteraCorteAgg.contract_year)
            .all()
        )

        series_vigente_moroso_rows = (
            base.with_entities(
                CarteraCorteAgg.gestion_month,
                func.coalesce(func.sum(CarteraCorteAgg.vigentes_total), 0),
                func.coalesce(func.sum(CarteraCorteAgg.morosos_total), 0),
            )
            .group_by(CarteraCorteAgg.gestion_month)
            .all()
        )
        series_via_rows = (
            base.with_entities(
                CarteraCorteAgg.gestion_month,
                func.coalesce(func.sum(CarteraCorteAgg.contracts_cobrador), 0),
                func.coalesce(func.sum(CarteraCorteAgg.contracts_debito), 0),
            )
            .group_by(CarteraCorteAgg.gestion_month)
            .all()
        )

        return {
            'kpis': {
                'total_cartera': total_contracts,
                'vigentes_total': vigentes_total,
                'morosos_total': morosos_total,
                'via_cobrador_total': contracts_cobrador,
                'via_debito_total': contracts_debito,
                'monto_total_corte': round(monto_total, 2),
                'monto_vencido_total': round(monto_vencido_total, 2),
                'paid_total': round(paid_total, 2),
            },
            'charts': {
                'by_un': {str(k): int(v or 0) for k, v in by_un_rows},
                'by_un_by_gestion_month': _nest_un_by_gestion_month(by_un_gestion_rows),
                'by_tramo': {str(k): int(v or 0) for k, v in by_tramo_rows},
                'by_via': {str(k): int(v or 0) for k, v in by_via_rows},
                'by_contract_year': {str(k): int(v or 0) for k, v in by_contract_year_rows if k is not None},
                'series_vigente_moroso_by_month': {
                    str(month): {'vigente': int(v or 0), 'moroso': int(m or 0)}
                    for month, v, m in series_vigente_moroso_rows
                },
                'series_cobrador_debito_by_month': {
                    str(month): {'cobrador': int(c or 0), 'debito': int(d or 0)}
                    for month, c, d in series_via_rows
                },
            },
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_corte_agg',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def _cohorte_orphan_cobranzas(
        db: Session,
        resolved_cutoff: str,
        effective_cartera_month: str,
        un_filter: set[str],
        supervisor_filter: set[str],
        via_filter: set[str],
    ) -> tuple[float, int, int]:
        """
        Cobranzas del mes de corte (payment_month) que no tienen cartera con esa fecha de gestión.
        Devuelve (cobrado_total, transacciones, contratos_que_pagaron).
        """
        contract_ids_in_cartera = {
            str(r[0] or '').strip()
            for r in db.query(CarteraFact.contract_id)
            .filter(CarteraFact.gestion_month == effective_cartera_month)
            .distinct()
            .all()
            if str(r[0] or '').strip()
        }
        cutoff_variants = _payment_month_variants(resolved_cutoff)
        if cutoff_variants:
            pm_filter = func.trim(CobranzasFact.payment_month).in_(cutoff_variants)
        else:
            pm_filter = func.trim(CobranzasFact.payment_month) == resolved_cutoff
        q = (
            db.query(CobranzasFact)
            .filter(pm_filter)
        )
        if contract_ids_in_cartera:
            q = q.filter(CobranzasFact.contract_id.notin_(contract_ids_in_cartera))
        if un_filter:
            q = q.filter(func.upper(func.coalesce(CobranzasFact.un, '')).in_([u.upper() for u in un_filter]))
        if supervisor_filter:
            q = q.filter(func.upper(func.coalesce(CobranzasFact.supervisor, '')).in_([s.upper() for s in supervisor_filter]))
        if via_filter:
            q = q.filter(func.upper(func.coalesce(CobranzasFact.via, '')).in_([v.upper() for v in via_filter]))
        orphan_cobrado = float(q.with_entities(func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0)).scalar() or 0.0)
        orphan_tx = int(q.with_entities(func.count()).scalar() or 0)
        orphan_pagaron = int(
            q.filter(CobranzasFact.payment_amount > 0)
            .with_entities(CobranzasFact.contract_id)
            .distinct()
            .count()
        )
        return orphan_cobrado, orphan_tx, orphan_pagaron

    @staticmethod
    def _cohorte_by_tramo_live(
        db: Session,
        resolved_cutoff: str,
        effective_cartera_month: str,
        un_filter: set[str],
        supervisor_filter: set[str],
        via_filter: set[str],
        category_filter: set[str],
    ) -> dict[str, dict]:
        if not resolved_cutoff or not effective_cartera_month:
            return {}
        cutoff_serial = _month_serial(resolved_cutoff)
        if cutoff_serial <= 0:
            return {}

        via_expr = _via_class_expr()
        if db.bind is not None and db.bind.dialect.name == 'postgresql':
            monto_cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
            monto_cuota_expr = case(
                (monto_cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(monto_cuota_text, Numeric)),
                else_=literal(0),
            )
        else:
            monto_cuota_expr = CarteraFact.cuota_amount

        category_expr = category_expr_for_tramo(CarteraFact.tramo)
        cartera_q = (
            db.query(
                CarteraFact.contract_id,
                CarteraFact.tramo,
                CarteraFact.payload_json,
                CarteraFact.monto_vencido,
                monto_cuota_expr.label('monto_cuota'),
                CarteraFact.un.label('un'),
                CarteraFact.supervisor.label('supervisor'),
                via_expr.label('via'),
                category_expr.label('category'),
            )
            .filter(CarteraFact.gestion_month == effective_cartera_month)
        )

        cutoff_variants = _payment_month_variants(resolved_cutoff)
        if cutoff_variants:
            pm_filter = func.trim(CobranzasFact.payment_month).in_(cutoff_variants)
        else:
            pm_filter = func.trim(CobranzasFact.payment_month) == resolved_cutoff
        paid_rows = (
            db.query(CobranzasFact.contract_id, func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0))
            .filter(pm_filter)
            .group_by(CobranzasFact.contract_id)
            .all()
        )
        paid_by_contract: dict[str, float] = {}
        for cid, amount in paid_rows:
            key = _normalize_contract_id_for_lookup(cid)
            if key:
                paid_by_contract[key] = paid_by_contract.get(key, 0.0) + float(amount or 0.0)

        by_tramo: dict[str, dict[str, float | int]] = {}
        for row in cartera_q.yield_per(2000):
            contract_id = str(row.contract_id or '').strip()
            if not contract_id:
                continue
            payload_raw = row.payload_json or '{}'
            try:
                payload = json.loads(payload_raw)
            except Exception:
                payload = {}
            sale_month = _month_from_any(payload.get('fecha_contrato'))
            sale_serial = _month_serial(sale_month)
            if sale_serial <= 0 or sale_serial > cutoff_serial:
                continue
            culm_month = _month_from_any(payload.get('fecha_culminacion'))
            culm_serial = _month_serial(culm_month)
            if culm_serial > 0 and culm_serial <= cutoff_serial:
                continue
            un = str(row.un or 'S/D').strip().upper()
            supervisor = str(row.supervisor or 'S/D').strip().upper()
            via = str(row.via or 'DEBITO').strip().upper()
            category = str(row.category or 'VIGENTE').strip().upper()
            if un_filter and un not in un_filter:
                continue
            if supervisor_filter and supervisor not in supervisor_filter:
                continue
            if via_filter and via not in via_filter:
                continue
            if category_filter and category not in category_filter:
                continue
            tramo_key = str(int(row.tramo or 0))
            deberia = float(_to_float(row.monto_cuota) + _to_float(row.monto_vencido))
            cobrado = float(paid_by_contract.get(_normalize_contract_id_for_lookup(contract_id), 0.0))
            pagaron = 1 if cobrado > 0 else 0
            bucket = by_tramo.setdefault(tramo_key, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
            bucket['activos'] = int(bucket['activos']) + 1
            bucket['pagaron'] = int(bucket['pagaron']) + pagaron
            bucket['deberia'] = float(bucket['deberia']) + deberia
            bucket['cobrado'] = float(bucket['cobrado']) + cobrado

        out: dict[str, dict] = {}
        for tramo, values in by_tramo.items():
            activos = int(values['activos'] or 0)
            pagaron = int(values['pagaron'] or 0)
            deberia = float(values['deberia'] or 0.0)
            cobrado = float(values['cobrado'] or 0.0)
            out[tramo] = {
                'activos': activos,
                'pagaron': pagaron,
                'deberia': round(deberia, 2),
                'cobrado': round(cobrado, 2),
                'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
            }
        return out

    @staticmethod
    def fetch_cobranzas_cohorte_options_v1(db: Session, filters: CobranzasCohorteIn) -> dict:
        q = db.query(MvOptionsCohorte)
        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        categoria_filter = _normalize_str_set(filters.categoria)
        cutoff_filter = {str(filters.cutoff_month or '').strip()} if str(filters.cutoff_month or '').strip() else set()
        if cutoff_filter:
            q = q.filter(MvOptionsCohorte.cutoff_month.in_(cutoff_filter))
        if un_filter:
            q = q.filter(MvOptionsCohorte.un.in_(un_filter))
        if supervisor_filter:
            q = q.filter(MvOptionsCohorte.supervisor.in_(supervisor_filter))
        if via_filter:
            q = q.filter(MvOptionsCohorte.via_cobro.in_(via_filter))
        if categoria_filter:
            q = q.filter(MvOptionsCohorte.categoria.in_(categoria_filter))

        cutoff_months_mv = sorted(
            {
                str(v[0]).strip()
                for v in q.with_entities(MvOptionsCohorte.cutoff_month).distinct().all()
                if str(v[0] or '').strip()
            },
            key=_month_serial,
        )
        standard_cutoff_months = _standard_calendar_months(STANDARD_GESTION_CALENDAR_START)
        if cutoff_months_mv:
            uns_mv = sorted(
                {
                    str(v[0]).strip().upper()
                    for v in q.with_entities(MvOptionsCohorte.un).distinct().all()
                    if str(v[0] or '').strip()
                }
            )
            agg_cutoff_months = [
                str(v[0]).strip()
                for v in db.query(CobranzasCohorteAgg.cutoff_month).distinct().all()
                if str(v[0] or '').strip()
            ]
            all_cutoff_months = sorted(
                set(cutoff_months_mv) | set(agg_cutoff_months) | set(standard_cutoff_months),
                key=_month_serial,
            )
            return {
                'options': {
                    'cutoff_months': all_cutoff_months,
                    'uns': sorted(set(uns_mv) | set(_fetch_canonical_uns(db))),
                    'supervisors': sorted(
                        {
                            str(v[0]).strip().upper()
                            for v in q.with_entities(MvOptionsCohorte.supervisor).distinct().all()
                            if str(v[0] or '').strip()
                        }
                    ),
                    'vias': sorted(
                        {
                            str(v[0]).strip().upper()
                            for v in q.with_entities(MvOptionsCohorte.via_cobro).distinct().all()
                            if str(v[0] or '').strip()
                        }
                    ),
                    'categories': sorted(
                        {
                            str(v[0]).strip().upper()
                            for v in q.with_entities(MvOptionsCohorte.categoria).distinct().all()
                            if str(v[0] or '').strip()
                        }
                    ) or ['MOROSO', 'VIGENTE'],
                },
                'default_cutoff': cutoff_months_mv[-1],
                'meta': {
                    'source': 'api-v1',
                    'source_table': 'mv_options_cohorte',
                    'last_data_cutoff_month': cutoff_months_mv[-1] if cutoff_months_mv else None,
                    'generated_at': datetime.utcnow().isoformat(),
                },
            }
        # Unión de meses: cobranzas_fact (payment_month) y cartera (gestion_month) para que
        # el dropdown muestre todos los meses con datos de cartera o cobranzas.
        months_set = set()
        for row in db.query(CobranzasFact.payment_month).distinct().all():
            if str(row[0] or '').strip():
                months_set.add(str(row[0]).strip())
        for row in db.query(CarteraFact.gestion_month).distinct().all():
            if str(row[0] or '').strip():
                months_set.add(str(row[0]).strip())
        if not months_set:
            for row in db.query(CobranzasCohorteAgg.cutoff_month).distinct().all():
                if str(row[0] or '').strip():
                    months_set.add(str(row[0]).strip())
        cutoff_months = sorted(months_set, key=_month_serial)
        default_cutoff = cutoff_months[-1] if cutoff_months else None

        # Use aggregated table for instant options in UI preload.
        uns = [
            str(v[0] or '').strip().upper()
            for v in db.query(CobranzasCohorteAgg.un).distinct().all()
            if str(v[0] or '').strip()
        ]
        supervisors = [
            str(v[0] or '').strip().upper()
            for v in db.query(CobranzasCohorteAgg.supervisor).distinct().all()
            if str(v[0] or '').strip()
        ]
        vias = [
            str(v[0] or '').strip().upper()
            for v in db.query(CobranzasCohorteAgg.via_cobro).distinct().all()
            if str(v[0] or '').strip()
        ]
        categories = [
            str(v[0] or '').strip().upper()
            for v in db.query(CobranzasCohorteAgg.categoria).distinct().all()
            if str(v[0] or '').strip()
        ]
        if not uns:
            uns = [
                str(v[0] or '').strip().upper()
                for v in db.query(CarteraCorteAgg.un).distinct().all()
                if str(v[0] or '').strip()
            ]
        if not supervisors:
            supervisors = [
                str(v[0] or '').strip().upper()
                for v in db.query(CarteraCorteAgg.supervisor).distinct().all()
                if str(v[0] or '').strip()
            ]
        if not vias:
            vias = [
                str(v[0] or '').strip().upper()
                for v in db.query(CarteraCorteAgg.via_cobro).distinct().all()
                if str(v[0] or '').strip()
            ]
        if not categories:
            categories = [
                str(v[0] or '').strip().upper()
                for v in db.query(CarteraCorteAgg.categoria).distinct().all()
                if str(v[0] or '').strip()
            ]

        all_cutoff_months_fallback = sorted(
            set(cutoff_months) | set(standard_cutoff_months),
            key=_month_serial,
        )
        return {
            'options': {
                'cutoff_months': all_cutoff_months_fallback,
                'uns': sorted(set(uns) | set(_fetch_canonical_uns(db))),
                'supervisors': sorted(set(supervisors)),
                'vias': sorted(set(vias)),
                'categories': sorted(set(categories)) or ['MOROSO', 'VIGENTE'],
            },
            'default_cutoff': default_cutoff,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cobranzas_cohorte_agg',
                'last_data_cutoff_month': default_cutoff,
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_cobranzas_cohorte_summary_v1(db: Session, filters: CobranzasCohorteIn) -> dict:
        resolved_cutoff = str(filters.cutoff_month or '').strip()
        if not resolved_cutoff:
            payment_months = [
                str(v[0]).strip()
                for v in db.query(CobranzasFact.payment_month).distinct().all()
                if _month_serial(str(v[0] or '').strip()) > 0
            ]
            resolved_cutoff = _latest_month(payment_months)
        if not resolved_cutoff:
            return {
                'cutoff_month': '',
                'totals': {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
                'by_sale_month': [],
                'by_year': {},
                'by_tramo': {},
                'meta': {'source': 'api-v1', 'generated_at': datetime.utcnow().isoformat()},
            }

        cutoff_serial = _month_serial(resolved_cutoff)
        if cutoff_serial <= 0:
            raise ValueError(f'cutoff_month inválido: {resolved_cutoff}')

        # If cartera does not have rows for selected cutoff, fallback to the latest
        # available cartera month <= cutoff so the cohort report is still useful.
        effective_cartera_month = _effective_cartera_month_for_cutoff(db, resolved_cutoff)
        if not effective_cartera_month:
            return {
                'cutoff_month': resolved_cutoff,
                'effective_cartera_month': '',
                'totals': {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
                'by_sale_month': [],
                'by_year': {},
                'by_tramo': {},
                'meta': {
                    'source': 'api-v1',
                    'reason': 'no_cartera_month_for_cutoff',
                    'generated_at': datetime.utcnow().isoformat(),
                },
            }

        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        category_filter = _normalize_str_set(filters.categoria)
        preagg_q = db.query(CobranzasCohorteAgg).filter(CobranzasCohorteAgg.cutoff_month == resolved_cutoff)
        if un_filter:
            preagg_q = preagg_q.filter(CobranzasCohorteAgg.un.in_(un_filter))
        if supervisor_filter:
            preagg_q = preagg_q.filter(CobranzasCohorteAgg.supervisor.in_(supervisor_filter))
        if via_filter:
            preagg_q = preagg_q.filter(CobranzasCohorteAgg.via_cobro.in_(via_filter))
        if category_filter:
            preagg_q = preagg_q.filter(CobranzasCohorteAgg.categoria.in_(category_filter))

        preagg_rows = preagg_q.all()
        if preagg_rows:
            totals = {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0}
            by_sale_month: dict[str, dict[str, float | int]] = {}
            by_year: dict[str, dict[str, float | int]] = {}
            for row in preagg_rows:
                sale_month = str(row.sale_month or '')
                activos = int(row.activos or 0)
                pagaron = int(row.pagaron or 0)
                deberia = float(row.deberia or 0.0)
                cobrado = float(row.cobrado or 0.0)
                transacciones = int(row.transacciones or 0)
                bucket = by_sale_month.setdefault(sale_month, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
                bucket['activos'] = int(bucket['activos']) + activos
                bucket['pagaron'] = int(bucket['pagaron']) + pagaron
                bucket['deberia'] = float(bucket['deberia']) + deberia
                bucket['cobrado'] = float(bucket['cobrado']) + cobrado
                year = sale_month.split('/')[1] if '/' in sale_month else 'S/D'
                yb = by_year.setdefault(year, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
                yb['activos'] = int(yb['activos']) + activos
                yb['pagaron'] = int(yb['pagaron']) + pagaron
                yb['deberia'] = float(yb['deberia']) + deberia
                yb['cobrado'] = float(yb['cobrado']) + cobrado
                totals['activos'] += activos
                totals['pagaron'] += pagaron
                totals['deberia'] += deberia
                totals['cobrado'] += cobrado
                totals['transacciones'] += transacciones

            # Incluir cobranzas del mes de corte que no tienen cartera con esa fecha de gestión.
            orphan_cobrado, orphan_tx, orphan_pagaron = AnalyticsService._cohorte_orphan_cobranzas(
                db, resolved_cutoff, resolved_cutoff, un_filter, supervisor_filter, via_filter,
            )
            totals['cobrado'] += orphan_cobrado
            totals['transacciones'] += orphan_tx
            totals['pagaron'] += orphan_pagaron

            # Si el agregado tiene cobrado=0, siempre recalcular en vivo (cobranzas_fact + cartera_fact)
            # para no depender de un agregado desactualizado ni del formato de payment_month.
            if totals['cobrado'] == 0:
                preagg_rows = []

            if preagg_rows:
                rows = []
                for sale_month, values in sorted(by_sale_month.items(), key=lambda item: _month_serial(item[0])):
                    activos = int(values['activos'] or 0)
                    pagaron = int(values['pagaron'] or 0)
                    deberia = float(values['deberia'] or 0.0)
                    cobrado = float(values['cobrado'] or 0.0)
                    rows.append(
                        {
                            'sale_month': sale_month,
                            'activos': activos,
                            'pagaron': pagaron,
                            'deberia': round(deberia, 2),
                            'cobrado': round(cobrado, 2),
                            'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                            'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
                        }
                    )

                by_year_out: dict[str, dict] = {}
                for year, values in by_year.items():
                    activos = int(values['activos'] or 0)
                    pagaron = int(values['pagaron'] or 0)
                    deberia = float(values['deberia'] or 0.0)
                    cobrado = float(values['cobrado'] or 0.0)
                    by_year_out[year] = {
                        'activos': activos,
                        'pagaron': pagaron,
                        'deberia': round(deberia, 2),
                        'cobrado': round(cobrado, 2),
                        'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                        'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
                    }
                by_tramo_out = AnalyticsService._cohorte_by_tramo_live(
                    db,
                    resolved_cutoff,
                    effective_cartera_month,
                    un_filter,
                    supervisor_filter,
                    via_filter,
                    category_filter,
                )

                return {
                    'cutoff_month': resolved_cutoff,
                    'effective_cartera_month': effective_cartera_month,
                    'totals': {
                        'activos': int(totals['activos']),
                        'pagaron': int(totals['pagaron']),
                        'deberia': round(float(totals['deberia']), 2),
                        'cobrado': round(float(totals['cobrado']), 2),
                        'transacciones': int(totals['transacciones']),
                        'pct_pago_contratos': round((totals['pagaron'] / totals['activos']) if totals['activos'] > 0 else 0.0, 6),
                        'pct_cobertura_monto': round((totals['cobrado'] / totals['deberia']) if totals['deberia'] > 0 else 0.0, 6),
                    },
                    'by_sale_month': rows,
                    'by_year': by_year_out,
                    'by_tramo': by_tramo_out,
                    'meta': {
                        'source': 'api-v1',
                        'source_table': 'cobranzas_cohorte_agg',
                        'generated_at': datetime.utcnow().isoformat(),
                    },
                }

        # Regla de negocio AGENTS: VIGENTE=tramo 0..3, MOROSO=tramo > 3.
        category_expr = category_expr_for_tramo(CarteraFact.tramo)

        if db.bind is not None and db.bind.dialect.name == 'postgresql':
            monto_cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
            monto_cuota_expr = case(
                (monto_cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(monto_cuota_text, Numeric)),
                else_=literal(0),
            )
        else:
            monto_cuota_expr = literal(0)
        via_expr = _via_class_expr()

        cartera_q = (
            db.query(
                CarteraFact.contract_id,
                CarteraFact.tramo,
                CarteraFact.payload_json,
                CarteraFact.monto_vencido,
                monto_cuota_expr.label('monto_cuota'),
                CarteraFact.un.label('un'),
                CarteraFact.supervisor.label('supervisor'),
                via_expr.label('via'),
                category_expr.label('category'),
            )
            .filter(CarteraFact.gestion_month == effective_cartera_month)
        )

        by_sale_month: dict[str, dict[str, float | int]] = {}
        by_year: dict[str, dict[str, float | int]] = {}
        by_tramo: dict[str, dict[str, float | int]] = {}
        totals = {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0}

        cutoff_variants = _payment_month_variants(resolved_cutoff)
        if cutoff_variants:
            pm_filter = func.trim(CobranzasFact.payment_month).in_(cutoff_variants)
        else:
            pm_filter = func.trim(CobranzasFact.payment_month) == resolved_cutoff
        paid_rows = (
            db.query(
                CobranzasFact.contract_id,
                func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0),
                func.coalesce(
                    func.sum(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))),
                    0,
                ),
            )
            .filter(pm_filter)
            .group_by(CobranzasFact.contract_id)
            .all()
        )
        paid_by_contract = {}
        tx_by_contract = {}
        for cid, amount, tx_count in paid_rows:
            key = _normalize_contract_id_for_lookup(cid)
            if key:
                paid_by_contract[key] = paid_by_contract.get(key, 0.0) + float(amount or 0.0)
                tx_by_contract[key] = tx_by_contract.get(key, 0) + int(tx_count or 0)

        base_cache_key = f'{resolved_cutoff}|{effective_cartera_month}'
        base_rows = _cohorte_base_cache_get(base_cache_key)
        if base_rows is None:
            base_rows = []
            for row in cartera_q.yield_per(2000):
                contract_id = str(row.contract_id or '').strip()
                if not contract_id:
                    continue
                payload_raw = row.payload_json or '{}'
                try:
                    payload = json.loads(payload_raw)
                except Exception:
                    payload = {}
                sale_month = _month_from_any(payload.get('fecha_contrato'))
                sale_serial = _month_serial(sale_month)
                if sale_serial <= 0 or sale_serial > cutoff_serial:
                    continue
                culm_month = _month_from_any(payload.get('fecha_culminacion'))
                culm_serial = _month_serial(culm_month)
                if culm_serial > 0 and culm_serial <= cutoff_serial:
                    continue
                deberia = float(_to_float(row.monto_cuota) + _to_float(row.monto_vencido))
                base_rows.append(
                    {
                        'contract_id': contract_id,
                        'tramo': int(row.tramo or 0),
                        'sale_month': sale_month,
                        'un': str(row.un or 'S/D').strip().upper(),
                        'supervisor': str(row.supervisor or 'S/D').strip().upper(),
                        'via': str(row.via or 'DEBITO').strip().upper(),
                        'category': str(row.category or 'VIGENTE').strip().upper(),
                        'deberia': deberia,
                    }
                )
            _cohorte_base_cache_set(base_cache_key, base_rows)

        for row in base_rows:
            if un_filter and row['un'] not in un_filter:
                continue
            if supervisor_filter and row['supervisor'] not in supervisor_filter:
                continue
            if via_filter and row['via'] not in via_filter:
                continue
            if category_filter and row['category'] not in category_filter:
                continue
            # Siempre tomar cobrado/transacciones de la consulta actual (paid_by_contract), no del caché
            cid = str(row.get('contract_id') or '').strip()
            if cid:
                cid_key = _normalize_contract_id_for_lookup(cid)
                cobrado = float(paid_by_contract.get(cid_key, 0.0))
                transacciones = int(tx_by_contract.get(cid_key, 0))
            else:
                cobrado = 0.0
                transacciones = 0
            pagaron = 1 if cobrado > 0 else 0
            sale_month = row['sale_month']
            tramo = str(int(row.get('tramo') or 0))
            deberia = float(row['deberia'])
            bucket = by_sale_month.setdefault(sale_month, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
            bucket['activos'] = int(bucket['activos']) + 1
            bucket['pagaron'] = int(bucket['pagaron']) + pagaron
            bucket['deberia'] = float(bucket['deberia']) + deberia
            bucket['cobrado'] = float(bucket['cobrado']) + cobrado
            year = sale_month.split('/')[1] if '/' in sale_month else 'S/D'
            yb = by_year.setdefault(year, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
            yb['activos'] = int(yb['activos']) + 1
            yb['pagaron'] = int(yb['pagaron']) + pagaron
            yb['deberia'] = float(yb['deberia']) + deberia
            yb['cobrado'] = float(yb['cobrado']) + cobrado
            tb = by_tramo.setdefault(tramo, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
            tb['activos'] = int(tb['activos']) + 1
            tb['pagaron'] = int(tb['pagaron']) + pagaron
            tb['deberia'] = float(tb['deberia']) + deberia
            tb['cobrado'] = float(tb['cobrado']) + cobrado
            totals['activos'] += 1
            totals['pagaron'] += pagaron
            totals['deberia'] += deberia
            totals['cobrado'] += cobrado
            totals['transacciones'] += transacciones

        # Incluir cobranzas del mes de corte que no tienen cartera con esa fecha de gestión.
        orphan_cobrado, orphan_tx, orphan_pagaron = AnalyticsService._cohorte_orphan_cobranzas(
            db, resolved_cutoff, effective_cartera_month, un_filter, supervisor_filter, via_filter,
        )
        totals['cobrado'] += orphan_cobrado
        totals['transacciones'] += orphan_tx
        totals['pagaron'] += orphan_pagaron

        rows = []
        for sale_month, values in sorted(by_sale_month.items(), key=lambda item: _month_serial(item[0])):
            activos = int(values['activos'] or 0)
            pagaron = int(values['pagaron'] or 0)
            deberia = float(values['deberia'] or 0.0)
            cobrado = float(values['cobrado'] or 0.0)
            rows.append(
                {
                    'sale_month': sale_month,
                    'activos': activos,
                    'pagaron': pagaron,
                    'deberia': round(deberia, 2),
                    'cobrado': round(cobrado, 2),
                    'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                    'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
                }
            )

        by_year_out: dict[str, dict] = {}
        for year, values in by_year.items():
            activos = int(values['activos'] or 0)
            pagaron = int(values['pagaron'] or 0)
            deberia = float(values['deberia'] or 0.0)
            cobrado = float(values['cobrado'] or 0.0)
            by_year_out[year] = {
                'activos': activos,
                'pagaron': pagaron,
                'deberia': round(deberia, 2),
                'cobrado': round(cobrado, 2),
                'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
            }
        by_tramo_out: dict[str, dict] = {}
        for tramo, values in by_tramo.items():
            activos = int(values['activos'] or 0)
            pagaron = int(values['pagaron'] or 0)
            deberia = float(values['deberia'] or 0.0)
            cobrado = float(values['cobrado'] or 0.0)
            by_tramo_out[tramo] = {
                'activos': activos,
                'pagaron': pagaron,
                'deberia': round(deberia, 2),
                'cobrado': round(cobrado, 2),
                'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
            }

        cobranzas_fact_contracts = len(paid_by_contract)
        cobranzas_fact_sum = sum(paid_by_contract.values())
        return {
            'cutoff_month': resolved_cutoff,
            'effective_cartera_month': effective_cartera_month,
            'totals': {
                'activos': int(totals['activos']),
                'pagaron': int(totals['pagaron']),
                'deberia': round(float(totals['deberia']), 2),
                'cobrado': round(float(totals['cobrado']), 2),
                'transacciones': int(totals['transacciones']),
                'pct_pago_contratos': round((totals['pagaron'] / totals['activos']) if totals['activos'] > 0 else 0.0, 6),
                'pct_cobertura_monto': round((totals['cobrado'] / totals['deberia']) if totals['deberia'] > 0 else 0.0, 6),
            },
            'by_sale_month': rows,
            'by_year': by_year_out,
            'by_tramo': by_tramo_out,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact + cobranzas_fact',
                'generated_at': datetime.utcnow().isoformat(),
                'cobranzas_fact_contracts_for_cutoff': cobranzas_fact_contracts,
                'cobranzas_fact_sum_for_cutoff': round(cobranzas_fact_sum, 2),
            },
        }

    @staticmethod
    def _cohorte_preagg_rollup(
        db: Session,
        cutoff_month: str,
        un_filter: set[str],
        supervisor_filter: set[str],
        via_filter: set[str],
        category_filter: set[str],
    ) -> tuple[dict, list[dict], dict[str, dict], dict[str, object]]:
        q = db.query(CobranzasCohorteAgg).filter(CobranzasCohorteAgg.cutoff_month == cutoff_month)
        if un_filter:
            q = q.filter(CobranzasCohorteAgg.un.in_(un_filter))
        if supervisor_filter:
            q = q.filter(CobranzasCohorteAgg.supervisor.in_(supervisor_filter))
        if via_filter:
            q = q.filter(CobranzasCohorteAgg.via_cobro.in_(via_filter))
        if category_filter:
            q = q.filter(CobranzasCohorteAgg.categoria.in_(category_filter))
        preagg_rows = q.all()
        totals = {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0}
        by_sale_month: dict[str, dict[str, float | int]] = {}
        by_year: dict[str, dict[str, float | int]] = {}
        for row in preagg_rows:
            sale_month = str(row.sale_month or '')
            activos = int(row.activos or 0)
            pagaron = int(row.pagaron or 0)
            deberia = float(row.deberia or 0.0)
            cobrado = float(row.cobrado or 0.0)
            transacciones = int(row.transacciones or 0)
            bucket = by_sale_month.setdefault(
                sale_month,
                {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
            )
            bucket['activos'] = int(bucket['activos']) + activos
            bucket['pagaron'] = int(bucket['pagaron']) + pagaron
            bucket['deberia'] = float(bucket['deberia']) + deberia
            bucket['cobrado'] = float(bucket['cobrado']) + cobrado
            bucket['transacciones'] = int(bucket['transacciones']) + transacciones
            year = sale_month.split('/')[1] if '/' in sale_month else 'S/D'
            yb = by_year.setdefault(year, {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0})
            yb['activos'] = int(yb['activos']) + activos
            yb['pagaron'] = int(yb['pagaron']) + pagaron
            yb['deberia'] = float(yb['deberia']) + deberia
            yb['cobrado'] = float(yb['cobrado']) + cobrado
            totals['activos'] += activos
            totals['pagaron'] += pagaron
            totals['deberia'] += deberia
            totals['cobrado'] += cobrado
            totals['transacciones'] += transacciones

        by_sale_month_rows: list[dict] = []
        for sale_month, values in sorted(by_sale_month.items(), key=lambda item: _month_serial(item[0])):
            activos = int(values['activos'] or 0)
            pagaron = int(values['pagaron'] or 0)
            deberia = float(values['deberia'] or 0.0)
            cobrado = float(values['cobrado'] or 0.0)
            by_sale_month_rows.append(
                {
                    'sale_month': sale_month,
                    'activos': activos,
                    'pagaron': pagaron,
                    'deberia': round(deberia, 2),
                    'cobrado': round(cobrado, 2),
                    'transacciones': int(values.get('transacciones') or 0),
                    'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                    'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
                }
            )

        by_year_out: dict[str, dict] = {}
        for year, values in by_year.items():
            activos = int(values['activos'] or 0)
            pagaron = int(values['pagaron'] or 0)
            deberia = float(values['deberia'] or 0.0)
            cobrado = float(values['cobrado'] or 0.0)
            by_year_out[year] = {
                'activos': activos,
                'pagaron': pagaron,
                'deberia': round(deberia, 2),
                'cobrado': round(cobrado, 2),
                'pct_pago_contratos': round((pagaron / activos) if activos > 0 else 0.0, 6),
                'pct_cobertura_monto': round((cobrado / deberia) if deberia > 0 else 0.0, 6),
            }
        return totals, by_sale_month_rows, by_year_out, {'rows_count': len(preagg_rows)}

    @staticmethod
    def fetch_cobranzas_cohorte_first_paint_v2(db: Session, filters: CobranzasCohorteFirstPaintIn) -> dict:
        resolved_cutoff = str(filters.cutoff_month or '').strip()
        if not resolved_cutoff:
            cutoff_months = [
                str(v[0]).strip()
                for v in db.query(CobranzasCohorteAgg.cutoff_month).distinct().all()
                if _month_serial(str(v[0] or '').strip()) > 0
            ]
            resolved_cutoff = _latest_month(cutoff_months)
        if not resolved_cutoff:
            return {
                'cutoff_month': '',
                'effective_cartera_month': '',
                'totals': {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
                'by_year': {},
                'by_tramo': {},
                'top_sale_months': [],
                'meta': {'source': 'api-v1', 'source_table': 'cobranzas_cohorte_agg', 'payload_mode': 'first_paint'},
            }

        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        category_filter = _normalize_str_set(filters.categoria)
        totals, by_sale_month_rows, by_year_out, stats = AnalyticsService._cohorte_preagg_rollup(
            db,
            resolved_cutoff,
            un_filter,
            supervisor_filter,
            via_filter,
            category_filter,
        )
        if int(stats.get('rows_count') or 0) <= 0:
            # Controlled fallback for sparse aggregate scenarios.
            fallback = AnalyticsService.fetch_cobranzas_cohorte_summary_v1(db, CobranzasCohorteIn(**filters.model_dump()))
            rows = list(fallback.get('by_sale_month') or [])
            top_n = min(max(int(filters.top_n_sale_months or 12), 1), 36)
            top_rows = sorted(rows, key=lambda r: float(r.get('cobrado') or 0.0), reverse=True)[:top_n]
            return {
                'cutoff_month': fallback.get('cutoff_month') or resolved_cutoff,
                'effective_cartera_month': fallback.get('effective_cartera_month') or resolved_cutoff,
                'totals': fallback.get('totals') or totals,
                'by_year': fallback.get('by_year') or {},
                'by_tramo': fallback.get('by_tramo') or {},
                'top_sale_months': top_rows,
                'meta': {
                    'source': 'api-v1',
                    'source_table': 'cobranzas_cohorte_agg + cartera_fact + cobranzas_fact',
                    'payload_mode': 'first_paint',
                    'fallback_live_compute': True,
                    'generated_at': datetime.utcnow().isoformat(),
                },
            }

        effective_cartera_month = _effective_cartera_month_for_cutoff(db, resolved_cutoff)
        by_tramo_out = AnalyticsService._cohorte_by_tramo_live(
            db,
            resolved_cutoff,
            effective_cartera_month or resolved_cutoff,
            un_filter,
            supervisor_filter,
            via_filter,
            category_filter,
        )
        top_n = min(max(int(filters.top_n_sale_months or 12), 1), 36)
        top_rows = sorted(by_sale_month_rows, key=lambda r: float(r.get('cobrado') or 0.0), reverse=True)[:top_n]
        return {
            'cutoff_month': resolved_cutoff,
            'effective_cartera_month': effective_cartera_month or resolved_cutoff,
            'totals': {
                'activos': int(totals['activos']),
                'pagaron': int(totals['pagaron']),
                'deberia': round(float(totals['deberia']), 2),
                'cobrado': round(float(totals['cobrado']), 2),
                'transacciones': int(totals['transacciones']),
                'pct_pago_contratos': round((totals['pagaron'] / totals['activos']) if totals['activos'] > 0 else 0.0, 6),
                'pct_cobertura_monto': round((totals['cobrado'] / totals['deberia']) if totals['deberia'] > 0 else 0.0, 6),
            },
            'by_year': by_year_out,
            'by_tramo': by_tramo_out,
            'top_sale_months': top_rows,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cobranzas_cohorte_agg',
                'payload_mode': 'first_paint',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_cobranzas_cohorte_detail_v2(db: Session, filters: CobranzasCohorteDetailIn) -> dict:
        base = AnalyticsService.fetch_cobranzas_cohorte_first_paint_v2(
            db, CobranzasCohorteFirstPaintIn(**filters.model_dump(exclude={'page', 'page_size', 'sort_by', 'sort_dir'}))
        )
        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        category_filter = _normalize_str_set(filters.categoria)
        _, by_sale_month_rows, _, stats = AnalyticsService._cohorte_preagg_rollup(
            db,
            str(base.get('cutoff_month') or ''),
            un_filter,
            supervisor_filter,
            via_filter,
            category_filter,
        )
        rows = by_sale_month_rows
        if int(stats.get('rows_count') or 0) <= 0:
            fallback = AnalyticsService.fetch_cobranzas_cohorte_summary_v1(db, CobranzasCohorteIn(**filters.model_dump()))
            rows = list(fallback.get('by_sale_month') or [])
        sort_by = str(filters.sort_by or 'sale_month')
        sort_dir = str(filters.sort_dir or 'asc').lower()
        reverse = sort_dir == 'desc'
        if sort_by == 'sale_month':
            rows = sorted(rows, key=lambda r: _month_serial(str(r.get('sale_month') or '')), reverse=reverse)
        else:
            rows = sorted(rows, key=lambda r: float(r.get(sort_by) or 0.0), reverse=reverse)
        page = int(filters.page or 1)
        page_size = int(filters.page_size or 24)
        total_items = len(rows)
        start = (page - 1) * page_size
        end = start + page_size
        items = rows[start:end]
        return {
            'cutoff_month': base.get('cutoff_month') or '',
            'effective_cartera_month': base.get('effective_cartera_month') or '',
            'items': items,
            'total_items': total_items,
            'page': page,
            'page_size': page_size,
            'has_next': end < total_items,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cobranzas_cohorte_agg',
                'payload_mode': 'detail',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_portfolio_corte_first_paint_v2(db: Session, filters: PortfolioSummaryIn) -> dict:
        full = AnalyticsService.fetch_portfolio_corte_summary_v2(db, filters)
        charts = dict(full.get('charts') or {})
        mini = {
            'by_un_top5': dict(sorted((charts.get('by_un') or {}).items(), key=lambda it: float(it[1] or 0), reverse=True)[:5]),
            'by_tramo': charts.get('by_tramo') or {},
        }
        return {
            'kpis': full.get('kpis') or {},
            'mini_charts': mini,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_corte_agg',
                'payload_mode': 'first_paint',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_portfolio_rolo_summary_v2(db: Session, filters: AnalyticsFilters) -> dict:
        close_month_filter = sorted(
            {
                str(v).strip()
                for v in (filters.close_month or [])
                if _month_serial(str(v).strip()) > 0
            },
            key=_month_serial,
        )
        resolved_close_month = close_month_filter[-1] if close_month_filter else (
            db.query(CarteraFact.close_month)
            .filter(CarteraFact.close_month != '')
            .order_by(CarteraFact.close_date.desc())
            .limit(1)
            .scalar()
            or ''
        )
        close_serial = _month_serial(resolved_close_month)
        if close_serial <= 1:
            return {
                'kpis': {
                    'resolved_close_month': resolved_close_month or None,
                    'previous_close_month': None,
                    'resolved_gestion_month': None,
                    'vigente_inicial': 0,
                    'vigente_final': 0,
                    'ventas_nuevas': 0,
                    'recuperados_a_vigente': 0,
                    'culminados_vigentes': 0,
                    'caidos_a_moroso': 0,
                    'neto_rolo': 0,
                    'esperado_final': 0,
                    'otros_ajustes': 0,
                },
                'charts': {'by_un_neto': {}},
                'rows': [],
                'meta': {
                    'source': 'api-v1',
                    'source_table': 'cartera_fact',
                    'generated_at': datetime.utcnow().isoformat(),
                },
            }

        previous_close_month = _month_from_serial(close_serial - 1)
        resolved_gestion_month = _month_from_serial(close_serial + 1)
        un_filter = _normalize_str_set(filters.un)
        supervisor_filter = _normalize_str_set(filters.supervisor)
        via_filter = _normalize_str_set(filters.via_cobro)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}

        q = db.query(
            CarteraFact.contract_id,
            CarteraFact.close_month,
            CarteraFact.gestion_month,
            CarteraFact.contract_month,
            CarteraFact.culm_month,
            CarteraFact.un,
            CarteraFact.supervisor,
            CarteraFact.via_cobro,
            CarteraFact.tramo,
            CarteraFact.category,
        ).filter(CarteraFact.close_month.in_([previous_close_month, resolved_close_month]))

        if un_filter:
            q = q.filter(func.upper(func.coalesce(CarteraFact.un, '')).in_([v.upper() for v in un_filter]))
        if supervisor_filter:
            q = q.filter(func.upper(func.coalesce(CarteraFact.supervisor, '')).in_([v.upper() for v in supervisor_filter]))
        if via_filter:
            q = q.filter(func.upper(func.coalesce(CarteraFact.via_cobro, '')).in_([v.upper() for v in via_filter]))

        prev_rows: dict[str, dict] = {}
        curr_rows: dict[str, dict] = {}
        for row in q.yield_per(2000):
            contract_id = _normalize_contract_id_for_lookup(row.contract_id)
            if not contract_id:
                continue
            item = {
                'contract_id': contract_id,
                'close_month': str(row.close_month or '').strip(),
                'gestion_month': str(row.gestion_month or '').strip(),
                'sale_month': str(row.contract_month or '').strip(),
                'culm_month': str(row.culm_month or '').strip(),
                'un': str(row.un or 'S/D').strip().upper() or 'S/D',
                'supervisor': str(row.supervisor or 'S/D').strip().upper() or 'S/D',
                'via_cobro': str(row.via_cobro or 'S/D').strip().upper() or 'S/D',
                'tramo': int(row.tramo or 0),
                'category': str(row.category or '').strip().upper(),
            }
            if item['close_month'] == previous_close_month:
                prev_rows[contract_id] = item
            elif item['close_month'] == resolved_close_month:
                curr_rows[contract_id] = item

        def _is_vigente(row: dict | None) -> bool:
            if not row:
                return False
            category = str(row.get('category') or '').strip().upper()
            if category in {'VIGENTE', 'MOROSO'}:
                return category == 'VIGENTE'
            return int(row.get('tramo') or 0) <= 3

        def _is_moroso(row: dict | None) -> bool:
            return bool(row) and not _is_vigente(row)

        def _sale_year(row: dict | None) -> str:
            sale_month = str((row or {}).get('sale_month') or '').strip()
            serial = _month_serial(sale_month)
            if serial <= 0:
                return ''
            return sale_month[-4:]

        by_un: dict[str, dict[str, int | str]] = {}
        vigente_inicial = 0
        vigente_final = 0
        ventas_nuevas = 0
        recuperados = 0
        culminados_vigentes = 0
        caidos_a_moroso = 0

        contract_ids = sorted(set(prev_rows.keys()) | set(curr_rows.keys()))
        for contract_id in contract_ids:
            prev_row = prev_rows.get(contract_id)
            curr_row = curr_rows.get(contract_id)
            reference = curr_row or prev_row
            if not reference:
                continue
            if year_filter and _sale_year(reference) not in year_filter:
                continue

            un = str(reference.get('un') or 'S/D')
            bucket = by_un.setdefault(
                un,
                {
                    'un': un,
                    'vigente_inicial': 0,
                    'ventas_nuevas': 0,
                    'recuperados_a_vigente': 0,
                    'culminados_vigentes': 0,
                    'caidos_a_moroso': 0,
                    'neto_rolo': 0,
                    'vigente_final': 0,
                },
            )

            prev_vig = _is_vigente(prev_row)
            prev_mor = _is_moroso(prev_row)
            curr_vig = _is_vigente(curr_row)
            curr_mor = _is_moroso(curr_row)
            sale_month = str(reference.get('sale_month') or '').strip()
            culm_month = str(reference.get('culm_month') or '').strip()

            if prev_vig:
                vigente_inicial += 1
                bucket['vigente_inicial'] = int(bucket['vigente_inicial']) + 1
            if curr_vig:
                vigente_final += 1
                bucket['vigente_final'] = int(bucket['vigente_final']) + 1
            if sale_month == resolved_close_month:
                ventas_nuevas += 1
                bucket['ventas_nuevas'] = int(bucket['ventas_nuevas']) + 1
            if prev_mor and curr_vig:
                recuperados += 1
                bucket['recuperados_a_vigente'] = int(bucket['recuperados_a_vigente']) + 1
            if prev_vig and culm_month == resolved_close_month:
                culminados_vigentes += 1
                bucket['culminados_vigentes'] = int(bucket['culminados_vigentes']) + 1
            if prev_vig and curr_mor:
                caidos_a_moroso += 1
                bucket['caidos_a_moroso'] = int(bucket['caidos_a_moroso']) + 1

        rows: list[dict[str, str | int]] = []
        for row in by_un.values():
            neto_un = int(row['ventas_nuevas']) + int(row['recuperados_a_vigente']) - int(row['culminados_vigentes']) - int(row['caidos_a_moroso'])
            row['neto_rolo'] = neto_un
            rows.append(row)
        rows.sort(key=lambda item: (-abs(int(item['neto_rolo'])), str(item['un'])))

        neto_rolo = ventas_nuevas + recuperados - culminados_vigentes - caidos_a_moroso
        esperado_final = vigente_inicial + neto_rolo
        otros_ajustes = vigente_final - esperado_final

        return {
            'kpis': {
                'resolved_close_month': resolved_close_month,
                'previous_close_month': previous_close_month,
                'resolved_gestion_month': resolved_gestion_month,
                'vigente_inicial': vigente_inicial,
                'vigente_final': vigente_final,
                'ventas_nuevas': ventas_nuevas,
                'recuperados_a_vigente': recuperados,
                'culminados_vigentes': culminados_vigentes,
                'caidos_a_moroso': caidos_a_moroso,
                'neto_rolo': neto_rolo,
                'esperado_final': esperado_final,
                'otros_ajustes': otros_ajustes,
            },
            'charts': {
                'by_un_neto': {str(row['un']): int(row['neto_rolo']) for row in rows},
                'composition': {
                    'vigente_inicial': vigente_inicial,
                    'ventas_nuevas': ventas_nuevas,
                    'recuperados_a_vigente': recuperados,
                    'culminados_vigentes': culminados_vigentes,
                    'caidos_a_moroso': caidos_a_moroso,
                    'vigente_final': vigente_final,
                },
            },
            'rows': rows,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact',
                'generated_at': datetime.utcnow().isoformat(),
                'signature': f'portfolio-rolo-v2|{_filters_to_query(filters)}|{resolved_close_month}',
            },
        }

    @staticmethod
    def fetch_rendimiento_first_paint_v2(db: Session, filters: AnalyticsFilters) -> dict:
        full = AnalyticsService.fetch_rendimiento_summary_v2(db, filters)
        trend = list((full.get('trendStats') or {}).items())
        trend = sorted(trend, key=lambda it: _month_serial(str(it[0])))[-6:]
        return {
            'totals': {
                'totalDebt': float(full.get('totalDebt') or 0.0),
                'totalPaid': float(full.get('totalPaid') or 0.0),
                'totalContracts': int(full.get('totalContracts') or 0),
                'totalContractsPaid': int(full.get('totalContractsPaid') or 0),
            },
            'mini_trend': {k: v for k, v in trend},
            'meta': {
                'source': 'api-v1',
                'source_table': 'analytics_rendimiento_agg',
                'payload_mode': 'first_paint',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_anuales_first_paint_v2(db: Session, filters: AnalyticsFilters) -> dict:
        full = AnalyticsService.fetch_anuales_summary_v2(db, filters)
        rows = list(full.get('rows') or [])
        rows = sorted(rows, key=lambda r: int(str(r.get('year') or '0')), reverse=True)[:6]
        return {
            'cutoff': str(full.get('cutoff') or ''),
            'rows_top': rows,
            'meta': {
                'source': 'api-v1',
                'source_table': 'analytics_anuales_agg',
                'payload_mode': 'first_paint',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def _normalize_via_bucket(value: object) -> str:
        raw = str(value or '').strip().upper()
        if raw == 'COBRADOR' or 'COBR' in raw:
            return 'COBRADOR'
        return 'DEBITO'

    @staticmethod
    def _rendimiento_filtered_cartera_query(db: Session, filters: AnalyticsFilters):
        un_filter = _normalize_str_set(filters.un)
        tramo_filter = _normalize_str_set(filters.tramo)
        gestion_filter = {str(v).strip() for v in (filters.gestion_month or []) if str(v).strip()}
        via_cobro_filter = _normalize_str_set(filters.via_cobro)
        categoria_filter = _normalize_str_set(filters.categoria)
        supervisor_filter = _normalize_str_set(filters.supervisor)

        via_expr = _via_class_expr()
        categoria_expr = category_expr_for_tramo(CarteraFact.tramo)
        q = db.query(CarteraFact)
        if un_filter:
            q = q.filter(func.upper(func.coalesce(CarteraFact.un, '')).in_(list(un_filter)))
        if tramo_filter:
            tramo_int = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramo_int:
                q = q.filter(CarteraFact.tramo.in_(tramo_int))
        if gestion_filter:
            q = q.filter(CarteraFact.gestion_month.in_(gestion_filter))
        if via_cobro_filter:
            q = q.filter(via_expr.in_(list(via_cobro_filter)))
        if categoria_filter:
            q = q.filter(categoria_expr.in_(list(categoria_filter)))
            # Regla de negocio fija: VIGENTE=tramo 0..3, MOROSO=tramo > 3.
            if categoria_filter == {'VIGENTE'}:
                q = q.filter(CarteraFact.tramo <= 3)
            elif categoria_filter == {'MOROSO'}:
                q = q.filter(CarteraFact.tramo > 3)
        if supervisor_filter:
            q = q.filter(func.upper(func.coalesce(CarteraFact.supervisor, '')).in_(list(supervisor_filter)))
        return q, via_expr, categoria_expr

    @staticmethod
    def fetch_rendimiento_options_v1(db: Session, filters: AnalyticsFilters) -> dict:
        base, via_expr, categoria_expr = AnalyticsService._rendimiento_filtered_cartera_query(db, filters)

        uns = [
            str(v[0]).strip().upper()
            for v in base.with_entities(CarteraFact.un).distinct().all()
            if str(v[0] or '').strip()
        ]
        tramos = [
            str(v[0])
            for v in base.with_entities(CarteraFact.tramo).distinct().order_by(CarteraFact.tramo).all()
            if v[0] is not None
        ]
        gestion_months = [
            str(v[0]).strip()
            for v in base.with_entities(CarteraFact.gestion_month).distinct().all()
            if str(v[0] or '').strip()
        ]
        vias_cobro = [
            str(v[0]).strip().upper()
            for v in base.with_entities(via_expr).distinct().all()
            if str(v[0] or '').strip()
        ]
        categorias = [
            str(v[0]).strip().upper()
            for v in base.with_entities(categoria_expr).distinct().all()
            if str(v[0] or '').strip()
        ]
        supervisors = [
            str(v[0]).strip().upper()
            for v in base.with_entities(CarteraFact.supervisor).distinct().all()
            if str(v[0] or '').strip()
        ]

        via_pago_set: set[str] = set()
        q_via_pago = db.query(CobranzasFact.payment_via_class).distinct()
        if gestion_months:
            variants: set[str] = set()
            for mm in gestion_months:
                variants.update(_payment_month_variants(mm))
                variants.add(mm)
            q_via_pago = q_via_pago.filter(CobranzasFact.payment_month.in_(list(variants)))
        for row in q_via_pago.all():
            via_pago_set.add(AnalyticsService._normalize_via_bucket(row[0]))

        sorted_months = sorted(set(gestion_months), key=_month_serial)
        return {
            'options': {
                'uns': sorted(set(uns)),
                'tramos': sorted(set(tramos), key=lambda x: int(x) if str(x).isdigit() else 999),
                'gestion_months': sorted_months,
                'vias_cobro': sorted(set(vias_cobro)),
                'vias_pago': sorted(via_pago_set),
                'categorias': sorted(set(categorias)),
                'supervisors': sorted(set(supervisors)),
            },
            'default_gestion_month': sorted_months[-1] if sorted_months else None,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact + cobranzas_fact',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_rendimiento_summary_v1(db: Session, filters: AnalyticsFilters) -> dict:
        base, via_expr, categoria_expr = AnalyticsService._rendimiento_filtered_cartera_query(db, filters)
        via_pago_filter = _normalize_str_set(filters.via_pago)

        if db.bind is not None and db.bind.dialect.name == 'postgresql':
            cuota_text = cast(CarteraFact.payload_json, JSONB).op('->>')('monto_cuota')
            cuota_expr = case(
                (cuota_text.op('~')(r'^-?\d+(\.\d+)?$'), cast(cuota_text, Numeric)),
                else_=literal(0),
            )
            debt_expr = cast(func.coalesce(CarteraFact.monto_vencido, 0.0), Numeric) + cuota_expr
        else:
            debt_expr = func.coalesce(CarteraFact.total_saldo, 0.0)

        cartera_rows = (
            base.with_entities(
                CarteraFact.contract_id,
                CarteraFact.gestion_month,
                func.upper(func.coalesce(CarteraFact.un, 'S/D')).label('un'),
                cast(CarteraFact.tramo, String).label('tramo'),
                via_expr.label('via_cobro'),
                func.upper(func.coalesce(CarteraFact.supervisor, 'S/D')).label('supervisor'),
                categoria_expr.label('categoria'),
                func.coalesce(func.sum(debt_expr), 0.0).label('debt'),
            )
            .group_by(
                CarteraFact.contract_id,
                CarteraFact.gestion_month,
                func.upper(func.coalesce(CarteraFact.un, 'S/D')),
                cast(CarteraFact.tramo, String),
                via_expr,
                func.upper(func.coalesce(CarteraFact.supervisor, 'S/D')),
                categoria_expr,
            )
            .yield_per(2000)
        )

        portfolio_map: dict[str, dict] = {}
        months_needed: set[str] = set()
        for row in cartera_rows:
            month = str(row.gestion_month or '').strip()
            if not month:
                continue
            c_id = _normalize_contract_id_for_lookup(row.contract_id)
            if not c_id:
                continue
            key = f'{c_id}_{month}'
            months_needed.add(month)
            entry = portfolio_map.setdefault(
                key,
                {
                    'un': str(row.un or 'S/D').strip().upper() or 'S/D',
                    'tramo': str(row.tramo or '0').strip() or '0',
                    'viaC': AnalyticsService._normalize_via_bucket(row.via_cobro),
                    'gestor': str(row.supervisor or 'S/D').strip().upper() or 'S/D',
                    'debt': 0.0,
                    'paid': 0.0,
                    'paidDetails': {},
                },
            )
            entry['debt'] += float(row.debt or 0.0)

        if portfolio_map and months_needed:
            portfolio_contracts_subq = base.with_entities(CarteraFact.contract_id.label('contract_id')).distinct().subquery()
            paid_rows = (
                db.query(
                    CobranzasFact.contract_id,
                    CobranzasFact.payment_month,
                    CobranzasFact.payment_via_class,
                    func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label('paid'),
                )
                .join(portfolio_contracts_subq, CobranzasFact.contract_id == portfolio_contracts_subq.c.contract_id)
                .filter(CobranzasFact.payment_month.in_(list(months_needed)))
                .group_by(CobranzasFact.contract_id, CobranzasFact.payment_month, CobranzasFact.payment_via_class)
                .yield_per(2000)
            )
            for row in paid_rows:
                c_id = _normalize_contract_id_for_lookup(row.contract_id)
                month = str(row.payment_month or '').strip()
                if not c_id or not month:
                    continue
                key = f'{c_id}_{month}'
                if key not in portfolio_map:
                    continue
                via_real = AnalyticsService._normalize_via_bucket(row.payment_via_class)
                if via_pago_filter and via_real not in via_pago_filter:
                    continue
                amount = float(row.paid or 0.0)
                if amount == 0.0:
                    continue
                portfolio_map[key]['paid'] += amount
                paid_details = portfolio_map[key]['paidDetails']
                paid_details[via_real] = float(paid_details.get(via_real, 0.0)) + amount

        stats = {
            'totalDebt': 0.0,
            'totalPaid': 0.0,
            'totalContracts': 0,
            'totalContractsPaid': 0,
            'tramoStats': {},
            'unStats': {},
            'viaCStats': {},
            'gestorStats': {},
            'matrixStats': {},
            'trendStats': {},
        }

        for key, info in portfolio_map.items():
            month = key.split('_', 1)[1] if '_' in key else ''
            debt = float(info.get('debt', 0.0) or 0.0)
            paid_raw = float(info.get('paid', 0.0) or 0.0)
            paid = _cap_paid_to_debt(paid_raw, debt)
            tramo = str(info.get('tramo', '0'))
            un = str(info.get('un', 'S/D'))
            via_c = str(info.get('viaC', 'DEBITO'))
            gestor = str(info.get('gestor', 'S/D'))
            paid_details_raw = info.get('paidDetails', {}) or {}
            if paid_raw > 0.0 and paid < paid_raw:
                ratio = paid / paid_raw
                paid_details = {k: float(v or 0.0) * ratio for k, v in paid_details_raw.items()}
            else:
                paid_details = {k: float(v or 0.0) for k, v in paid_details_raw.items()}

            stats['totalDebt'] += debt
            stats['totalPaid'] += paid
            stats['totalContracts'] += 1
            if paid > 0:
                stats['totalContractsPaid'] += 1

            stats['trendStats'].setdefault(month, {'d': 0.0, 'p': 0.0, 'c': 0, 'cp': 0})
            stats['trendStats'][month]['d'] += debt
            stats['trendStats'][month]['p'] += paid
            stats['trendStats'][month]['c'] += 1
            if paid > 0:
                stats['trendStats'][month]['cp'] += 1

            stats['tramoStats'].setdefault(tramo, {'d': 0.0, 'p': 0.0})
            stats['tramoStats'][tramo]['d'] += debt
            stats['tramoStats'][tramo]['p'] += paid

            stats['unStats'].setdefault(un, {'d': 0.0, 'p': 0.0})
            stats['unStats'][un]['d'] += debt
            stats['unStats'][un]['p'] += paid

            stats['viaCStats'].setdefault(via_c, {'d': 0.0, 'p': 0.0})
            stats['viaCStats'][via_c]['d'] += debt
            stats['viaCStats'][via_c]['p'] += paid

            stats['gestorStats'].setdefault(gestor, {'d': 0.0, 'p': 0.0})
            stats['gestorStats'][gestor]['d'] += debt
            stats['gestorStats'][gestor]['p'] += paid

            stats['matrixStats'].setdefault(via_c, {})
            for via_real, amount in paid_details.items():
                stats['matrixStats'][via_c][via_real] = float(stats['matrixStats'][via_c].get(via_real, 0.0)) + float(amount or 0.0)

        stats['meta'] = {
            'source': 'api-v1',
            'source_table': 'cartera_fact + cobranzas_fact',
            'generated_at': datetime.utcnow().isoformat(),
            'portfolio_keys': len(portfolio_map),
        }
        return stats

    @staticmethod
    def fetch_rendimiento_options_v2(db: Session, filters: AnalyticsFilters) -> dict:
        un_filter = _normalize_str_set(filters.un)
        tramo_filter = _normalize_str_set(filters.tramo)
        gestion_filter = {str(v).strip() for v in (filters.gestion_month or []) if str(v).strip()}
        via_cobro_filter = _normalize_str_set(filters.via_cobro)
        categoria_filter = _normalize_str_set(filters.categoria)
        supervisor_filter = _normalize_str_set(filters.supervisor)

        q = db.query(MvOptionsRendimiento)
        if un_filter:
            q = q.filter(MvOptionsRendimiento.un.in_(list(un_filter)))
        if tramo_filter:
            tramo_int = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramo_int:
                q = q.filter(MvOptionsRendimiento.tramo.in_(tramo_int))
        if gestion_filter:
            q = q.filter(MvOptionsRendimiento.gestion_month.in_(gestion_filter))
        if via_cobro_filter:
            q = q.filter(MvOptionsRendimiento.via_cobro.in_(list(via_cobro_filter)))
        if categoria_filter:
            q = q.filter(MvOptionsRendimiento.categoria.in_(list(categoria_filter)))
            # Blindaje por consistencia en históricos.
            if categoria_filter == {'VIGENTE'}:
                q = q.filter(MvOptionsRendimiento.tramo <= 3)
            elif categoria_filter == {'MOROSO'}:
                q = q.filter(MvOptionsRendimiento.tramo > 3)
        if supervisor_filter:
            q = q.filter(MvOptionsRendimiento.supervisor.in_(list(supervisor_filter)))

        uns = [str(v[0]).strip().upper() for v in q.with_entities(MvOptionsRendimiento.un).distinct().all() if str(v[0] or '').strip()]
        tramos = [
            str(v[0])
            for v in q.with_entities(MvOptionsRendimiento.tramo).distinct().order_by(MvOptionsRendimiento.tramo).all()
            if v[0] is not None
        ]
        gestion_months = [
            str(v[0]).strip()
            for v in q.with_entities(MvOptionsRendimiento.gestion_month).distinct().all()
            if str(v[0] or '').strip()
        ]
        vias_cobro = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsRendimiento.via_cobro).distinct().all()
            if str(v[0] or '').strip()
        ]
        categorias = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsRendimiento.categoria).distinct().all()
            if str(v[0] or '').strip()
        ]
        supervisors = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsRendimiento.supervisor).distinct().all()
            if str(v[0] or '').strip()
        ]
        source_table = 'mv_options_rendimiento'
        should_fallback_to_agg = not any([uns, tramos, gestion_months, vias_cobro, categorias, supervisors])
        # Si la MV quedó parcial (ej. solo último mes por carga incremental), usar agg completa
        # para no recortar opciones en el filtro de Mes de Gestión.
        if not should_fallback_to_agg and not gestion_filter:
            q_agg_count = db.query(func.count(func.distinct(AnalyticsRendimientoAgg.gestion_month)))
            if un_filter:
                q_agg_count = q_agg_count.filter(AnalyticsRendimientoAgg.un.in_(list(un_filter)))
            if tramo_filter:
                tramo_int = [int(t) for t in tramo_filter if str(t).isdigit()]
                if tramo_int:
                    q_agg_count = q_agg_count.filter(AnalyticsRendimientoAgg.tramo.in_(tramo_int))
            if via_cobro_filter:
                q_agg_count = q_agg_count.filter(AnalyticsRendimientoAgg.via_cobro.in_(list(via_cobro_filter)))
            if categoria_filter:
                q_agg_count = q_agg_count.filter(AnalyticsRendimientoAgg.categoria.in_(list(categoria_filter)))
            if supervisor_filter:
                q_agg_count = q_agg_count.filter(AnalyticsRendimientoAgg.supervisor.in_(list(supervisor_filter)))
            agg_months_count = q_agg_count.scalar() or 0
            should_fallback_to_agg = agg_months_count > len(set(gestion_months))
        if should_fallback_to_agg:
            q_agg = db.query(AnalyticsRendimientoAgg)
            if un_filter:
                q_agg = q_agg.filter(AnalyticsRendimientoAgg.un.in_(list(un_filter)))
            if tramo_filter:
                tramo_int = [int(t) for t in tramo_filter if str(t).isdigit()]
                if tramo_int:
                    q_agg = q_agg.filter(AnalyticsRendimientoAgg.tramo.in_(tramo_int))
            if gestion_filter:
                q_agg = q_agg.filter(AnalyticsRendimientoAgg.gestion_month.in_(gestion_filter))
            if via_cobro_filter:
                q_agg = q_agg.filter(AnalyticsRendimientoAgg.via_cobro.in_(list(via_cobro_filter)))
            if categoria_filter:
                q_agg = q_agg.filter(AnalyticsRendimientoAgg.categoria.in_(list(categoria_filter)))
            if supervisor_filter:
                q_agg = q_agg.filter(AnalyticsRendimientoAgg.supervisor.in_(list(supervisor_filter)))
            uns = [str(v[0]).strip().upper() for v in q_agg.with_entities(AnalyticsRendimientoAgg.un).distinct().all() if str(v[0] or '').strip()]
            tramos = [
                str(v[0])
                for v in q_agg.with_entities(AnalyticsRendimientoAgg.tramo).distinct().order_by(AnalyticsRendimientoAgg.tramo).all()
                if v[0] is not None
            ]
            gestion_months = [
                str(v[0]).strip()
                for v in q_agg.with_entities(AnalyticsRendimientoAgg.gestion_month).distinct().all()
                if str(v[0] or '').strip()
            ]
            vias_cobro = [
                str(v[0]).strip().upper()
                for v in q_agg.with_entities(AnalyticsRendimientoAgg.via_cobro).distinct().all()
                if str(v[0] or '').strip()
            ]
            categorias = [
                str(v[0]).strip().upper()
                for v in q_agg.with_entities(AnalyticsRendimientoAgg.categoria).distinct().all()
                if str(v[0] or '').strip()
            ]
            supervisors = [
                str(v[0]).strip().upper()
                for v in q_agg.with_entities(AnalyticsRendimientoAgg.supervisor).distinct().all()
                if str(v[0] or '').strip()
            ]
            source_table = 'analytics_rendimiento_agg'
        uns = sorted(set(uns) | set(_fetch_canonical_uns(db)))
        agg_gestion_months = [
            str(v[0]).strip()
            for v in db.query(AnalyticsRendimientoAgg.gestion_month).distinct().all()
            if str(v[0] or '').strip() and _month_serial(str(v[0]).strip()) > 0
        ]
        vias_pago = ['COBRADOR', 'DEBITO']
        data_months = sorted(set(gestion_months), key=_month_serial)
        calendar_months = _standard_calendar_months(STANDARD_GESTION_CALENDAR_START)
        all_gestion_months = sorted(set(agg_gestion_months) | set(calendar_months), key=_month_serial)
        return {
            'options': {
                'uns': sorted(set(uns)),
                'tramos': sorted(set(tramos), key=lambda x: int(x) if str(x).isdigit() else 999),
                'gestion_months': all_gestion_months,
                'vias_cobro': sorted(set(vias_cobro)),
                'vias_pago': sorted(set(vias_pago)),
                'categorias': sorted(set(categorias)),
                'supervisors': sorted(set(supervisors)),
            },
            'default_gestion_month': data_months[-1] if data_months else (all_gestion_months[-1] if all_gestion_months else None),
            'meta': {
                'source': 'api-v2',
                'source_table': source_table,
                'last_data_gestion_month': data_months[-1] if data_months else None,
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_rendimiento_summary_v2(db: Session, filters: AnalyticsFilters) -> dict:
        via_pago_filter = _normalize_str_set(filters.via_pago)
        # v2 aggregate does not preserve exact paid-contract cardinality by via_pago.
        if via_pago_filter and via_pago_filter != {'COBRADOR', 'DEBITO'}:
            return AnalyticsService.fetch_rendimiento_summary_v1(db, filters)

        un_filter = _normalize_str_set(filters.un)
        tramo_filter = _normalize_str_set(filters.tramo)
        gestion_filter = {str(v).strip() for v in (filters.gestion_month or []) if str(v).strip()}
        via_cobro_filter = _normalize_str_set(filters.via_cobro)
        categoria_filter = _normalize_str_set(filters.categoria)
        supervisor_filter = _normalize_str_set(filters.supervisor)

        q = db.query(AnalyticsRendimientoAgg)
        if un_filter:
            q = q.filter(AnalyticsRendimientoAgg.un.in_(list(un_filter)))
        if tramo_filter:
            tramo_int = [int(t) for t in tramo_filter if str(t).isdigit()]
            if tramo_int:
                q = q.filter(AnalyticsRendimientoAgg.tramo.in_(tramo_int))
        if gestion_filter:
            q = q.filter(AnalyticsRendimientoAgg.gestion_month.in_(gestion_filter))
        if via_cobro_filter:
            q = q.filter(AnalyticsRendimientoAgg.via_cobro.in_(list(via_cobro_filter)))
        if categoria_filter:
            q = q.filter(AnalyticsRendimientoAgg.categoria.in_(list(categoria_filter)))
            if categoria_filter == {'VIGENTE'}:
                q = q.filter(AnalyticsRendimientoAgg.tramo <= 3)
            elif categoria_filter == {'MOROSO'}:
                q = q.filter(AnalyticsRendimientoAgg.tramo > 3)
        if supervisor_filter:
            q = q.filter(AnalyticsRendimientoAgg.supervisor.in_(list(supervisor_filter)))
        # Aggregate in SQL to avoid transferring full grain rows to Python on cache misses.
        base = q.with_entities(
            AnalyticsRendimientoAgg.gestion_month.label('gestion_month'),
            AnalyticsRendimientoAgg.tramo.label('tramo'),
            AnalyticsRendimientoAgg.un.label('un'),
            AnalyticsRendimientoAgg.via_cobro.label('via_cobro'),
            AnalyticsRendimientoAgg.supervisor.label('supervisor'),
            AnalyticsRendimientoAgg.debt_total.label('debt_total'),
            AnalyticsRendimientoAgg.paid_total.label('paid_total'),
            AnalyticsRendimientoAgg.contracts_total.label('contracts_total'),
            AnalyticsRendimientoAgg.contracts_paid.label('contracts_paid'),
            AnalyticsRendimientoAgg.paid_via_cobrador.label('paid_via_cobrador'),
            AnalyticsRendimientoAgg.paid_via_debito.label('paid_via_debito'),
        ).subquery()
        paid_capped_expr = base.c.paid_total
        paid_cobrador_capped_expr = base.c.paid_via_cobrador
        paid_debito_capped_expr = base.c.paid_via_debito

        totals_row = (
            db.query(
                func.coalesce(func.sum(base.c.debt_total), 0.0).label('debt'),
                func.coalesce(func.sum(paid_capped_expr), 0.0).label('paid'),
                func.coalesce(func.sum(base.c.contracts_total), 0).label('contracts'),
                func.coalesce(func.sum(base.c.contracts_paid), 0).label('contracts_paid'),
                func.count().label('rows_count'),
            )
            .one()
        )

        trend_rows = (
            db.query(
                base.c.gestion_month,
                func.coalesce(func.sum(base.c.debt_total), 0.0).label('d'),
                func.coalesce(func.sum(paid_capped_expr), 0.0).label('p'),
                func.coalesce(func.sum(base.c.contracts_total), 0).label('c'),
                func.coalesce(func.sum(base.c.contracts_paid), 0).label('cp'),
            )
            .group_by(base.c.gestion_month)
            .all()
        )
        tramo_rows = (
            db.query(
                base.c.tramo,
                func.coalesce(func.sum(base.c.debt_total), 0.0).label('d'),
                func.coalesce(func.sum(paid_capped_expr), 0.0).label('p'),
            )
            .group_by(base.c.tramo)
            .all()
        )
        un_rows = (
            db.query(
                base.c.un,
                func.coalesce(func.sum(base.c.debt_total), 0.0).label('d'),
                func.coalesce(func.sum(paid_capped_expr), 0.0).label('p'),
            )
            .group_by(base.c.un)
            .all()
        )
        via_rows = (
            db.query(
                base.c.via_cobro,
                func.coalesce(func.sum(base.c.debt_total), 0.0).label('d'),
                func.coalesce(func.sum(paid_capped_expr), 0.0).label('p'),
                func.coalesce(func.sum(paid_cobrador_capped_expr), 0.0).label('paid_cobrador'),
                func.coalesce(func.sum(paid_debito_capped_expr), 0.0).label('paid_debito'),
            )
            .group_by(base.c.via_cobro)
            .all()
        )
        gestor_rows = (
            db.query(
                base.c.supervisor,
                func.coalesce(func.sum(base.c.debt_total), 0.0).label('d'),
                func.coalesce(func.sum(paid_capped_expr), 0.0).label('p'),
            )
            .group_by(base.c.supervisor)
            .all()
        )

        stats = {
            'totalDebt': float(totals_row.debt or 0.0),
            'totalPaid': float(totals_row.paid or 0.0),
            'totalContracts': int(totals_row.contracts or 0),
            'totalContractsPaid': int(totals_row.contracts_paid or 0),
            'kpis': {
                'monto_a_cobrar_total': float(totals_row.debt or 0.0),
                'cobrado_total': float(totals_row.paid or 0.0),
                'rendimiento_monto_pct': (
                    round((float(totals_row.paid or 0.0) / float(totals_row.debt or 0.0)) * 100.0, 4)
                    if float(totals_row.debt or 0.0) > 0.0
                    else 0.0
                ),
                'contratos_por_cobrar': int(totals_row.contracts or 0),
                'contratos_con_cobro': int(totals_row.contracts_paid or 0),
                'rendimiento_cantidad_pct': (
                    round((int(totals_row.contracts_paid or 0) / int(totals_row.contracts or 0)) * 100.0, 4)
                    if int(totals_row.contracts or 0) > 0
                    else 0.0
                ),
            },
            'tramoStats': {},
            'unStats': {},
            'viaCStats': {},
            'gestorStats': {},
            'matrixStats': {},
            'trendStats': {},
        }
        for row in trend_rows:
            month = str(row.gestion_month or '').strip()
            if not month:
                continue
            stats['trendStats'][month] = {
                'd': float(row.d or 0.0),
                'p': float(row.p or 0.0),
                'c': int(row.c or 0),
                'cp': int(row.cp or 0),
            }

        for row in tramo_rows:
            tramo = str(row.tramo if row.tramo is not None else 0)
            stats['tramoStats'][tramo] = {'d': float(row.d or 0.0), 'p': float(row.p or 0.0)}

        for row in un_rows:
            un = str(row.un or 'S/D').strip().upper() or 'S/D'
            stats['unStats'][un] = {'d': float(row.d or 0.0), 'p': float(row.p or 0.0)}

        for row in via_rows:
            via_c = str(row.via_cobro or 'DEBITO').strip().upper() or 'DEBITO'
            stats['viaCStats'][via_c] = {'d': float(row.d or 0.0), 'p': float(row.p or 0.0)}
            stats['matrixStats'][via_c] = {
                'COBRADOR': float(row.paid_cobrador or 0.0),
                'DEBITO': float(row.paid_debito or 0.0),
            }

        for row in gestor_rows:
            gestor = str(row.supervisor or 'S/D').strip().upper() or 'S/D'
            stats['gestorStats'][gestor] = {'d': float(row.d or 0.0), 'p': float(row.p or 0.0)}

        stats['meta'] = {
            'source': 'api-v2',
            'source_table': 'analytics_rendimiento_agg',
            'generated_at': datetime.utcnow().isoformat(),
            'portfolio_keys': int(totals_row.rows_count or 0),
        }
        return stats

    @staticmethod
    def _compute_anuales_rows_v1(
        contract_rows: list[dict],
        cartera_rows: list[dict],
        payment_by_contract_month: dict[str, dict[int, dict[str, float | int]]],
        cob_by_contract_month: dict[str, dict[str, float]],
        cutoff_month: str,
        sel_un: set[str],
        sel_anio: set[str],
        sel_contract_month: set[str],
    ) -> list[dict]:
        cutoff_serial = _month_serial(cutoff_month)
        if cutoff_serial <= 0:
            return []

        by_contract_month: dict[str, dict] = {}
        for row in cartera_rows:
            c_id = str(row.get('contract_id') or '').strip()
            fe = str(row.get('gestion_month') or '').strip()
            if not c_id or _month_serial(fe) <= 0:
                continue
            key = f'{c_id}_{fe}'
            cuota_num = float(_to_float(row.get('monto_cuota')))
            has_cuota = bool(row.get('cuota_has_value'))
            if key not in by_contract_month:
                by_contract_month[key] = {
                    'c_id': c_id,
                    'month': fe,
                    'cuota_sum': cuota_num,
                    'cuota_count': 1 if has_cuota else 0,
                }
            else:
                by_contract_month[key]['cuota_sum'] += cuota_num
                if has_cuota:
                    by_contract_month[key]['cuota_count'] += 1

        by_contract_timeline: dict[str, list[dict]] = defaultdict(list)
        for item in by_contract_month.values():
            count = int(item['cuota_count'] or 0)
            item['cuota_avg'] = (float(item['cuota_sum']) / count) if count > 0 else 0.0
            by_contract_timeline[item['c_id']].append(item)
        for c_id in by_contract_timeline.keys():
            by_contract_timeline[c_id].sort(key=lambda x: _month_serial(x['month']))

        def find_snapshot_at_or_before(c_id: str, month: str):
            timeline = by_contract_timeline.get(c_id, [])
            if not timeline:
                return None
            target = _month_serial(month)
            prev = None
            for snap in timeline:
                serial = _month_serial(snap['month'])
                if serial > target:
                    break
                prev = snap
                if serial == target:
                    break
            return prev

        def find_snapshot_at_or_after(c_id: str, month: str):
            timeline = by_contract_timeline.get(c_id, [])
            if not timeline:
                return None
            target = _month_serial(month)
            for snap in timeline:
                if _month_serial(snap['month']) >= target:
                    return snap
            return None

        payment_cum_by_contract: dict[str, dict[str, list[float] | list[int]]] = {}
        for c_id, month_map in payment_by_contract_month.items():
            serials = sorted(list(month_map.keys()))
            cum_amounts: list[float] = []
            cum_txs: list[int] = []
            amt = 0.0
            txs = 0
            for serial in serials:
                bucket = month_map.get(serial, {})
                amt += float(bucket.get('amount') or 0.0)
                txs += int(bucket.get('tx') or 0)
                cum_amounts.append(amt)
                cum_txs.append(txs)
            payment_cum_by_contract[c_id] = {'serials': serials, 'cum_amounts': cum_amounts, 'cum_txs': cum_txs}

        def get_cum_paid_up_to(c_id: str, max_serial: int) -> dict[str, float | int]:
            entry = payment_cum_by_contract.get(c_id)
            if not entry:
                return {'amount': 0.0, 'tx': 0}
            serials = list(entry.get('serials') or [])
            if not serials:
                return {'amount': 0.0, 'tx': 0}
            idx = -1
            for i, serial in enumerate(serials):
                if int(serial) <= max_serial:
                    idx = i
                else:
                    break
            if idx < 0:
                return {'amount': 0.0, 'tx': 0}
            cum_amounts = list(entry.get('cum_amounts') or [])
            cum_txs = list(entry.get('cum_txs') or [])
            return {
                'amount': float(cum_amounts[idx] if idx < len(cum_amounts) else 0.0),
                'tx': int(cum_txs[idx] if idx < len(cum_txs) else 0),
            }

        cutoff_year_raw = _year_of(cutoff_month)
        cutoff_year = int(cutoff_year_raw) if cutoff_year_raw.isdigit() else None

        def year_from_serial(serial: int):
            if serial <= 0:
                return None
            return (serial - 1) // 12

        def is_payment_year_allowed(serial: int):
            if cutoff_year is None:
                return True
            y = year_from_serial(serial)
            return (y is not None) and (y <= cutoff_year)

        cartera_by_contract_month: dict[str, dict[str, dict]] = defaultdict(dict)
        for row in cartera_rows:
            c_id = str(row.get('contract_id') or '').strip()
            mm = str(row.get('gestion_month') or '').strip()
            if c_id and mm:
                cartera_by_contract_month[c_id][mm] = row

        contracts_by_sale_year: dict[str, list[dict]] = defaultdict(list)
        for row in contract_rows:
            c_id = str(row.get('contract_id') or '').strip()
            un = str(row.get('un') or 'S/D').strip().upper() or 'S/D'
            sale_month = str(row.get('sale_month') or '').strip()
            sale_year = str(row.get('sale_year') or '').strip()
            if not c_id or _month_serial(sale_month) <= 0 or not (sale_year.isdigit() and len(sale_year) == 4):
                continue
            if sel_un and un not in sel_un:
                continue
            if sel_anio and sale_year not in sel_anio:
                continue
            if sel_contract_month and sale_month not in sel_contract_month:
                continue
            contracts_by_sale_year[sale_year].append(row)

        rows: list[dict] = []
        years = sorted(list(contracts_by_sale_year.keys()), key=lambda x: int(x))
        for year in years:
            year_contracts = contracts_by_sale_year.get(year, [])
            contract_ids: set[str] = set()
            contract_ids_vigentes: set[str] = set()
            cuota_total = 0.0

            for c in year_contracts:
                c_id = str(c.get('contract_id') or '').strip()
                if not c_id or c_id in contract_ids:
                    continue
                snap = find_snapshot_at_or_before(c_id, cutoff_month) or find_snapshot_at_or_after(c_id, cutoff_month)
                contract_ids.add(c_id)
                cutoff_row = cartera_by_contract_month.get(c_id, {}).get(cutoff_month)
                tramo_cutoff = int(cutoff_row.get('tramo') or -999) if cutoff_row else -999
                if tramo_cutoff <= 3:
                    contract_ids_vigentes.add(c_id)
                cuota_contrato = float(_to_float(c.get('monto_cuota')))
                if cuota_contrato <= 0:
                    cuota_contrato = float(_to_float((snap or {}).get('cuota_avg')))
                cuota_total += cuota_contrato

            paid_to_cutoff_total = 0.0
            tx_to_cutoff_total = 0
            paid_by_contract_month_total = 0.0
            paid_by_contract_month_count = 0

            for c_id in contract_ids:
                paid = get_cum_paid_up_to(c_id, cutoff_serial)
                paid_to_cutoff_total += float(paid.get('amount') or 0.0)
                tx_to_cutoff_total += int(paid.get('tx') or 0)
                by_month = payment_by_contract_month.get(c_id, {})
                for serial, bucket in by_month.items():
                    serial_int = int(serial)
                    if serial_int <= 0 or (not is_payment_year_allowed(serial_int)):
                        continue
                    paid_by_contract_month_total += float(bucket.get('amount') or 0.0)
                    paid_by_contract_month_count += 1

            culminados = 0
            culminados_vigentes = 0
            cuota_cul_total = 0.0
            cuota_cul_total_vigente = 0.0
            paid_by_contract_month_cul_total = 0.0
            paid_by_contract_month_cul_count = 0
            paid_by_contract_month_cul_total_vigente = 0.0
            paid_by_contract_month_cul_count_vigente = 0
            total_cobrado_cul_vigente = 0.0
            total_deberia_cul_vigente = 0.0

            for c in year_contracts:
                c_id = str(c.get('contract_id') or '').strip()
                culm_month = str(c.get('culm_month') or '').strip()
                culm_serial = _month_serial(culm_month)
                if not c_id or culm_serial <= 0 or culm_serial > cutoff_serial:
                    continue
                # Paridad de negocio: culminados de la fila solo si culminan en el mismo año de la fila.
                culm_year = _year_of(culm_month)
                if culm_year != year:
                    continue
                snap = find_snapshot_at_or_before(c_id, culm_month) or find_snapshot_at_or_after(c_id, culm_month)
                culminados += 1
                culm_row = cartera_by_contract_month.get(c_id, {}).get(culm_month)
                tramo_culm = int(culm_row.get('tramo') or -999) if culm_row else -999
                es_vigente = tramo_culm <= 3
                if es_vigente:
                    culminados_vigentes += 1
                cuota_cul = float(_to_float((snap or {}).get('cuota_avg')))
                if cuota_cul <= 0:
                    cuota_cul = float(_to_float(c.get('monto_cuota')))
                cuota_cul_total += cuota_cul
                if es_vigente:
                    cuota_cul_total_vigente += cuota_cul

                by_month = payment_by_contract_month.get(c_id, {})
                for serial, bucket in by_month.items():
                    serial_int = int(serial)
                    if serial_int <= 0 or serial_int > culm_serial or (not is_payment_year_allowed(serial_int)):
                        continue
                    amount = float(bucket.get('amount') or 0.0)
                    paid_by_contract_month_cul_total += amount
                    paid_by_contract_month_cul_count += 1
                    if es_vigente:
                        paid_by_contract_month_cul_total_vigente += amount
                        paid_by_contract_month_cul_count_vigente += 1

                if es_vigente:
                    sale_month = str(c.get('sale_month') or _month_from_date(c.get('contract_date'))).strip()
                    months = _months_between_date_and_month(c.get('contract_date'), culm_month)
                    if months > 0 and sale_month and _month_serial(culm_month) > 0:
                        deberia = cuota_cul * months
                        cobrado = 0.0
                        start_serial = _month_serial(sale_month)
                        end_serial = _month_serial(culm_month)
                        for mm, amount in (cob_by_contract_month.get(c_id, {}) or {}).items():
                            s = _month_serial(mm)
                            if s >= start_serial and s <= end_serial:
                                cobrado += float(_to_float(amount))
                        total_cobrado_cul_vigente += cobrado
                        total_deberia_cul_vigente += deberia

            contracts = len(contract_ids)
            contracts_vigentes = len(contract_ids_vigentes)
            rows.append(
                {
                    'year': year,
                    'contracts': contracts,
                    'contractsVigentes': contracts_vigentes,
                    'tkpContrato': (cuota_total / contracts) if contracts > 0 else 0.0,
                    'tkpTransaccional': (paid_to_cutoff_total / tx_to_cutoff_total) if tx_to_cutoff_total > 0 else 0.0,
                    'tkpPago': (paid_by_contract_month_total / paid_by_contract_month_count) if paid_by_contract_month_count > 0 else 0.0,
                    'culminados': culminados,
                    'culminadosVigentes': culminados_vigentes,
                    'tkpContratoCulminado': (cuota_cul_total / culminados) if culminados > 0 else 0.0,
                    'tkpPagoCulminado': (paid_by_contract_month_cul_total / paid_by_contract_month_cul_count) if paid_by_contract_month_cul_count > 0 else 0.0,
                    'tkpContratoCulminadoVigente': (cuota_cul_total_vigente / culminados_vigentes) if culminados_vigentes > 0 else 0.0,
                    'tkpPagoCulminadoVigente': (
                        paid_by_contract_month_cul_total_vigente / paid_by_contract_month_cul_count_vigente
                    ) if paid_by_contract_month_cul_count_vigente > 0 else 0.0,
                    'ltvCulminadoVigente': (
                        total_cobrado_cul_vigente / total_deberia_cul_vigente
                    ) if total_deberia_cul_vigente > 0 else 0.0,
                }
            )

        rows.sort(key=lambda x: int(str(x.get('year') or 0)))
        return rows

    @staticmethod
    def fetch_anuales_options_v1(db: Session, filters: AnalyticsFilters) -> dict:
        un_filter = _normalize_str_set(filters.un)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}
        contract_month_filter = {str(v).strip() for v in (filters.contract_month or []) if str(v).strip()}

        q = db.query(CarteraFact.contract_id, CarteraFact.un, CarteraFact.payload_json, CarteraFact.gestion_month)
        contract_map: dict[str, dict] = {}
        gestion_months: set[str] = set()
        for row in q.yield_per(2000):
            c_id = _normalize_contract_id_for_lookup(row.contract_id)
            if not c_id:
                continue
            gm = str(row.gestion_month or '').strip()
            if _month_serial(gm) > 0:
                gestion_months.add(gm)
            payload_raw = row.payload_json or '{}'
            try:
                payload = json.loads(payload_raw)
            except Exception:
                payload = {}
            sale_month = _month_from_any(payload.get('fecha_contrato')) or _month_from_date(payload.get('fecha_contrato'))
            sale_year = _year_of(sale_month)
            un = str(row.un or payload.get('UN') or 'S/D').strip().upper() or 'S/D'
            current = contract_map.setdefault(c_id, {'un': un, 'sale_month': sale_month, 'sale_year': sale_year})
            if not current.get('sale_month') and sale_month:
                current['sale_month'] = sale_month
                current['sale_year'] = sale_year
            if not current.get('un') and un:
                current['un'] = un

        uns: set[str] = set()
        years: set[str] = set()
        contract_months: set[str] = set()
        for item in contract_map.values():
            un = str(item.get('un') or 'S/D').strip().upper() or 'S/D'
            sale_month = str(item.get('sale_month') or '').strip()
            sale_year = str(item.get('sale_year') or '').strip()
            if _month_serial(sale_month) <= 0 or not (sale_year.isdigit() and len(sale_year) == 4):
                continue
            if un_filter and un not in un_filter:
                continue
            if year_filter and sale_year not in year_filter:
                continue
            if contract_month_filter and sale_month not in contract_month_filter:
                continue
            uns.add(un)
            years.add(sale_year)
            contract_months.add(sale_month)

        sorted_cutoff = sorted(gestion_months, key=_month_serial)
        return {
            'options': {
                'uns': sorted(list(uns)),
                'years': sorted(list(years), key=lambda x: int(x)),
                'contract_months': sorted(list(contract_months), key=_month_serial),
            },
            'default_cutoff': sorted_cutoff[-1] if sorted_cutoff else None,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact + cobranzas_fact',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_anuales_summary_v1(db: Session, filters: AnalyticsFilters) -> dict:
        sel_un = _normalize_str_set(filters.un)
        sel_anio = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}
        sel_contract_month = {str(v).strip() for v in (filters.contract_month or []) if str(v).strip()}

        cartera_rows: list[dict] = []
        contract_map: dict[str, dict] = {}
        gestion_months: set[str] = set()

        q = db.query(
            CarteraFact.contract_id,
            CarteraFact.gestion_month,
            CarteraFact.tramo,
            CarteraFact.un,
            CarteraFact.payload_json,
        )
        for row in q.yield_per(2000):
            c_id = _normalize_contract_id_for_lookup(row.contract_id)
            gm = str(row.gestion_month or '').strip()
            if not c_id or _month_serial(gm) <= 0:
                continue
            gestion_months.add(gm)
            payload_raw = row.payload_json or '{}'
            try:
                payload = json.loads(payload_raw)
            except Exception:
                payload = {}
            cuota_raw = payload.get('monto_cuota')
            cuota_txt = str(cuota_raw or '').strip()
            cuota_has_value = bool(cuota_txt)
            cuota_num = float(_to_float(cuota_raw))
            tramo = int(row.tramo or 0)
            cartera_rows.append(
                {
                    'contract_id': c_id,
                    'gestion_month': gm,
                    'tramo': tramo,
                    'monto_cuota': cuota_num,
                    'cuota_has_value': cuota_has_value,
                }
            )

            sale_month = _month_from_any(payload.get('fecha_contrato')) or _month_from_date(payload.get('fecha_contrato'))
            sale_year = _year_of(sale_month)
            culm_month = _month_from_any(payload.get('fecha_culminacion')) or _month_from_date(payload.get('fecha_culminacion'))
            un = str(row.un or payload.get('UN') or 'S/D').strip().upper() or 'S/D'
            contract_date = str(payload.get('fecha_contrato') or '').strip()
            current = contract_map.setdefault(
                c_id,
                {
                    'contract_id': c_id,
                    'un': un,
                    'sale_month': sale_month,
                    'sale_year': sale_year,
                    'culm_month': culm_month,
                    'contract_date': contract_date,
                    'monto_cuota': cuota_num,
                },
            )
            if not current.get('sale_month') and sale_month:
                current['sale_month'] = sale_month
                current['sale_year'] = sale_year
            if not current.get('culm_month') and culm_month:
                current['culm_month'] = culm_month
            if not current.get('contract_date') and contract_date:
                current['contract_date'] = contract_date
            if float(_to_float(current.get('monto_cuota'))) <= 0 and cuota_num > 0:
                current['monto_cuota'] = cuota_num
            if not current.get('un') and un:
                current['un'] = un

        sorted_cutoff = sorted(gestion_months, key=_month_serial)
        requested_cutoff_months = sorted(
            {
                str(v).strip()
                for v in (filters.gestion_month or [])
                if _month_serial(str(v).strip()) > 0
            },
            key=_month_serial,
        )
        cutoff_month = requested_cutoff_months[-1] if requested_cutoff_months else (sorted_cutoff[-1] if sorted_cutoff else '')
        if not cutoff_month:
            return {
                'rows': [],
                'cutoff': '',
                'meta': {
                    'source': 'api-v1',
                    'source_table': 'cartera_fact + cobranzas_fact',
                    'generated_at': datetime.utcnow().isoformat(),
                    'filters': filters.model_dump(),
                },
            }

        contract_rows = list(contract_map.values())
        selected_contract_ids: set[str] = set()
        for row in contract_rows:
            sale_month = str(row.get('sale_month') or '').strip()
            sale_year = str(row.get('sale_year') or '').strip()
            un = str(row.get('un') or 'S/D').strip().upper() or 'S/D'
            if _month_serial(sale_month) <= 0 or not (sale_year.isdigit() and len(sale_year) == 4):
                continue
            if sel_un and un not in sel_un:
                continue
            if sel_anio and sale_year not in sel_anio:
                continue
            if sel_contract_month and sale_month not in sel_contract_month:
                continue
            selected_contract_ids.add(str(row.get('contract_id') or '').strip())

        payment_by_contract_month: dict[str, dict[int, dict[str, float | int]]] = defaultdict(dict)
        cob_by_contract_month: dict[str, dict[str, float]] = defaultdict(dict)
        if selected_contract_ids:
            for chunk in _iter_chunks(sorted(list(selected_contract_ids)), size=800):
                paid_rows = (
                    db.query(
                        CobranzasFact.contract_id,
                        CobranzasFact.payment_month,
                        func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0).label('paid'),
                        func.coalesce(func.count(literal(1)), 0).label('tx_count'),
                    )
                    .filter(CobranzasFact.contract_id.in_(chunk))
                    .group_by(CobranzasFact.contract_id, CobranzasFact.payment_month)
                    .yield_per(2000)
                )
                for row in paid_rows:
                    c_id = _normalize_contract_id_for_lookup(row.contract_id)
                    month = _month_from_any(row.payment_month) or _month_from_date(row.payment_month) or str(row.payment_month or '').strip()
                    serial = _month_serial(month)
                    if not c_id or serial <= 0:
                        continue
                    amount = float(row.paid or 0.0)
                    tx_count = int(row.tx_count or 0)
                    bucket = payment_by_contract_month[c_id].setdefault(serial, {'amount': 0.0, 'tx': 0})
                    bucket['amount'] = float(bucket.get('amount') or 0.0) + amount
                    bucket['tx'] = int(bucket.get('tx') or 0) + tx_count
                    cob_by_contract_month[c_id][month] = float(cob_by_contract_month[c_id].get(month, 0.0)) + amount

        rows = AnalyticsService._compute_anuales_rows_v1(
            contract_rows=contract_rows,
            cartera_rows=cartera_rows,
            payment_by_contract_month=payment_by_contract_month,
            cob_by_contract_month=cob_by_contract_month,
            cutoff_month=cutoff_month,
            sel_un=sel_un,
            sel_anio=sel_anio,
            sel_contract_month=sel_contract_month,
        )
        return {
            'rows': rows,
            'cutoff': cutoff_month,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact + cobranzas_fact',
                'generated_at': datetime.utcnow().isoformat(),
                'signature': f'anuales|{_filters_to_query(filters)}|{cutoff_month}',
                'filters': {
                    'un': sorted(list(sel_un)),
                    'anio': sorted(list(sel_anio)),
                    'contract_month': sorted(list(sel_contract_month), key=_month_serial),
                },
            },
        }

    @staticmethod
    def fetch_anuales_options_v2(db: Session, filters: AnalyticsFilters) -> dict:
        un_filter = _normalize_str_set(filters.un)
        year_filter = {str(v).strip() for v in (filters.anio or []) if str(v).strip()}
        contract_month_filter = {str(v).strip() for v in (filters.contract_month or []) if str(v).strip()}
        gestion_filter = {str(v).strip() for v in (filters.gestion_month or []) if _month_serial(str(v).strip()) > 0}

        q = db.query(MvOptionsAnuales).filter(
            MvOptionsAnuales.sale_month != '',
            MvOptionsAnuales.sale_year > 0,
        )
        if un_filter:
            q = q.filter(MvOptionsAnuales.un.in_(list(un_filter)))
        if year_filter:
            year_int = [int(y) for y in year_filter if str(y).isdigit()]
            if year_int:
                q = q.filter(MvOptionsAnuales.sale_year.in_(year_int))
        if contract_month_filter:
            q = q.filter(MvOptionsAnuales.sale_month.in_(contract_month_filter))
        if gestion_filter:
            q = q.filter(MvOptionsAnuales.cutoff_month.in_(gestion_filter))

        uns = [
            str(v[0]).strip().upper()
            for v in q.with_entities(MvOptionsAnuales.un).distinct().all()
            if str(v[0] or '').strip()
        ]
        years = [
            str(int(v[0]))
            for v in q.with_entities(MvOptionsAnuales.sale_year).distinct().all()
            if int(v[0] or 0) > 0
        ]
        contract_months = [
            str(v[0]).strip()
            for v in q.with_entities(MvOptionsAnuales.sale_month).distinct().all()
            if _month_serial(str(v[0] or '').strip()) > 0
        ]
        cutoff_months = [
            str(v[0]).strip()
            for v in q.with_entities(MvOptionsAnuales.cutoff_month).distinct().all()
            if _month_serial(str(v[0] or '').strip()) > 0
        ]
        source_table = 'mv_options_anuales'
        needs_dim_fallback = not any([uns, years, contract_months, cutoff_months]) or not contract_months
        if needs_dim_fallback:
            q_dim = db.query(DimNegocioContrato).filter(
                DimNegocioContrato.sale_month != '',
                DimNegocioContrato.sale_year > 0,
            )
            if un_filter:
                q_dim = q_dim.filter(DimNegocioContrato.un_canonica.in_(list(un_filter)))
            if year_filter:
                year_int = [int(y) for y in year_filter if str(y).isdigit()]
                if year_int:
                    q_dim = q_dim.filter(DimNegocioContrato.sale_year.in_(year_int))
            if contract_month_filter:
                q_dim = q_dim.filter(DimNegocioContrato.sale_month.in_(contract_month_filter))
            dim_uns = [
                str(v[0]).strip().upper()
                for v in q_dim.with_entities(DimNegocioContrato.un_canonica).distinct().all()
                if str(v[0] or '').strip()
            ]
            dim_years = [
                str(int(v[0]))
                for v in q_dim.with_entities(DimNegocioContrato.sale_year).distinct().all()
                if int(v[0] or 0) > 0
            ]
            dim_contract_months = [
                str(v[0]).strip()
                for v in q_dim.with_entities(DimNegocioContrato.sale_month).distinct().all()
                if _month_serial(str(v[0] or '').strip()) > 0
            ]
            if not uns:
                uns = dim_uns
            if not years:
                years = dim_years
            if not contract_months:
                contract_months = dim_contract_months
            if not cutoff_months:
                cutoff_months = [
                    str(v[0]).strip()
                    for v in db.query(AnalyticsAnualesAgg.cutoff_month).distinct().all()
                    if _month_serial(str(v[0] or '').strip()) > 0
                ]
            if gestion_filter:
                cutoff_months = [mm for mm in cutoff_months if mm in gestion_filter]
            source_table = 'mv_options_anuales + dim_negocio_contrato'

        clean_uns = sorted({u for u in uns if str(u).strip() and str(u).strip() != '*'})
        if not clean_uns:
            map_q = db.query(DimNegocioUnMap.canonical_un).filter(DimNegocioUnMap.is_active.is_(True))
            if un_filter:
                map_q = map_q.filter(DimNegocioUnMap.canonical_un.in_(list(un_filter)))
            clean_uns = sorted(
                {
                    str(v[0]).strip().upper()
                    for v in map_q.distinct().all()
                    if str(v[0] or '').strip()
                }
            )
            if clean_uns:
                source_table = f'{source_table} + dim_negocio_un_map'
        cutoff_months = sorted(set(cutoff_months), key=_month_serial)
        standard_contract_months = _standard_calendar_months(STANDARD_CONTRACT_CALENDAR_START)
        if year_filter:
            standard_contract_months = [
                mm for mm in standard_contract_months
                if '/' in mm and mm.split('/')[1] in year_filter
            ]
        standard_years = sorted({mm.split('/')[1] for mm in _standard_calendar_months(STANDARD_CONTRACT_CALENDAR_START) if '/' in mm}, key=lambda x: int(x))
        default_cutoff = cutoff_months[-1] if cutoff_months else None
        return {
            'options': {
                'uns': clean_uns,
                'years': standard_years,
                'contract_months': standard_contract_months,
                'gestion_months': cutoff_months,
            },
            'default_cutoff': default_cutoff,
            'default_gestion_month': default_cutoff,
            'meta': {
                'source': 'api-v2',
                'source_table': source_table,
                'last_data_contract_month': (sorted(set(contract_months), key=_month_serial)[-1] if contract_months else None),
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_anuales_summary_v2(db: Session, filters: AnalyticsFilters) -> dict:
        has_filters = bool(filters.un or filters.anio or filters.contract_month)
        if has_filters:
            data = AnalyticsService.fetch_anuales_summary_v1(db, filters)
            meta = dict(data.get('meta') or {})
            meta['source'] = 'api-v2-fallback'
            meta['source_table'] = 'cartera_fact + cobranzas_fact'
            data['meta'] = meta
            return data

        cutoff_months = [
            str(v[0]).strip()
            for v in db.query(AnalyticsAnualesAgg.cutoff_month).distinct().all()
            if _month_serial(str(v[0] or '').strip()) > 0
        ]
        requested_cutoff_months = sorted(
            {
                str(v).strip()
                for v in (filters.gestion_month or [])
                if _month_serial(str(v).strip()) > 0
            },
            key=_month_serial,
        )
        cutoff = requested_cutoff_months[-1] if requested_cutoff_months else _latest_month(cutoff_months)
        if not cutoff:
            data = AnalyticsService.fetch_anuales_summary_v1(db, filters)
            meta = dict(data.get('meta') or {})
            meta['source'] = 'api-v2-fallback'
            meta['source_table'] = 'cartera_fact + cobranzas_fact'
            data['meta'] = meta
            return data

        rows_db = (
            db.query(AnalyticsAnualesAgg)
            .filter(AnalyticsAnualesAgg.cutoff_month == cutoff)
            .order_by(AnalyticsAnualesAgg.sale_year.asc())
            .all()
        )
        if not rows_db:
            data = AnalyticsService.fetch_anuales_summary_v1(db, filters)
            meta = dict(data.get('meta') or {})
            meta['source'] = 'api-v2-fallback'
            meta['source_table'] = 'cartera_fact + cobranzas_fact'
            data['meta'] = meta
            return data

        rows: list[dict] = []
        for row in rows_db:
            contracts = int(row.contracts or 0)
            contracts_vig = int(row.contracts_vigentes or 0)
            culminados = int(row.culminados or 0)
            culminados_vig = int(row.culminados_vigentes or 0)
            cuota_total = float(row.cuota_total or 0.0)
            paid_to_cutoff_total = float(row.paid_to_cutoff_total or 0.0)
            tx_to_cutoff_total = int(row.tx_to_cutoff_total or 0)
            paid_by_contract_month_total = float(row.paid_by_contract_month_total or 0.0)
            paid_by_contract_month_count = int(row.paid_by_contract_month_count or 0)
            cuota_cul_total = float(row.cuota_cul_total or 0.0)
            cuota_cul_total_vigente = float(row.cuota_cul_total_vigente or 0.0)
            paid_by_contract_month_cul_total = float(row.paid_by_contract_month_cul_total or 0.0)
            paid_by_contract_month_cul_count = int(row.paid_by_contract_month_cul_count or 0)
            paid_by_contract_month_cul_total_vigente = float(row.paid_by_contract_month_cul_total_vigente or 0.0)
            paid_by_contract_month_cul_count_vigente = int(row.paid_by_contract_month_cul_count_vigente or 0)
            total_cobrado_cul_vigente = float(row.total_cobrado_cul_vigente or 0.0)
            total_deberia_cul_vigente = float(row.total_deberia_cul_vigente or 0.0)
            rows.append(
                {
                    'year': str(int(row.sale_year or 0)),
                    'contracts': contracts,
                    'contractsVigentes': contracts_vig,
                    'tkpContrato': (cuota_total / contracts) if contracts > 0 else 0.0,
                    'tkpTransaccional': (paid_to_cutoff_total / tx_to_cutoff_total) if tx_to_cutoff_total > 0 else 0.0,
                    'tkpPago': (paid_by_contract_month_total / paid_by_contract_month_count) if paid_by_contract_month_count > 0 else 0.0,
                    'culminados': culminados,
                    'culminadosVigentes': culminados_vig,
                    'tkpContratoCulminado': (cuota_cul_total / culminados) if culminados > 0 else 0.0,
                    'tkpPagoCulminado': (paid_by_contract_month_cul_total / paid_by_contract_month_cul_count) if paid_by_contract_month_cul_count > 0 else 0.0,
                    'tkpContratoCulminadoVigente': (cuota_cul_total_vigente / culminados_vig) if culminados_vig > 0 else 0.0,
                    'tkpPagoCulminadoVigente': (
                        paid_by_contract_month_cul_total_vigente / paid_by_contract_month_cul_count_vigente
                    ) if paid_by_contract_month_cul_count_vigente > 0 else 0.0,
                    'ltvCulminadoVigente': (
                        total_cobrado_cul_vigente / total_deberia_cul_vigente
                    ) if total_deberia_cul_vigente > 0 else 0.0,
                }
            )
        return {
            'rows': rows,
            'cutoff': cutoff,
            'meta': {
                'source': 'api-v2',
                'source_table': 'analytics_anuales_agg',
                'generated_at': datetime.utcnow().isoformat(),
                'signature': f'anuales-v2|{cutoff}',
            },
        }

    @staticmethod
    def empty_mora_summary_v1(filters: AnalyticsFilters, reason: str = 'legacy_unavailable') -> dict:
        return {
            'rows': [],
            'meta': {
                'source': 'api-v1-fallback',
                'reason': reason,
                'generated_at': datetime.utcnow().isoformat(),
                'filters': filters.model_dump(),
            },
        }

    @staticmethod
    def export_csv(payload: dict) -> str:
        rows = []
        if isinstance(payload, dict):
            if isinstance(payload.get('rows'), list):
                rows = payload.get('rows') or []
            elif isinstance(payload.get('byGestion'), dict):
                for k, v in (payload.get('byGestion') or {}).items():
                    row = {'gestion_month': k}
                    if isinstance(v, dict):
                        row.update(v)
                    rows.append(row)
            else:
                rows = [payload]

        if not rows:
            rows = [{'message': 'no data'}]

        headers = sorted({k for r in rows if isinstance(r, dict) for k in r.keys()})
        out = io.StringIO()
        w = csv.DictWriter(out, fieldnames=headers)
        w.writeheader()
        for r in rows:
            if isinstance(r, dict):
                w.writerow(r)
        return out.getvalue()
