"""enable pg_stat_statements and preaggregate cohorte table

Revision ID: 0010_pgstats_and_cohorte_agg
Revises: 0009_sync_jobs_queue
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_pgstats_and_cohorte_agg"
down_revision = "0009_sync_jobs_queue"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind is not None and bind.dialect.name == "postgresql"


def upgrade() -> None:
    if _is_postgres():
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("cobranzas_cohorte_agg"):
        op.create_table(
            "cobranzas_cohorte_agg",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("cutoff_month", sa.String(length=7), nullable=False),
            sa.Column("sale_month", sa.String(length=7), nullable=False),
            sa.Column("sale_year", sa.Integer(), nullable=False),
            sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
            sa.Column("supervisor", sa.String(length=128), nullable=False, server_default="S/D"),
            sa.Column("via_cobro", sa.String(length=32), nullable=False, server_default="S/D"),
            sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
            sa.Column("activos", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("pagaron", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("deberia", sa.Float(), nullable=False, server_default="0"),
            sa.Column("cobrado", sa.Float(), nullable=False, server_default="0"),
            sa.Column("transacciones", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_cobranzas_cohorte_agg_key "
        "ON cobranzas_cohorte_agg (cutoff_month, sale_month, un, supervisor, via_cobro, categoria)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cobranzas_cohorte_agg_cutoff_un "
        "ON cobranzas_cohorte_agg (cutoff_month, un)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cobranzas_cohorte_agg_cutoff_supervisor "
        "ON cobranzas_cohorte_agg (cutoff_month, supervisor)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cobranzas_cohorte_agg_cutoff_via "
        "ON cobranzas_cohorte_agg (cutoff_month, via_cobro)"
    )


def downgrade() -> None:
    op.drop_index("ix_cobranzas_cohorte_agg_cutoff_via", table_name="cobranzas_cohorte_agg")
    op.drop_index("ix_cobranzas_cohorte_agg_cutoff_supervisor", table_name="cobranzas_cohorte_agg")
    op.drop_index("ix_cobranzas_cohorte_agg_cutoff_un", table_name="cobranzas_cohorte_agg")
    op.drop_index("ux_cobranzas_cohorte_agg_key", table_name="cobranzas_cohorte_agg")
    op.drop_table("cobranzas_cohorte_agg")
