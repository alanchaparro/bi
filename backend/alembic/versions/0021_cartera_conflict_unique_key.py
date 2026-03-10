"""cartera_fact conflict key aligned for partition-safe upsert

Revision ID: 0021_cartera_conflict_key
Revises: 0020_freshness_idx
Create Date: 2026-03-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_cartera_conflict_key"
down_revision = "0020_freshness_idx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Partitioned-by-expression parents don't support UNIQUE indexes for this key.
        # Keep migration idempotent and non-failing in those setups.
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    BEGIN
                        CREATE UNIQUE INDEX IF NOT EXISTS ux_cartera_fact_contract_close_gestion
                        ON cartera_fact (contract_id, close_date, gestion_month);
                    EXCEPTION
                        WHEN feature_not_supported THEN
                            NULL;
                    END;
                END$$;
                """
            )
        )
        op.execute(sa.text("ANALYZE cartera_fact"))
    else:
        op.create_index(
            "ux_cartera_fact_contract_close_gestion",
            "cartera_fact",
            ["contract_id", "close_date", "gestion_month"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("DROP INDEX IF EXISTS ux_cartera_fact_contract_close_gestion"))
    else:
        op.drop_index("ux_cartera_fact_contract_close_gestion", table_name="cartera_fact")
