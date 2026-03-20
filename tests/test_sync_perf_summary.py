import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["DATABASE_URL"] = "sqlite:///./data/test_sync_perf_summary.db"

from app.db.session import engine  # noqa: E402
from app.models.brokers import SyncJobStep, SyncRun  # noqa: E402
from app.services.sync_service import SyncService  # noqa: E402


class SyncPerfSummaryTests(unittest.TestCase):
    def setUp(self):
        SyncJobStep.__table__.drop(bind=engine, checkfirst=True)
        SyncRun.__table__.drop(bind=engine, checkfirst=True)
        SyncRun.__table__.create(bind=engine, checkfirst=True)
        SyncJobStep.__table__.create(bind=engine, checkfirst=True)

        now = datetime(2026, 3, 19, 12, 0, 0)
        with engine.begin() as conn:
            conn.execute(
                SyncRun.__table__.insert(),
                [
                    {
                        "job_id": "job-cartera-ok",
                        "domain": "cartera",
                        "mode": "incremental",
                        "running": False,
                        "stage": "completed",
                        "rows_read": 120,
                        "rows_upserted": 100,
                        "throughput_rows_per_sec": 40.0,
                        "started_at": now - timedelta(minutes=8),
                        "finished_at": now - timedelta(minutes=6),
                        "duration_sec": 120.0,
                        "actor": "tester",
                    },
                    {
                        "job_id": "job-cobranzas-fail",
                        "domain": "cobranzas",
                        "mode": "incremental",
                        "running": False,
                        "stage": "failed",
                        "rows_read": 90,
                        "rows_upserted": 0,
                        "throughput_rows_per_sec": 0.0,
                        "started_at": now - timedelta(minutes=5),
                        "finished_at": now - timedelta(minutes=4),
                        "duration_sec": 60.0,
                        "error": "boom",
                        "actor": "tester",
                    },
                ],
            )
            conn.execute(
                SyncJobStep.__table__.insert(),
                [
                    {
                        "job_id": "job-cartera-ok",
                        "domain": "cartera",
                        "step_name": "extract",
                        "status": "completed",
                        "details_json": '{"rows_read": 120}',
                        "started_at": now - timedelta(minutes=8),
                        "finished_at": now - timedelta(minutes=7, seconds=30),
                        "duration_sec": 30.0,
                    },
                    {
                        "job_id": "job-cartera-ok",
                        "domain": "cartera",
                        "step_name": "upsert",
                        "status": "completed",
                        "details_json": '{"rows_upserted": 100}',
                        "started_at": now - timedelta(minutes=7),
                        "finished_at": now - timedelta(minutes=6),
                        "duration_sec": 60.0,
                    },
                    {
                        "job_id": "job-cobranzas-fail",
                        "domain": "cobranzas",
                        "step_name": "extract",
                        "status": "completed",
                        "details_json": '{"rows_read": 90}',
                        "started_at": now - timedelta(minutes=5),
                        "finished_at": now - timedelta(minutes=4, seconds=20),
                        "duration_sec": 40.0,
                    },
                    {
                        "job_id": "job-cobranzas-fail",
                        "domain": "cobranzas",
                        "step_name": "refresh_agg",
                        "status": "failed",
                        "details_json": '{"rows_read": 90}',
                        "started_at": now - timedelta(minutes=4, seconds=10),
                        "finished_at": now - timedelta(minutes=4),
                        "duration_sec": 10.0,
                    },
                ],
            )

    def test_perf_summary_includes_step_metrics_and_last_completed(self):
        summary = SyncService.perf_summary(limit=20)

        self.assertEqual(summary["totals"]["jobs"], 2)
        self.assertEqual(summary["totals"]["completed"], 1)
        self.assertEqual(summary["totals"]["failed"], 1)
        self.assertIn("p95_duration_sec", summary["totals"])

        self.assertIn("cartera", summary["by_domain"])
        self.assertEqual(summary["by_domain"]["cartera"]["completed"], 1)

        self.assertIn("extract", summary["by_step"])
        self.assertEqual(summary["by_step"]["extract"]["runs"], 2)
        self.assertEqual(summary["by_step"]["extract"]["completed"], 2)
        self.assertGreater(summary["by_step"]["extract"]["avg_rows"], 0.0)

        self.assertIn("refresh_agg", summary["by_step"])
        self.assertEqual(summary["by_step"]["refresh_agg"]["failed"], 1)

        self.assertIn("cartera", summary["last_completed_by_domain"])
        self.assertEqual(summary["last_completed_by_domain"]["cartera"]["job_id"], "job-cartera-ok")
        self.assertNotIn("cobranzas", summary["last_completed_by_domain"])


if __name__ == "__main__":
    unittest.main()
