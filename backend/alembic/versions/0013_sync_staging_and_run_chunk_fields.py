"""sync staging table and sync_run chunk fields

Revision ID: 0013_sync_staging_rows
Revises: 0012_sync_incremental_controls
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_sync_staging_rows"
down_revision = "0012_sync_incremental_controls"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col.get("name") == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "sync_runs", "chunk_key"):
        op.add_column("sync_runs", sa.Column("chunk_key", sa.String(length=256), nullable=True))
    if not _has_column(inspector, "sync_runs", "chunk_status"):
        op.add_column("sync_runs", sa.Column("chunk_status", sa.String(length=16), nullable=True))
    if not _has_column(inspector, "sync_runs", "skipped_unchanged_chunks"):
        op.add_column(
            "sync_runs",
            sa.Column("skipped_unchanged_chunks", sa.Integer(), nullable=False, server_default="0"),
        )

    if not inspector.has_table("sync_staging_rows"):
        op.create_table(
            "sync_staging_rows",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("job_id", sa.String(length=64), nullable=False),
            sa.Column("domain", sa.String(length=32), nullable=False),
            sa.Column("chunk_key", sa.String(length=128), nullable=False, server_default="*"),
            sa.Column("contract_id", sa.String(length=64), nullable=False, server_default=""),
            sa.Column("gestion_month", sa.String(length=7), nullable=False, server_default=""),
            sa.Column("source_hash", sa.String(length=64), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_job_id ON sync_staging_rows (job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_domain ON sync_staging_rows (domain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_chunk_key ON sync_staging_rows (chunk_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_contract_id ON sync_staging_rows (contract_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_gestion_month ON sync_staging_rows (gestion_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_created_at ON sync_staging_rows (created_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_job_chunk "
        "ON sync_staging_rows (job_id, chunk_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sync_staging_rows_domain_month "
        "ON sync_staging_rows (domain, gestion_month)"
    )


def downgrade() -> None:
    op.drop_index("ix_sync_staging_rows_domain_month", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_job_chunk", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_created_at", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_gestion_month", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_contract_id", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_chunk_key", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_domain", table_name="sync_staging_rows")
    op.drop_index("ix_sync_staging_rows_job_id", table_name="sync_staging_rows")
    op.drop_table("sync_staging_rows")

    op.drop_column("sync_runs", "skipped_unchanged_chunks")
    op.drop_column("sync_runs", "chunk_status")
    op.drop_column("sync_runs", "chunk_key")
