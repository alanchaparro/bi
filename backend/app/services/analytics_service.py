from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import AnalyticsContractSnapshot, BrokersSupervisorScope, CommissionRules, PrizeRules
from app.schemas.analytics import AnalyticsFilters


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
        with httpx.Client(timeout=30.0) as client:
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
