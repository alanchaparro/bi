from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from urllib.parse import urlencode

import httpx
from sqlalchemy import Integer, Numeric, and_, case, cast, func, literal
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import AnalyticsContractSnapshot, BrokersSupervisorScope, CarteraFact, CommissionRules, PrizeRules
from app.schemas.analytics import AnalyticsFilters, PortfolioSummaryIn
from app.services.brokers_config_service import BrokersConfigService


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
