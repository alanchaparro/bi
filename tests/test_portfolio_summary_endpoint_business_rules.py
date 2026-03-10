import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.api.v1.endpoints import analytics as analytics_ep  # noqa: E402
from app.schemas.analytics import PortfolioSummaryIn  # noqa: E402


class PortfolioSummaryEndpointBusinessRulesTests(unittest.TestCase):
    def test_endpoint_keeps_components_for_monto_a_cobrar_formula(self):
        fake_summary = {
            "total_contracts": 1,
            "debt_total": 1250.0,
            "expired_total": 1000.0,
            "cuota_total": 250.0,
            "charts": {},
            "rows": [],
        }
        with patch.object(analytics_ep, "cache_get", return_value=None), patch.object(
            analytics_ep.AnalyticsService, "fetch_portfolio_summary_v1", return_value=fake_summary
        ), patch.object(analytics_ep, "_decorate_meta", side_effect=lambda _db, payload, **_kwargs: payload):
            payload = analytics_ep.portfolio_summary(PortfolioSummaryIn(gestion_month=["03/2026"], include_rows=False), db=None, user={})

        expired_total = float(payload.get("expired_total") or 0.0)
        cuota_total = float(payload.get("cuota_total") or 0.0)
        monto_a_cobrar = expired_total + cuota_total
        self.assertEqual(expired_total, 1000.0)
        self.assertEqual(cuota_total, 250.0)
        self.assertEqual(monto_a_cobrar, 1250.0)


if __name__ == "__main__":
    unittest.main()
