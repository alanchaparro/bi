"""eerr_fact: Estado de resultado (EERR) sync desde MySQL contable

Revision ID: 0024_eerr_fact
Revises: 0023_auth_role_nav_eerr
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0024_eerr_fact"
down_revision = "0023_auth_role_nav_eerr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "eerr_fact",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("calendar_year", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("social_reason_id", sa.Integer(), nullable=False),
        sa.Column("accounting_plan_id", sa.Integer(), nullable=False),
        sa.Column("eerr_block", sa.String(length=16), nullable=False),
        sa.Column("empresa", sa.String(length=256), nullable=False, server_default=""),
        sa.Column("group_type", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mayor", sa.String(length=256), nullable=False, server_default=""),
        sa.Column("cuenta", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("debit_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("credit_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("loaded_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_eerr_fact_gestion_month", "eerr_fact", ["gestion_month"])
    op.create_index("ix_eerr_fact_block_gestion", "eerr_fact", ["eerr_block", "gestion_month"])
    op.create_index(
        "ux_eerr_fact_business_key",
        "eerr_fact",
        ["gestion_month", "social_reason_id", "accounting_plan_id", "eerr_block"],
        unique=True,
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_eerr_fact_updated_at_desc ON eerr_fact (updated_at DESC)"))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("DROP INDEX IF EXISTS ix_eerr_fact_updated_at_desc"))
    op.drop_index("ux_eerr_fact_business_key", table_name="eerr_fact")
    op.drop_index("ix_eerr_fact_block_gestion", table_name="eerr_fact")
    op.drop_index("ix_eerr_fact_gestion_month", table_name="eerr_fact")
    op.drop_table("eerr_fact")
