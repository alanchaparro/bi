from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import inspect, text

from app.db.session import SessionLocal, engine
from app.core.config import settings
from app.models.brokers import (
    AnalyticsContractSnapshot,
    AnalyticsSourceFreshness,
    AuditLog,
    AuthSession,
    AuthUser,
    AuthUserState,
    BrokersSupervisorScope,
    CommissionRules,
    PrizeRules,
    UserPreference,
)

logger = logging.getLogger(__name__)


def ensure_runtime_schema() -> None:
    """
    Create only the runtime tables required for auth/config/bootstrap flows.
    Avoid global Base.metadata.create_all(), which is not safe in concurrent
    startup scenarios and can clash with existing index objects.
    """
    runtime_tables = [
        AuthUser,
        AuthUserState,
        AuthSession,
        UserPreference,
        BrokersSupervisorScope,
        CommissionRules,
        PrizeRules,
        AuditLog,
        AnalyticsContractSnapshot,
        AnalyticsSourceFreshness,
    ]
    for model in runtime_tables:
        model.__table__.create(bind=engine, checkfirst=True)


def ensure_sync_schema_compatibility() -> None:
    """
    Backfill sync schema drift on existing databases.
    create_all() does not alter existing tables, so new columns added in later
    releases (for example sync_jobs.schedule_id) must be added explicitly.
    """
    inspector = inspect(engine)
    if not inspector.has_table("sync_jobs"):
        return

    with engine.begin() as conn:
        dialect = conn.dialect.name
        sync_job_columns = {c.get("name") for c in inspector.get_columns("sync_jobs")}

        if "sync_schedules" not in inspector.get_table_names():
            # Local import avoids loading all metadata just to backfill one table.
            from app.models.brokers import SyncSchedule

            SyncSchedule.__table__.create(bind=conn, checkfirst=True)

        if "schedule_id" not in sync_job_columns:
            conn.execute(text("ALTER TABLE sync_jobs ADD COLUMN schedule_id INTEGER"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_sync_jobs_schedule_id ON sync_jobs (schedule_id)"
                )
            )
            if dialect == "postgresql":
                try:
                    conn.execute(
                        text(
                            "ALTER TABLE sync_jobs "
                            "ADD CONSTRAINT fk_sync_jobs_schedule_id "
                            "FOREIGN KEY (schedule_id) REFERENCES sync_schedules(id)"
                        )
                    )
                except Exception:
                    # Constraint may already exist or not be creatable in this DB state.
                    logger.warning("Could not create fk_sync_jobs_schedule_id", exc_info=True)

        if "run_group_id" not in sync_job_columns:
            conn.execute(text("ALTER TABLE sync_jobs ADD COLUMN run_group_id VARCHAR(64)"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_sync_jobs_run_group_id ON sync_jobs (run_group_id)"
                )
            )


def bootstrap_database_with_demo_probe() -> None:
    """
    Ensure schema exists and run a short insert/delete probe to validate write path.
    The probe leaves no demo data persisted.
    """
    ensure_runtime_schema()
    ensure_sync_schema_compatibility()

    if not settings.db_demo_probe_on_start:
        logger.info('DB bootstrap completed (schema ensured, demo probe disabled)')
        return

    db = SessionLocal()
    probe_id = -999999
    try:
        probe = CommissionRules(id=probe_id, rules_json='[]', updated_at=datetime.utcnow())
        db.add(probe)
        db.flush()
        db.delete(probe)
        db.commit()
        logger.info('DB bootstrap completed (schema ensured + demo probe insert/delete)')
    except Exception:
        db.rollback()
        logger.exception('DB bootstrap failed')
        raise
    finally:
        db.close()
