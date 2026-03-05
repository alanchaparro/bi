from __future__ import annotations

import json
from dataclasses import dataclass

from app.db.session import SessionLocal
from app.schemas.analytics import AnalyticsFilters
from app.services.analytics_service import AnalyticsService


@dataclass
class ParityResult:
    name: str
    left: float
    right: float
    diff_pct: float
    ok: bool


def _diff_pct(a: float, b: float) -> float:
    base = max(1.0, abs(a), abs(b))
    return abs(a - b) * 100.0 / base


def _check_metric(name: str, left: float, right: float, tolerance_pct: float = 1.0) -> ParityResult:
    d = _diff_pct(left, right)
    return ParityResult(name=name, left=left, right=right, diff_pct=d, ok=d <= tolerance_pct)


def run() -> int:
    db = SessionLocal()
    try:
        filters = AnalyticsFilters()

        r1 = AnalyticsService.fetch_rendimiento_summary_v1(db, filters)
        r2 = AnalyticsService.fetch_rendimiento_summary_v2(db, filters)
        checks = [
            _check_metric('rend.totalDebt', float(r1.get('totalDebt') or 0.0), float(r2.get('totalDebt') or 0.0)),
            _check_metric('rend.totalPaid', float(r1.get('totalPaid') or 0.0), float(r2.get('totalPaid') or 0.0)),
            _check_metric(
                'rend.totalContracts',
                float(r1.get('totalContracts') or 0.0),
                float(r2.get('totalContracts') or 0.0),
            ),
            _check_metric(
                'rend.totalContractsPaid',
                float(r1.get('totalContractsPaid') or 0.0),
                float(r2.get('totalContractsPaid') or 0.0),
            ),
        ]

        a1 = AnalyticsService.fetch_anuales_summary_v1(db, filters)
        a2 = AnalyticsService.fetch_anuales_summary_v2(db, filters)
        sum_contracts_1 = float(sum(int(r.get('contracts') or 0) for r in (a1.get('rows') or [])))
        sum_contracts_2 = float(sum(int(r.get('contracts') or 0) for r in (a2.get('rows') or [])))
        sum_cul_1 = float(sum(int(r.get('culminados') or 0) for r in (a1.get('rows') or [])))
        sum_cul_2 = float(sum(int(r.get('culminados') or 0) for r in (a2.get('rows') or [])))
        checks.extend(
            [
                _check_metric('anuales.contracts.sum', sum_contracts_1, sum_contracts_2),
                _check_metric('anuales.culminados.sum', sum_cul_1, sum_cul_2),
            ]
        )

        out = {
            'ok': all(c.ok for c in checks),
            'checks': [
                {
                    'name': c.name,
                    'left': c.left,
                    'right': c.right,
                    'diff_pct': round(c.diff_pct, 4),
                    'ok': c.ok,
                }
                for c in checks
            ],
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0 if out['ok'] else 2
    finally:
        db.close()


if __name__ == '__main__':
    raise SystemExit(run())
