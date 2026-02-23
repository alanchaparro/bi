from __future__ import annotations

import csv
import io
import json
import re
import time
from datetime import datetime
from threading import Lock
from urllib.parse import urlencode

import httpx
from sqlalchemy import Integer, Numeric, and_, case, cast, func, literal
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import (
    AnalyticsContractSnapshot,
    BrokersSupervisorScope,
    CarteraCorteAgg,
    CarteraFact,
    CobranzasCohorteAgg,
    CobranzasFact,
    CommissionRules,
    PrizeRules,
)
from app.schemas.analytics import AnalyticsFilters, CobranzasCohorteIn, PortfolioSummaryIn
from app.services.brokers_config_service import BrokersConfigService


_COHORTE_BASE_CACHE_TTL_SEC = 900
_COHORTE_BASE_CACHE: dict[str, tuple[float, list[dict]]] = {}
_COHORTE_BASE_CACHE_LOCK = Lock()


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
    s = str(mm_yyyy or '').strip()
    parts = s.split('/')
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return 0
    m = int(parts[0])
    y = int(parts[1])
    if m < 1 or m > 12:
        return 0
    return y * 12 + m


def _year_of(mm_yyyy: str) -> str:
    s = str(mm_yyyy or '').strip()
    parts = s.split('/')
    return parts[1] if len(parts) == 2 and len(parts[1]) == 4 else ''


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
    s = str(value or '').strip()
    if not s.isdigit():
        return '0'
    n = int(s)
    if n < 0:
        return '0'
    if n >= 7:
        return '7'
    return str(n)


def _month_from_any(value: object) -> str:
    s = str(value or '').strip()
    if not s:
        return ''
    if re.match(r'^\d{2}/\d{4}$', s):
        return s
    m = re.match(r'^(\d{4})[-/](\d{2})(?:[-/]\d{2})?', s)
    if m:
        return f'{m.group(2)}/{m.group(1)}'
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', s)
    if m:
        return f'{m.group(2)}/{m.group(3)}'
    return ''


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
    def fetch_legacy(endpoint: str, filters: AnalyticsFilters) -> dict:
        base = settings.analytics_legacy_base_url.rstrip('/')
        query = _filters_to_query(filters)
        url = f'{base}{endpoint}'
        if query:
            url = f'{url}?{query}'
        timeout = float(max(5, int(settings.analytics_legacy_timeout_seconds)))
        with httpx.Client(timeout=timeout) as client:
            res = client.get(url)
            res.raise_for_status()
            return res.json()

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

        rows = db.query(AnalyticsContractSnapshot).all()
        by_key: dict[str, dict] = {}
        by_supervisor: dict[str, int] = {}
        count_by_month_super: dict[str, int] = {}
        total_contracts = 0

        for row in rows:
            supervisor = str(row.supervisor or 'S/D').strip().upper() or 'S/D'
            un = str(row.un or 'S/D').strip().upper() or 'S/D'
            via = str(row.via or 'S/D').strip().upper() or 'S/D'
            sale_month = str(row.sale_month or '').strip()
            year = _year_of(sale_month) or 'S/D'

            if enabled_supervisors and supervisor not in enabled_supervisors:
                continue
            if supervisor_filter and supervisor not in supervisor_filter:
                continue
            if un_filter and un not in un_filter:
                continue
            if via_filter and via not in via_filter:
                continue
            if year_filter and year not in year_filter:
                continue
            if month_filter and sale_month not in month_filter:
                continue

            total_contracts += 1
            by_supervisor[supervisor] = by_supervisor.get(supervisor, 0) + 1
            count_by_month_super[f'{sale_month}__{supervisor}'] = count_by_month_super.get(f'{sale_month}__{supervisor}', 0) + 1

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

            amount = float(row.debt or 0.0)
            by_key[key]['count'] += 1
            by_key[key]['montoCuota'] += amount
            by_key[key]['commission'] += _compute_commission_amount(
                amount,
                supervisor,
                un,
                via,
                sale_month,
                commission_rules,
            )
            if _is_mora_3m(sale_month, str(row.close_month or ''), int(row.tramo or 0)):
                by_key[key]['mora3m'] += 1

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

        tramo_rules_cfg = BrokersConfigService.get_cartera_tramo_rules(db)
        tramo_by_un_category: dict[str, dict[str, set[int]]] = {}
        for rule in (tramo_rules_cfg.get('rules') or []):
            if not isinstance(rule, dict):
                continue
            un_rule = str(rule.get('un') or '').strip().upper()
            if not un_rule:
                continue
            category = str(rule.get('category') or '').strip().upper()
            if category not in {'VIGENTE', 'MOROSO'}:
                continue
            tramos_raw = rule.get('tramos', [])
            tramos_norm: set[int] = set()
            if isinstance(tramos_raw, list):
                for t in tramos_raw:
                    tramos_norm.add(int(_normalize_tramo(t)))
            tramo_by_un_category.setdefault(un_rule, {'VIGENTE': set(), 'MOROSO': set()})[category] = tramos_norm

        category_expr = case((CarteraFact.tramo > 3, literal('MOROSO')), else_=literal('VIGENTE'))
        for un, cfg in tramo_by_un_category.items():
            vig = sorted(list(cfg.get('VIGENTE') or set()))
            mor = sorted(list(cfg.get('MOROSO') or set()))
            if vig:
                category_expr = case((and_(CarteraFact.un == un, CarteraFact.tramo.in_(vig)), literal('VIGENTE')), else_=category_expr)
            if mor:
                category_expr = case((and_(CarteraFact.un == un, CarteraFact.tramo.in_(mor)), literal('MOROSO')), else_=category_expr)

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
        tramo_rules_cfg = BrokersConfigService.get_cartera_tramo_rules(db)
        tramo_by_un_category: dict[str, dict[str, set[int]]] = {}
        for rule in (tramo_rules_cfg.get('rules') or []):
            if not isinstance(rule, dict):
                continue
            un_rule = str(rule.get('un') or '').strip().upper()
            if not un_rule:
                continue
            category = str(rule.get('category') or '').strip().upper()
            if category not in {'VIGENTE', 'MOROSO'}:
                continue
            tramos_raw = rule.get('tramos', [])
            tramos_norm: set[int] = set()
            if isinstance(tramos_raw, list):
                for t in tramos_raw:
                    tramos_norm.add(int(_normalize_tramo(t)))
            tramo_by_un_category.setdefault(un_rule, {'VIGENTE': set(), 'MOROSO': set()})[category] = tramos_norm

        category_expr = case((CarteraFact.tramo > 3, literal('MOROSO')), else_=literal('VIGENTE'))
        for un, cfg in tramo_by_un_category.items():
            vig = sorted(list(cfg.get('VIGENTE') or set()))
            mor = sorted(list(cfg.get('MOROSO') or set()))
            if vig:
                category_expr = case((and_(CarteraFact.un == un, CarteraFact.tramo.in_(vig)), literal('VIGENTE')), else_=category_expr)
            if mor:
                category_expr = case((and_(CarteraFact.un == un, CarteraFact.tramo.in_(mor)), literal('MOROSO')), else_=category_expr)

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

        return {
            'options': {
                'uns': sorted(set(uns)),
                'supervisors': sorted(set(supervisors)),
                'vias': sorted(set(vias)),
                'tramos': sorted(set(tramos), key=lambda x: int(x) if str(x).isdigit() else 999),
                'categories': sorted(set(categories)),
                'gestion_months': sorted(set(gestion_months), key=_month_serial),
                'close_months': sorted(set(close_months), key=_month_serial),
                'contract_years': sorted(set(contract_years), key=lambda x: int(x) if x.isdigit() else 0),
            },
            'meta': {
                'source_table': 'cartera_corte_agg',
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
    def fetch_cobranzas_cohorte_options_v1(db: Session, filters: CobranzasCohorteIn) -> dict:
        cutoff_rows = db.query(CobranzasCohorteAgg.cutoff_month).distinct().all()
        if not cutoff_rows:
            cutoff_rows = db.query(CobranzasFact.payment_month).distinct().all()
        cutoff_months = sorted(
            {str(v[0]).strip() for v in cutoff_rows if str(v[0] or '').strip()},
            key=_month_serial,
        )
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

        return {
            'options': {
                'cutoff_months': cutoff_months,
                'uns': sorted(set(uns)),
                'supervisors': sorted(set(supervisors)),
                'vias': sorted(set(vias)),
                'categories': sorted(set(categories)) or ['MOROSO', 'VIGENTE'],
            },
            'default_cutoff': default_cutoff,
            'meta': {
                'source': 'api-v1',
                'source_table': 'cobranzas_cohorte_agg',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def fetch_cobranzas_cohorte_summary_v1(db: Session, filters: CobranzasCohorteIn) -> dict:
        resolved_cutoff = str(filters.cutoff_month or '').strip()
        if not resolved_cutoff:
            last_cutoff = db.query(CobranzasFact.payment_month).order_by(CobranzasFact.payment_month.desc()).first()
            resolved_cutoff = str(last_cutoff[0]).strip() if last_cutoff and last_cutoff[0] else ''
        if not resolved_cutoff:
            return {
                'cutoff_month': '',
                'totals': {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
                'by_sale_month': [],
                'by_year': {},
                'meta': {'source': 'api-v1', 'generated_at': datetime.utcnow().isoformat()},
            }

        cutoff_serial = _month_serial(resolved_cutoff)
        if cutoff_serial <= 0:
            raise ValueError(f'cutoff_month inválido: {resolved_cutoff}')

        # If cartera does not have rows for selected cutoff, fallback to the latest
        # available cartera month <= cutoff so the cohort report is still useful.
        available_cartera_months = [
            str(v[0]).strip()
            for v in db.query(CarteraCorteAgg.gestion_month).distinct().all()
            if str(v[0] or '').strip()
        ]
        effective_cartera_month = ''
        for mm in sorted(set(available_cartera_months), key=_month_serial):
            if _month_serial(mm) <= cutoff_serial:
                effective_cartera_month = mm
        if not effective_cartera_month:
            return {
                'cutoff_month': resolved_cutoff,
                'effective_cartera_month': '',
                'totals': {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0},
                'by_sale_month': [],
                'by_year': {},
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

            return {
                'cutoff_month': resolved_cutoff,
                'effective_cartera_month': resolved_cutoff,
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
                'meta': {
                    'source': 'api-v1',
                    'source_table': 'cobranzas_cohorte_agg',
                    'generated_at': datetime.utcnow().isoformat(),
                },
            }

        tramo_rules_cfg = BrokersConfigService.get_cartera_tramo_rules(db)
        tramo_by_un_category: dict[str, dict[str, set[int]]] = {}
        for rule in (tramo_rules_cfg.get('rules') or []):
            if not isinstance(rule, dict):
                continue
            un_rule = str(rule.get('un') or '').strip().upper()
            if not un_rule:
                continue
            category = str(rule.get('category') or '').strip().upper()
            if category not in {'VIGENTE', 'MOROSO'}:
                continue
            tramos_raw = rule.get('tramos', [])
            tramos_norm: set[int] = set()
            if isinstance(tramos_raw, list):
                for t in tramos_raw:
                    tramos_norm.add(int(_normalize_tramo(t)))
            tramo_by_un_category.setdefault(un_rule, {'VIGENTE': set(), 'MOROSO': set()})[category] = tramos_norm

        category_expr = case((CarteraFact.tramo > 3, literal('MOROSO')), else_=literal('VIGENTE'))
        for un, cfg in tramo_by_un_category.items():
            vig = sorted(list(cfg.get('VIGENTE') or set()))
            mor = sorted(list(cfg.get('MOROSO') or set()))
            if vig:
                category_expr = case((and_(CarteraFact.un == un, CarteraFact.tramo.in_(vig)), literal('VIGENTE')), else_=category_expr)
            if mor:
                category_expr = case((and_(CarteraFact.un == un, CarteraFact.tramo.in_(mor)), literal('MOROSO')), else_=category_expr)

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
        totals = {'activos': 0, 'pagaron': 0, 'deberia': 0.0, 'cobrado': 0.0, 'transacciones': 0}

        paid_rows = (
            db.query(
                CobranzasFact.contract_id,
                func.coalesce(func.sum(CobranzasFact.payment_amount), 0.0),
                func.coalesce(
                    func.sum(case((CobranzasFact.payment_amount > 0, literal(1)), else_=literal(0))),
                    0,
                ),
            )
            .filter(CobranzasFact.payment_month == resolved_cutoff)
            .group_by(CobranzasFact.contract_id)
            .all()
        )
        paid_by_contract = {str(cid): float(amount or 0.0) for cid, amount, _ in paid_rows}
        tx_by_contract = {str(cid): int(tx_count or 0) for cid, _, tx_count in paid_rows}

        rules_signature = str(hash(json.dumps(tramo_rules_cfg.get('rules') or [], sort_keys=True, ensure_ascii=False)))
        base_cache_key = f'{resolved_cutoff}|{effective_cartera_month}|{rules_signature}'
        base_rows = _cohorte_base_cache_get(base_cache_key)
        if base_rows is None:
            base_rows = []
            for row in cartera_q.all():
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
                cobrado = float(paid_by_contract.get(contract_id, 0.0))
                transacciones = int(tx_by_contract.get(contract_id, 0))
                base_rows.append(
                    {
                        'sale_month': sale_month,
                        'un': str(row.un or 'S/D').strip().upper(),
                        'supervisor': str(row.supervisor or 'S/D').strip().upper(),
                        'via': str(row.via or 'DEBITO').strip().upper(),
                        'category': str(row.category or 'VIGENTE').strip().upper(),
                        'deberia': deberia,
                        'cobrado': cobrado,
                        'pagaron': 1 if cobrado > 0 else 0,
                        'transacciones': transacciones,
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
            sale_month = row['sale_month']
            pagaron = int(row['pagaron'])
            deberia = float(row['deberia'])
            cobrado = float(row['cobrado'])
            transacciones = int(row.get('transacciones', 0) or 0)
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
            totals['activos'] += 1
            totals['pagaron'] += pagaron
            totals['deberia'] += deberia
            totals['cobrado'] += cobrado
            totals['transacciones'] += transacciones

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
            'meta': {
                'source': 'api-v1',
                'source_table': 'cartera_fact + cobranzas_fact',
                'generated_at': datetime.utcnow().isoformat(),
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
