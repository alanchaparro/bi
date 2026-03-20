import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["DATABASE_URL"] = "sqlite:///./data/test_sync_schedules.db"

from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.brokers import SyncJob, SyncSchedule  # noqa: E402
from app.services.sync_schedules import (  # noqa: E402
    create_schedule,
    delete_schedule,
    get_schedule,
    list_schedules,
    pause_schedule,
    resume_schedule,
    run_schedule_now,
    update_schedule,
)


def _compute_next_run_at(interval_value: int, interval_unit: str, from_dt: datetime) -> datetime:
    if interval_unit == "minute":
        return from_dt + timedelta(minutes=interval_value)
    if interval_unit == "hour":
        return from_dt + timedelta(hours=interval_value)
    return from_dt + timedelta(days=interval_value)


class SyncSchedulesServiceTests(unittest.TestCase):
    def setUp(self):
        SyncJob.__table__.drop(bind=engine, checkfirst=True)
        SyncSchedule.__table__.drop(bind=engine, checkfirst=True)
        SyncSchedule.__table__.create(bind=engine, checkfirst=True)
        SyncJob.__table__.create(bind=engine, checkfirst=True)

    def test_create_update_list_and_get_schedule(self):
        created = create_schedule(
            name="cada 10 minutos",
            interval_value=10,
            interval_unit="minute",
            domains=["cartera", "cobranzas"],
            compute_next_run_at=_compute_next_run_at,
            mode="incremental",
            close_month="03/2026",
        )

        self.assertEqual(created["name"], "cada 10 minutos")
        self.assertEqual(created["domains"], ["cartera", "cobranzas"])
        self.assertEqual(created["mode"], "incremental")
        self.assertIsNotNone(created["next_run_at"])

        updated = update_schedule(
            created["id"],
            name="cada 1 hora",
            interval_value=1,
            interval_unit="hour",
            domains=["cartera"],
            enabled=False,
            paused=True,
        )

        self.assertIsNotNone(updated)
        self.assertEqual(updated["name"], "cada 1 hora")
        self.assertEqual(updated["interval_unit"], "hour")
        self.assertEqual(updated["domains"], ["cartera"])

        fetched = get_schedule(created["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["name"], "cada 1 hora")
        self.assertFalse(bool(fetched["enabled"]))
        self.assertTrue(bool(fetched["paused"]))

        rows = list_schedules()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], created["id"])

    def test_run_schedule_now_enqueues_only_valid_domains(self):
        created = create_schedule(
            name="manual",
            interval_value=1,
            interval_unit="hour",
            domains=["cartera", "invalido"],
            compute_next_run_at=_compute_next_run_at,
            mode="range_months",
            year_from=2025,
            close_month="03/2026",
        )

        queued_calls: list[dict] = []
        persisted_runs: list[dict] = []

        def _queue_job(db, **kwargs):
            queued_calls.append(kwargs)
            db.add(
                SyncJob(
                    job_id=kwargs["job_id"],
                    domain=kwargs["domain"],
                    status="pending",
                    mode=kwargs["mode"],
                    actor=kwargs["actor"],
                    schedule_id=kwargs["schedule_id"],
                    run_group_id=kwargs["run_group_id"],
                )
            )

        def _persist_sync_run(db, payload: dict):
            persisted_runs.append(payload)

        result = run_schedule_now(
            created["id"],
            valid_domains={"cartera", "cobranzas"},
            queue_job=_queue_job,
            persist_sync_run=_persist_sync_run,
            target_table_name=lambda domain: f"{domain}_fact",
            query_file_for=lambda domain: f"{domain}.sql",
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(result["job_ids"]), 1)
        self.assertEqual(len(queued_calls), 1)
        self.assertEqual(queued_calls[0]["domain"], "cartera")
        self.assertEqual(len(persisted_runs), 1)
        self.assertEqual(persisted_runs[0]["target_table"], "cartera_fact")

    def test_pause_resume_and_delete_schedule(self):
        created = create_schedule(
            name="pausable",
            interval_value=1,
            interval_unit="day",
            domains=["cartera"],
            compute_next_run_at=_compute_next_run_at,
        )

        db = SessionLocal()
        try:
            db.add(
                SyncJob(
                    job_id="job-pendiente",
                    domain="cartera",
                    status="pending",
                    mode="incremental",
                    actor="tester",
                    schedule_id=created["id"],
                )
            )
            db.commit()
        finally:
            db.close()

        self.assertTrue(pause_schedule(created["id"]))

        db = SessionLocal()
        try:
            schedule = db.query(SyncSchedule).filter(SyncSchedule.id == created["id"]).first()
            job = db.query(SyncJob).filter(SyncJob.job_id == "job-pendiente").first()
            self.assertIsNotNone(schedule)
            self.assertIsNotNone(job)
            self.assertTrue(bool(schedule.paused))
            self.assertEqual(str(job.status), "cancelled")
            self.assertEqual(str(job.error), "cancelled_by_user")
        finally:
            db.close()

        self.assertTrue(resume_schedule(created["id"]))

        db = SessionLocal()
        try:
            schedule = db.query(SyncSchedule).filter(SyncSchedule.id == created["id"]).first()
            self.assertIsNotNone(schedule)
            self.assertFalse(bool(schedule.paused))
        finally:
            db.close()

        self.assertTrue(delete_schedule(created["id"]))

        db = SessionLocal()
        try:
            schedule = db.query(SyncSchedule).filter(SyncSchedule.id == created["id"]).first()
            job = db.query(SyncJob).filter(SyncJob.job_id == "job-pendiente").first()
            self.assertIsNone(schedule)
            self.assertIsNotNone(job)
            self.assertIsNone(job.schedule_id)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
