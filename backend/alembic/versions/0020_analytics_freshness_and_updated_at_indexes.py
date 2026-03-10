"""analytics freshness table and updated_at descending indexes

Revision ID: 0020_analytics_freshness_and_updated_at_indexes
Revises: 0019_dwh_dims_and_options
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_freshness_idx"
down_revision = "0019_dwh_dims_and_options"
branch_labels = None
depends_on = None


def _create_desc_index_if_needed(table: str, index_name: str) -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} (updated_at DESC)"))
    else:
        op.create_index(index_name, table, ["updated_at"])


def _drop_index_if_exists(table: str, index_name: str) -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text(f"DROP INDEX IF EXISTS {index_name}"))
    else:
        op.drop_index(index_name, table_name=table)


def upgrade() -> None:
    op.create_table(
        "analytics_source_freshness",
        sa.Column("source_table", sa.String(length=64), nullable=False),
        sa.Column("max_updated_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("last_job_id", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("source_table"),
    )
    op.create_index("ix_analytics_source_freshness_updated_at", "analytics_source_freshness", ["updated_at"])
    op.create_index("ix_analytics_source_freshness_last_job_id", "analytics_source_freshness", ["last_job_id"])

    _create_desc_index_if_needed("cartera_fact", "ix_cartera_fact_updated_at_desc")
    _create_desc_index_if_needed("cobranzas_fact", "ix_cobranzas_fact_updated_at_desc")
    _create_desc_index_if_needed("cartera_corte_agg", "ix_cartera_corte_agg_updated_at_desc")
    _create_desc_index_if_needed("cobranzas_cohorte_agg", "ix_cobranzas_cohorte_agg_updated_at_desc")

    # Default canonical mapping policy: keep ODONTOLOGIA TTO separated from ODONTOLOGIA.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                """
                INSERT INTO dim_negocio_un_map
                    (source_un, canonical_un, mapping_version, is_active, active_from, active_to, updated_at)
                VALUES
                    ('ODONTOLOGIA', 'ODONTOLOGIA', 'v1', true, NOW(), NULL, NOW()),
                    ('ODONTOLOGIA TTO', 'ODONTOLOGIA TTO', 'v1', true, NOW(), NULL, NOW())
                ON CONFLICT (source_un, mapping_version)
                DO UPDATE SET
                    canonical_un = EXCLUDED.canonical_un,
                    is_active = true,
                    active_to = NULL,
                    updated_at = NOW()
                """
            )
        )
    else:
        op.execute(
            sa.text(
                """
                INSERT OR REPLACE INTO dim_negocio_un_map
                    (source_un, canonical_un, mapping_version, is_active, active_from, active_to, updated_at)
                VALUES
                    ('ODONTOLOGIA', 'ODONTOLOGIA', 'v1', 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP),
                    ('ODONTOLOGIA TTO', 'ODONTOLOGIA TTO', 'v1', 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
                """
            )
        )

    # Keep planner stats fresh after new indexes on high-volume tables.
    op.execute(sa.text("ANALYZE cartera_fact"))
    op.execute(sa.text("ANALYZE cobranzas_fact"))
    op.execute(sa.text("ANALYZE cartera_corte_agg"))
    op.execute(sa.text("ANALYZE cobranzas_cohorte_agg"))


def downgrade() -> None:
    _drop_index_if_exists("cobranzas_cohorte_agg", "ix_cobranzas_cohorte_agg_updated_at_desc")
    _drop_index_if_exists("cartera_corte_agg", "ix_cartera_corte_agg_updated_at_desc")
    _drop_index_if_exists("cobranzas_fact", "ix_cobranzas_fact_updated_at_desc")
    _drop_index_if_exists("cartera_fact", "ix_cartera_fact_updated_at_desc")
    op.drop_index("ix_analytics_source_freshness_last_job_id", table_name="analytics_source_freshness")
    op.drop_index("ix_analytics_source_freshness_updated_at", table_name="analytics_source_freshness")
    op.drop_table("analytics_source_freshness")
