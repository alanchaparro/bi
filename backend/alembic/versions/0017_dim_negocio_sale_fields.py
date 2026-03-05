"""add sale fields to dim_negocio_contrato for fast anuales options

Revision ID: 0017_dim_negocio_sale_fields
Revises: 0016_analytics_v2_semantic_agg
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_dim_negocio_sale_fields"
down_revision = "0016_analytics_v2_semantic_agg"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dim_negocio_contrato", sa.Column("sale_month", sa.String(length=7), nullable=False, server_default=""))
    op.add_column("dim_negocio_contrato", sa.Column("sale_year", sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_dim_negocio_contrato_sale_month", "dim_negocio_contrato", ["sale_month"])
    op.create_index("ix_dim_negocio_contrato_sale_year", "dim_negocio_contrato", ["sale_year"])
    op.create_index(
        "ix_dim_negocio_contrato_sale_month_un",
        "dim_negocio_contrato",
        ["sale_month", "un_canonica"],
    )
    op.create_index(
        "ix_dim_negocio_contrato_sale_year_un",
        "dim_negocio_contrato",
        ["sale_year", "un_canonica"],
    )


def downgrade() -> None:
    op.drop_index("ix_dim_negocio_contrato_sale_year_un", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_sale_month_un", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_sale_year", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_sale_month", table_name="dim_negocio_contrato")
    op.drop_column("dim_negocio_contrato", "sale_year")
    op.drop_column("dim_negocio_contrato", "sale_month")
