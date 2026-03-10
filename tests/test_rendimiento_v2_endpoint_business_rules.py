import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.api.v1.endpoints import analytics as analytics_ep  # noqa: E402
from app.schemas.analytics import AnalyticsFilters  # noqa: E402


def _pct(total_paid: float, total_debt: float) -> float:
    if total_debt <= 0:
        return 0.0
    return round((total_paid / total_debt) * 100.0, 1)


class RendimientoV2EndpointBusinessRulesTests(unittest.TestCase):
    def test_rendimiento_kpi_bases_are_consistent(self):
        fake_summary = {
            "totalDebt": 1000.0,
            "totalPaid": 250.0,
            "totalContracts": 10,
            "totalContractsPaid": 5,
            "tramoStats": {},
            "unStats": {},
            "viaCStats": {},
            "gestorStats": {},
            "matrixStats": {},
            "trendStats": {},
            "meta": {"source_table": "analytics_rendimiento_agg"},
        }
        with patch.object(analytics_ep, "cache_get", return_value=None), patch.object(
            analytics_ep.AnalyticsService, "fetch_rendimiento_summary_v2", return_value=fake_summary
        ), patch.object(analytics_ep, "_decorate_meta", side_effect=lambda _db, payload, **_kwargs: payload):
            payload = analytics_ep.rendimiento_summary_v2(AnalyticsFilters(gestion_month=["03/2026"]), db=None, user={})

        deuda_asignada = float(payload.get("totalDebt") or 0.0)
        total_cobrado = float(payload.get("totalPaid") or 0.0)
        recuperacion_global = _pct(total_cobrado, deuda_asignada)

        self.assertEqual(deuda_asignada, 1000.0)
        self.assertEqual(total_cobrado, 250.0)
        self.assertEqual(recuperacion_global, 25.0)


if __name__ == "__main__":
    unittest.main()
