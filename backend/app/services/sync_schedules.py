from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.brokers import SyncJob, SyncSchedule


def schedule_to_dict(row: SyncSchedule) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "interval_value": row.interval_value,
        "interval_unit": row.interval_unit,
        "domains": json.loads(row.domains or "[]") if isinstance(row.domains, str) else (row.domains or []),
        "mode": row.mode,
        "year_from": row.year_from,
        "close_month": row.close_month,
        "close_month_from": row.close_month_from,
        "close_month_to": row.close_month_to,
        "enabled": bool(row.enabled),
        "paused": bool(row.paused),
        "last_run_at": row.last_run_at,
        "last_run_status": row.last_run_status,
        "last_run_summary": json.loads(row.last_run_summary) if isinstance(row.last_run_summary, str) and row.last_run_summary else row.last_run_summary,
        "next_run_at": row.next_run_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def list_schedules(session_factory=SessionLocal) -> list[dict]:
    db = session_factory()
    try:
        return [schedule_to_dict(row) for row in db.query(SyncSchedule).order_by(SyncSchedule.id.asc()).all()]
    finally:
        db.close()


def get_schedule(schedule_id: int, session_factory=SessionLocal) -> dict | None:
    db = session_factory()
    try:
        row = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
        return schedule_to_dict(row) if row else None
    finally:
        db.close()


def create_schedule(
    *,
    name: str,
    interval_value: int,
    interval_unit: str,
    domains: list[str],
    compute_next_run_at,
    mode: str | None = None,
    year_from: int | None = None,
    close_month: str | None = None,
    close_month_from: str | None = None,
    close_month_to: str | None = None,
    enabled: bool = True,
    session_factory=SessionLocal,
) -> dict:
    if interval_unit == "minute" and interval_value < 10:
        raise ValueError("El intervalo mínimo es 10 minutos")
    db = session_factory()
    try:
        now = datetime.now(UTC).replace(tzinfo=None)
        row = SyncSchedule(
            name=name,
            interval_value=interval_value,
            interval_unit=interval_unit,
            domains=json.dumps(domains),
            mode=mode,
            year_from=year_from,
            close_month=close_month,
            close_month_from=close_month_from,
            close_month_to=close_month_to,
            enabled=enabled,
            paused=False,
            next_run_at=compute_next_run_at(interval_value, interval_unit, from_dt=now),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return schedule_to_dict(row)
    finally:
        db.close()


def update_schedule(
    schedule_id: int,
    *,
    name: str | None = None,
    interval_value: int | None = None,
    interval_unit: str | None = None,
    domains: list[str] | None = None,
    mode: str | None = None,
    year_from: int | None = None,
    close_month: str | None = None,
    close_month_from: str | None = None,
    close_month_to: str | None = None,
    enabled: bool | None = None,
    paused: bool | None = None,
    session_factory=SessionLocal,
) -> dict | None:
    db = session_factory()
    try:
        row = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
        if not row:
            return None
        if name is not None:
            row.name = name
        if interval_value is not None:
            row.interval_value = interval_value
        if interval_unit is not None:
            if interval_unit == "minute" and (row.interval_value if interval_value is None else interval_value) < 10:
                raise ValueError("El intervalo mínimo es 10 minutos")
            row.interval_unit = interval_unit
        if interval_value is not None and row.interval_unit == "minute" and interval_value < 10:
            raise ValueError("El intervalo mínimo es 10 minutos")
        if domains is not None:
            row.domains = json.dumps(domains)
        if mode is not None:
            row.mode = mode
        if year_from is not None:
            row.year_from = year_from
        if close_month is not None:
            row.close_month = close_month
        if close_month_from is not None:
            row.close_month_from = close_month_from
        if close_month_to is not None:
            row.close_month_to = close_month_to
        if enabled is not None:
            row.enabled = enabled
        if paused is not None:
            row.paused = paused
        db.commit()
        db.refresh(row)
        return schedule_to_dict(row)
    finally:
        db.close()


def delete_schedule(schedule_id: int, session_factory=SessionLocal) -> bool:
    db = session_factory()
    try:
        db.query(SyncJob).filter(SyncJob.schedule_id == schedule_id).update({"schedule_id": None}, synchronize_session=False)
        deleted = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).delete(synchronize_session=False)
        db.commit()
        return deleted > 0
    finally:
        db.close()


def run_schedule_now(
    schedule_id: int,
    *,
    valid_domains: set[str],
    queue_job,
    persist_sync_run,
    target_table_name,
    query_file_for,
    session_factory=SessionLocal,
) -> dict | None:
    db = session_factory()
    try:
        schedule = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
        if not schedule:
            return None
        domains = json.loads(schedule.domains or "[]") if isinstance(schedule.domains, str) else (schedule.domains or [])
        if not domains:
            return {"schedule_id": schedule_id, "job_ids": [], "message": "Sin dominios"}
        run_group_id = str(uuid.uuid4())
        mode = schedule.mode or "incremental"
        job_ids: list[str] = []
        for domain in domains:
            if domain not in valid_domains:
                continue
            job_id = str(uuid.uuid4())
            queue_job(
                db,
                job_id=job_id,
                domain=domain,
                mode=mode,
                actor="schedule_run_now",
                year_from=schedule.year_from,
                close_month=schedule.close_month,
                close_month_from=schedule.close_month_from,
                close_month_to=schedule.close_month_to,
                schedule_id=schedule.id,
                run_group_id=run_group_id,
            )
            persist_sync_run(
                db,
                {
                    "job_id": job_id,
                    "domain": domain,
                    "mode": mode,
                    "year_from": schedule.year_from,
                    "close_month": schedule.close_month,
                    "target_table": target_table_name(domain),
                    "running": True,
                    "stage": "queued",
                    "progress_pct": 0,
                    "status_message": "Ejecutar ahora",
                    "rows_inserted": 0,
                    "rows_updated": 0,
                    "rows_skipped": 0,
                    "rows_read": 0,
                    "rows_upserted": 0,
                    "rows_unchanged": 0,
                    "throughput_rows_per_sec": 0.0,
                    "eta_seconds": None,
                    "current_query_file": query_file_for(domain),
                    "job_step": "queued",
                    "duplicates_detected": 0,
                    "error": None,
                    "started_at": datetime.now(UTC).replace(tzinfo=None),
                    "finished_at": None,
                    "duration_sec": None,
                    "log": ["Ejecutar ahora (manual)"],
                    "actor": "schedule_run_now",
                },
            )
            job_ids.append(job_id)
        db.commit()
        return {"schedule_id": schedule_id, "job_ids": job_ids}
    finally:
        db.close()


def pause_schedule(schedule_id: int, session_factory=SessionLocal) -> bool:
    db = session_factory()
    try:
        row = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
        if not row:
            return False
        row.paused = True
        db.query(SyncJob).filter(
            SyncJob.schedule_id == schedule_id,
            SyncJob.status.in_(["pending", "running"]),
        ).update(
            {"status": "cancelled", "error": "cancelled_by_user", "finished_at": datetime.now(UTC).replace(tzinfo=None)},
            synchronize_session=False,
        )
        db.commit()
        return True
    finally:
        db.close()


def resume_schedule(schedule_id: int, session_factory=SessionLocal) -> bool:
    db = session_factory()
    try:
        row = db.query(SyncSchedule).filter(SyncSchedule.id == schedule_id).first()
        if not row:
            return False
        row.paused = False
        db.commit()
        return True
    finally:
        db.close()
