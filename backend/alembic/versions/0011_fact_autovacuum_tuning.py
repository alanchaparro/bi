"""tune autovacuum for high-write fact tables

Revision ID: 0011_fact_autovacuum_tuning
Revises: 0010_pgstats_and_cohorte_agg
Create Date: 2026-02-23
"""

from alembic import op


revision = "0011_fact_autovacuum_tuning"
down_revision = "0010_pgstats_and_cohorte_agg"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    tables = [
        "sync_records",
        "cartera_fact",
        "cobranzas_fact",
        "analytics_fact",
        "contratos_fact",
        "gestores_fact",
        "cartera_corte_agg",
        "cobranzas_cohorte_agg",
    ]
    for table_name in tables:
        op.execute(
            f"""
            ALTER TABLE {table_name}
            SET (
              autovacuum_vacuum_scale_factor = 0.02,
              autovacuum_analyze_scale_factor = 0.01,
              autovacuum_vacuum_threshold = 5000,
              autovacuum_analyze_threshold = 2500
            )
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    tables = [
        "sync_records",
        "cartera_fact",
        "cobranzas_fact",
        "analytics_fact",
        "contratos_fact",
        "gestores_fact",
        "cartera_corte_agg",
        "cobranzas_cohorte_agg",
    ]
    for table_name in tables:
        op.execute(f"ALTER TABLE {table_name} RESET (autovacuum_vacuum_scale_factor)")
        op.execute(f"ALTER TABLE {table_name} RESET (autovacuum_analyze_scale_factor)")
        op.execute(f"ALTER TABLE {table_name} RESET (autovacuum_vacuum_threshold)")
        op.execute(f"ALTER TABLE {table_name} RESET (autovacuum_analyze_threshold)")
