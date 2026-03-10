import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.api.v1.endpoints import analytics as analytics_ep  # noqa: E402
from app.schemas.analytics import AnalyticsFilters  # noqa: E402


class AnualesV2EndpointBusinessRulesTests(unittest.TestCase):
    def test_anuales_summary_v2_forwards_gestion_month_filter(self):
        received_filters = {}

        def _fake_summary(_db, filters):
            received_filters["gestion_month"] = list(filters.gestion_month or [])
            return {
                "rows": [{"year": "2025", "ltvCulminadoVigente": 1.0}],
                "cutoff": "03/2026",
                "meta": {"source_table": "analytics_anuales_agg"},
            }

        with patch.object(analytics_ep, "cache_get", return_value=None), patch.object(
            analytics_ep.AnalyticsService, "fetch_anuales_summary_v2", side_effect=_fake_summary
        ), patch.object(analytics_ep, "_decorate_meta", side_effect=lambda _db, payload, **_kwargs: payload):
            payload = analytics_ep.anuales_summary_v2(AnalyticsFilters(gestion_month=["03/2026"]), db=None, user={})

        self.assertEqual(received_filters.get("gestion_month"), ["03/2026"])
        self.assertEqual(payload.get("cutoff"), "03/2026")


if __name__ == "__main__":
    unittest.main()
