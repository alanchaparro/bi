"""sync incremental control tables

Revision ID: 0012_sync_incremental_controls
Revises: 0011_fact_autovacuum_tuning
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_sync_incremental_controls"
down_revision = "0011_fact_autovacuum_tuning"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("sync_watermarks"):
        op.create_table(
            "sync_watermarks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("domain", sa.String(length=32), nullable=False),
            sa.Column("query_file", sa.String(length=128), nullable=False),
            sa.Column("partition_key", sa.String(length=64), nullable=False, server_default="*"),
            sa.Column("last_updated_at", sa.DateTime(), nullable=True),
            sa.Column("last_source_id", sa.String(length=64), nullable=True),
            sa.Column("last_success_job_id", sa.String(length=64), nullable=True),
            sa.Column("last_row_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_watermarks_domain ON sync_watermarks (domain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_watermarks_query_file ON sync_watermarks (query_file)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_watermarks_partition_key ON sync_watermarks (partition_key)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_sync_watermarks_key "
        "ON sync_watermarks (domain, query_file, partition_key)"
    )

    if not inspector.has_table("sync_chunk_manifest"):
        op.create_table(
            "sync_chunk_manifest",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("domain", sa.String(length=32), nullable=False),
            sa.Column("chunk_key", sa.String(length=128), nullable=False),
            sa.Column("chunk_hash", sa.String(length=64), nullable=False),
            sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("first_seen_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("last_seen_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="changed"),
            sa.Column("last_job_id", sa.String(length=64), nullable=True),
            sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_domain ON sync_chunk_manifest (domain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_chunk_key ON sync_chunk_manifest (chunk_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_chunk_hash ON sync_chunk_manifest (chunk_hash)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_status ON sync_chunk_manifest (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_last_job_id ON sync_chunk_manifest (last_job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_last_seen_at ON sync_chunk_manifest (last_seen_at)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_sync_chunk_manifest_key "
        "ON sync_chunk_manifest (domain, chunk_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sync_chunk_manifest_domain_last_seen "
        "ON sync_chunk_manifest (domain, last_seen_at)"
    )

    if not inspector.has_table("sync_extract_log"):
        op.create_table(
            "sync_extract_log",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("job_id", sa.String(length=64), nullable=False),
            sa.Column("domain", sa.String(length=32), nullable=False),
            sa.Column("chunk_key", sa.String(length=128), nullable=False, server_default="*"),
            sa.Column("stage", sa.String(length=32), nullable=False, server_default="extract"),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="completed"),
            sa.Column("rows", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("duration_sec", sa.Float(), nullable=False, server_default="0"),
            sa.Column("throughput_rows_per_sec", sa.Float(), nullable=False, server_default="0"),
            sa.Column("details_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_extract_log_job_id ON sync_extract_log (job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_extract_log_domain ON sync_extract_log (domain)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_extract_log_chunk_key ON sync_extract_log (chunk_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_extract_log_stage ON sync_extract_log (stage)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_extract_log_status ON sync_extract_log (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sync_extract_log_created_at ON sync_extract_log (created_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sync_extract_log_job_created "
        "ON sync_extract_log (job_id, created_at)"
    )


def downgrade() -> None:
    op.drop_index("ix_sync_extract_log_job_created", table_name="sync_extract_log")
    op.drop_index("ix_sync_extract_log_created_at", table_name="sync_extract_log")
    op.drop_index("ix_sync_extract_log_status", table_name="sync_extract_log")
    op.drop_index("ix_sync_extract_log_stage", table_name="sync_extract_log")
    op.drop_index("ix_sync_extract_log_chunk_key", table_name="sync_extract_log")
    op.drop_index("ix_sync_extract_log_domain", table_name="sync_extract_log")
    op.drop_index("ix_sync_extract_log_job_id", table_name="sync_extract_log")
    op.drop_table("sync_extract_log")

    op.drop_index("ix_sync_chunk_manifest_domain_last_seen", table_name="sync_chunk_manifest")
    op.drop_index("ux_sync_chunk_manifest_key", table_name="sync_chunk_manifest")
    op.drop_index("ix_sync_chunk_manifest_last_seen_at", table_name="sync_chunk_manifest")
    op.drop_index("ix_sync_chunk_manifest_last_job_id", table_name="sync_chunk_manifest")
    op.drop_index("ix_sync_chunk_manifest_status", table_name="sync_chunk_manifest")
    op.drop_index("ix_sync_chunk_manifest_chunk_hash", table_name="sync_chunk_manifest")
    op.drop_index("ix_sync_chunk_manifest_chunk_key", table_name="sync_chunk_manifest")
    op.drop_index("ix_sync_chunk_manifest_domain", table_name="sync_chunk_manifest")
    op.drop_table("sync_chunk_manifest")

    op.drop_index("ux_sync_watermarks_key", table_name="sync_watermarks")
    op.drop_index("ix_sync_watermarks_partition_key", table_name="sync_watermarks")
    op.drop_index("ix_sync_watermarks_query_file", table_name="sync_watermarks")
    op.drop_index("ix_sync_watermarks_domain", table_name="sync_watermarks")
    op.drop_table("sync_watermarks")
