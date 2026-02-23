"""sync jobs queue table

Revision ID: 0009_sync_jobs_queue
Revises: 0008_sync_perf_and_steps
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_sync_jobs_queue"
down_revision = "0008_sync_perf_and_steps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("sync_jobs"):
        op.create_table(
            "sync_jobs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("job_id", sa.String(length=64), nullable=False, unique=True),
            sa.Column("domain", sa.String(length=32), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
            sa.Column("mode", sa.String(length=32), nullable=False),
            sa.Column("actor", sa.String(length=128), nullable=False, server_default="system"),
            sa.Column("year_from", sa.Integer(), nullable=True),
            sa.Column("close_month", sa.String(length=7), nullable=True),
            sa.Column("close_month_from", sa.String(length=7), nullable=True),
            sa.Column("close_month_to", sa.String(length=7), nullable=True),
            sa.Column("max_retries", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("locked_by", sa.String(length=128), nullable=True),
            sa.Column("locked_at", sa.DateTime(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
        )

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_sync_jobs_job_id ON sync_jobs (job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_jobs_domain ON sync_jobs (domain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_jobs_status ON sync_jobs (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_jobs_created_at ON sync_jobs (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_jobs_priority ON sync_jobs (priority)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sync_jobs_status_priority_created ON sync_jobs (status, priority, created_at)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_jobs_domain_status_created ON sync_jobs (domain, status, created_at)")


def downgrade() -> None:
    op.drop_index("ix_sync_jobs_domain_status_created", table_name="sync_jobs")
    op.drop_index("ix_sync_jobs_status_priority_created", table_name="sync_jobs")
    op.drop_index("ix_sync_jobs_priority", table_name="sync_jobs")
    op.drop_index("ix_sync_jobs_created_at", table_name="sync_jobs")
    op.drop_index("ix_sync_jobs_status", table_name="sync_jobs")
    op.drop_index("ix_sync_jobs_domain", table_name="sync_jobs")
    op.drop_index("ix_sync_jobs_job_id", table_name="sync_jobs")
    op.drop_table("sync_jobs")
