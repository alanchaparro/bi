"""sync perf fields and job steps

Revision ID: 0008_sync_perf_and_steps
Revises: 0007_corte_agg
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


revision = '0008_sync_perf_and_steps'
down_revision = '0007_corte_agg'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    sync_runs_columns = {c["name"] for c in inspector.get_columns("sync_runs")}
    if "throughput_rows_per_sec" not in sync_runs_columns:
        op.add_column("sync_runs", sa.Column("throughput_rows_per_sec", sa.Float(), nullable=True))
    if "eta_seconds" not in sync_runs_columns:
        op.add_column("sync_runs", sa.Column("eta_seconds", sa.Integer(), nullable=True))
    if "current_query_file" not in sync_runs_columns:
        op.add_column("sync_runs", sa.Column("current_query_file", sa.String(length=128), nullable=True))
    if "job_step" not in sync_runs_columns:
        op.add_column("sync_runs", sa.Column("job_step", sa.String(length=64), nullable=True))

    if not inspector.has_table("sync_job_steps"):
        op.create_table(
            "sync_job_steps",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("job_id", sa.String(length=64), nullable=False),
            sa.Column("domain", sa.String(length=32), nullable=False),
            sa.Column("step_name", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="running"),
            sa.Column("details_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("duration_sec", sa.Float(), nullable=True),
        )

    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_job_steps_job_id ON sync_job_steps (job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_job_steps_domain ON sync_job_steps (domain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_job_steps_step_name ON sync_job_steps (step_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_job_steps_status ON sync_job_steps (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_job_steps_started_at ON sync_job_steps (started_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sync_job_steps_job_domain_step ON sync_job_steps (job_id, domain, step_name)"
    )


def downgrade() -> None:
    op.drop_index('ix_sync_job_steps_job_domain_step', table_name='sync_job_steps')
    op.drop_index('ix_sync_job_steps_started_at', table_name='sync_job_steps')
    op.drop_index('ix_sync_job_steps_status', table_name='sync_job_steps')
    op.drop_index('ix_sync_job_steps_step_name', table_name='sync_job_steps')
    op.drop_index('ix_sync_job_steps_domain', table_name='sync_job_steps')
    op.drop_index('ix_sync_job_steps_job_id', table_name='sync_job_steps')
    op.drop_table('sync_job_steps')

    with op.batch_alter_table('sync_runs') as batch_op:
        batch_op.drop_column('job_step')
        batch_op.drop_column('current_query_file')
        batch_op.drop_column('eta_seconds')
        batch_op.drop_column('throughput_rows_per_sec')
