"""eerr_monthly_agg: agregado mensual por razón social y bloque EERR

Revision ID: 0025_eerr_monthly_agg
Revises: 0024_eerr_fact
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0025_eerr_monthly_agg"
down_revision = "0024_eerr_fact"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "eerr_monthly_agg",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("social_reason_id", sa.Integer(), nullable=False),
        sa.Column("eerr_block", sa.String(length=16), nullable=False),
        sa.Column("empresa", sa.String(length=256), nullable=False, server_default=""),
        sa.Column("debit_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("credit_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("plan_lines", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_eerr_monthly_agg_gestion", "eerr_monthly_agg", ["gestion_month"])
    op.create_index(
        "ix_eerr_monthly_agg_gestion_social",
        "eerr_monthly_agg",
        ["gestion_month", "social_reason_id"],
    )
    op.create_index(
        "ux_eerr_monthly_agg_key",
        "eerr_monthly_agg",
        ["gestion_month", "social_reason_id", "eerr_block"],
        unique=True,
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_eerr_monthly_agg_updated_at_desc "
                "ON eerr_monthly_agg (updated_at DESC)"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("DROP INDEX IF EXISTS ix_eerr_monthly_agg_updated_at_desc"))
    op.drop_index("ux_eerr_monthly_agg_key", table_name="eerr_monthly_agg")
    op.drop_index("ix_eerr_monthly_agg_gestion_social", table_name="eerr_monthly_agg")
    op.drop_index("ix_eerr_monthly_agg_gestion", table_name="eerr_monthly_agg")
    op.drop_table("eerr_monthly_agg")
