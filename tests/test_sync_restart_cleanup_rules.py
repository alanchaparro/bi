import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["DATABASE_URL"] = "sqlite:///./data/test_sync_restart_cleanup.db"

from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.brokers import SyncJob, SyncRun  # noqa: E402
from app.services.sync_service import (  # noqa: E402
    RUNNING_JOB_STALE_GRACE_SECONDS,
    _cleanup_stale_running_jobs,
    _cleanup_stale_running_queue_jobs,
)


class SyncRestartCleanupRulesTests(unittest.TestCase):
    def setUp(self):
        SyncRun.__table__.drop(bind=engine, checkfirst=True)
        SyncJob.__table__.drop(bind=engine, checkfirst=True)
        SyncRun.__table__.create(bind=engine, checkfirst=True)
        SyncJob.__table__.create(bind=engine, checkfirst=True)

    def test_cleanup_keeps_recent_running_jobs(self):
        now = datetime.utcnow()
        db = SessionLocal()
        try:
            db.add(
                SyncRun(
                    job_id="job_recent",
                    domain="cartera",
                    mode="range_months",
                    running=True,
                    stage="refreshing_corte_agg",
                    started_at=now - timedelta(minutes=2),
                )
            )
            db.add(
                SyncJob(
                    job_id="job_recent",
                    domain="cartera",
                    status="running",
                    mode="range_months",
                    actor="tester",
                    locked_by="worker-a",
                    locked_at=now,
                    started_at=now - timedelta(minutes=2),
                )
            )
            db.commit()
        finally:
            db.close()

        _cleanup_stale_running_jobs()
        _cleanup_stale_running_queue_jobs()

        db = SessionLocal()
        try:
            run = db.query(SyncRun).filter(SyncRun.job_id == "job_recent").first()
            job = db.query(SyncJob).filter(SyncJob.job_id == "job_recent").first()
            self.assertIsNotNone(run)
            self.assertIsNotNone(job)
            self.assertTrue(bool(run.running))
            self.assertEqual(str(job.status), "running")
        finally:
            db.close()

    def test_cleanup_marks_only_stale_running_jobs(self):
        now = datetime.utcnow()
        stale_at = now - timedelta(seconds=RUNNING_JOB_STALE_GRACE_SECONDS + 30)
        db = SessionLocal()
        try:
            db.add(
                SyncRun(
                    job_id="job_stale",
                    domain="cartera",
                    mode="range_months",
                    running=True,
                    stage="refreshing_corte_agg",
                    started_at=stale_at,
                )
            )
            db.add(
                SyncJob(
                    job_id="job_stale",
                    domain="cartera",
                    status="running",
                    mode="range_months",
                    actor="tester",
                    locked_by="worker-a",
                    locked_at=stale_at,
                    started_at=stale_at,
                )
            )
            db.commit()
        finally:
            db.close()

        _cleanup_stale_running_jobs()
        _cleanup_stale_running_queue_jobs()

        db = SessionLocal()
        try:
            run = db.query(SyncRun).filter(SyncRun.job_id == "job_stale").first()
            job = db.query(SyncJob).filter(SyncJob.job_id == "job_stale").first()
            self.assertIsNotNone(run)
            self.assertIsNotNone(job)
            self.assertFalse(bool(run.running))
            self.assertEqual(str(run.error), "job_interrupted_on_restart")
            self.assertEqual(str(job.status), "failed")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
