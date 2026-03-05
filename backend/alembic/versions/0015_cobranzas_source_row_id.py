"""cobranzas_fact source_row_id unique key

Revision ID: 0015_cobranzas_source_row_id
Revises: 0014_sync_schedules
Create Date: 2026-03-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_cobranzas_source_row_id"
down_revision = "0014_sync_schedules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("cobranzas_fact"):
        columns = {c.get("name") for c in inspector.get_columns("cobranzas_fact")}
        if "source_row_id" not in columns:
            op.add_column("cobranzas_fact", sa.Column("source_row_id", sa.String(length=64), nullable=True))

        # Backfill legacy rows with deterministic unique ids so the new unique index is valid.
        op.execute(
            "UPDATE cobranzas_fact SET source_row_id = CONCAT('legacy-', id) "
            "WHERE source_row_id IS NULL OR source_row_id = ''"
        )

        try:
            op.drop_index("ux_cobranzas_fact_business_key", table_name="cobranzas_fact")
        except Exception:
            pass

        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_cobranzas_fact_source_row_id "
            "ON cobranzas_fact (source_row_id)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("cobranzas_fact"):
        try:
            op.drop_index("ux_cobranzas_fact_source_row_id", table_name="cobranzas_fact")
        except Exception:
            pass

        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_cobranzas_fact_business_key "
            "ON cobranzas_fact (contract_id, payment_date, payment_amount, payment_via_class)"
        )

        columns = {c.get("name") for c in inspector.get_columns("cobranzas_fact")}
        if "source_row_id" in columns:
            op.drop_column("cobranzas_fact", "source_row_id")
