import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ.setdefault("DATABASE_URL", "sqlite:///./data/test_sync_cache_invalidation.db")

from app.services.sync_service import (  # noqa: E402
    _invalidate_cartera_cache,
    _invalidate_when_months_overlap,
)


class SyncCacheInvalidationTests(unittest.TestCase):
    def test_invalidate_when_months_overlap_respects_selected_month(self):
        months = {"03/2026", "04/2026"}
        self.assertTrue(_invalidate_when_months_overlap({"gestion_month": ["03/2026"]}, months, "gestion_month"))
        self.assertFalse(_invalidate_when_months_overlap({"gestion_month": ["01/2026"]}, months, "gestion_month"))
        self.assertTrue(_invalidate_when_months_overlap({}, months, "gestion_month"))

    def test_cartera_invalidation_considers_close_month_equivalence(self):
        target_gestion = {"03/2026"}
        self.assertTrue(_invalidate_cartera_cache({"close_month": ["02/2026"]}, target_gestion))
        self.assertTrue(_invalidate_cartera_cache({"gestion_month": ["03/2026"]}, target_gestion))
        self.assertFalse(_invalidate_cartera_cache({"close_month": ["01/2026"]}, target_gestion))
        self.assertFalse(_invalidate_cartera_cache({"gestion_month": ["01/2026"]}, target_gestion))
        self.assertTrue(_invalidate_cartera_cache({}, target_gestion))


if __name__ == "__main__":
    unittest.main()
