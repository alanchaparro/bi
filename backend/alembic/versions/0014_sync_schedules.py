"""sync_schedules table and schedule_id/run_group_id on sync_jobs

Revision ID: 0014_sync_schedules
Revises: 0013_sync_staging_rows
Create Date: 2026-03-03

"""

from alembic import op
import sqlalchemy as sa


revision = "0014_sync_schedules"
down_revision = "0013_sync_staging_rows"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if not sa.inspect(bind).has_table("sync_schedules"):
        op.create_table(
            "sync_schedules",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("interval_value", sa.Integer(), nullable=False),
            sa.Column("interval_unit", sa.String(16), nullable=False),
            sa.Column("domains", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("mode", sa.String(32), nullable=True),
            sa.Column("year_from", sa.Integer(), nullable=True),
            sa.Column("close_month", sa.String(7), nullable=True),
            sa.Column("close_month_from", sa.String(7), nullable=True),
            sa.Column("close_month_to", sa.String(7), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("paused", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("last_run_at", sa.DateTime(), nullable=True),
            sa.Column("last_run_status", sa.String(16), nullable=True),
            sa.Column("last_run_summary", sa.Text(), nullable=True),
            sa.Column("next_run_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_sync_schedules_next_run_at", "sync_schedules", ["next_run_at"])

    inspector = sa.inspect(bind)
    if not any(c.get("name") == "schedule_id" for c in inspector.get_columns("sync_jobs")):
        op.add_column("sync_jobs", sa.Column("schedule_id", sa.Integer(), nullable=True))
        if dialect == "postgresql":
            op.create_foreign_key(
                "fk_sync_jobs_schedule_id",
                "sync_jobs",
                "sync_schedules",
                ["schedule_id"],
                ["id"],
            )
        op.create_index("ix_sync_jobs_schedule_id", "sync_jobs", ["schedule_id"])
    if not any(c.get("name") == "run_group_id" for c in inspector.get_columns("sync_jobs")):
        op.add_column("sync_jobs", sa.Column("run_group_id", sa.String(64), nullable=True))
        op.create_index("ix_sync_jobs_run_group_id", "sync_jobs", ["run_group_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if any(c.get("name") == "run_group_id" for c in inspector.get_columns("sync_jobs")):
        op.drop_index("ix_sync_jobs_run_group_id", table_name="sync_jobs")
        op.drop_column("sync_jobs", "run_group_id")
    if any(c.get("name") == "schedule_id" for c in inspector.get_columns("sync_jobs")):
        op.drop_index("ix_sync_jobs_schedule_id", table_name="sync_jobs")
        try:
            op.drop_constraint("fk_sync_jobs_schedule_id", "sync_jobs", type_="foreignkey")
        except Exception:
            pass
        op.drop_column("sync_jobs", "schedule_id")
    if inspector.has_table("sync_schedules"):
        op.drop_index("ix_sync_schedules_next_run_at", table_name="sync_schedules")
        op.drop_table("sync_schedules")
