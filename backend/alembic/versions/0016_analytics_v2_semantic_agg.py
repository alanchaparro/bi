"""analytics v2 semantic dimension and agg tables

Revision ID: 0016_analytics_v2_semantic_agg
Revises: 0015_cobranzas_source_row_id
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_analytics_v2_semantic_agg"
down_revision = "0015_cobranzas_source_row_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dim_negocio_un_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_un", sa.String(length=128), nullable=False),
        sa.Column("canonical_un", sa.String(length=128), nullable=False),
        sa.Column("mapping_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("active_from", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("active_to", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_negocio_un_map_source_un", "dim_negocio_un_map", ["source_un"])
    op.create_index("ix_dim_negocio_un_map_canonical_un", "dim_negocio_un_map", ["canonical_un"])
    op.create_index("ix_dim_negocio_un_map_active", "dim_negocio_un_map", ["is_active", "active_from"])
    op.create_index(
        "ux_dim_negocio_un_map_key",
        "dim_negocio_un_map",
        ["source_un", "mapping_version"],
        unique=True,
    )

    op.create_table(
        "dim_negocio_contrato",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.String(length=64), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("un_raw", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor_raw", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_raw", sa.String(length=32), nullable=False, server_default="S/D"),
        sa.Column("tramo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("un_canonica", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor_canonico", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_canonica", sa.String(length=32), nullable=False, server_default="DEBITO"),
        sa.Column("categoria_canonica", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("mapping_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_negocio_contrato_contract_id", "dim_negocio_contrato", ["contract_id"])
    op.create_index("ix_dim_negocio_contrato_gestion_month", "dim_negocio_contrato", ["gestion_month"])
    op.create_index("ix_dim_negocio_contrato_un_canonica", "dim_negocio_contrato", ["un_canonica"])
    op.create_index(
        "ix_dim_negocio_contrato_supervisor_canonico",
        "dim_negocio_contrato",
        ["supervisor_canonico"],
    )
    op.create_index("ix_dim_negocio_contrato_via_canonica", "dim_negocio_contrato", ["via_canonica"])
    op.create_index(
        "ix_dim_negocio_contrato_categoria_canonica",
        "dim_negocio_contrato",
        ["categoria_canonica"],
    )
    op.create_index(
        "ux_dim_negocio_contrato_key",
        "dim_negocio_contrato",
        ["contract_id", "gestion_month"],
        unique=True,
    )
    op.create_index(
        "ix_dim_negocio_contrato_gestion_un",
        "dim_negocio_contrato",
        ["gestion_month", "un_canonica"],
    )
    op.create_index(
        "ix_dim_negocio_contrato_gestion_supervisor",
        "dim_negocio_contrato",
        ["gestion_month", "supervisor_canonico"],
    )

    op.create_table(
        "analytics_rendimiento_agg",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_cobro", sa.String(length=32), nullable=False, server_default="DEBITO"),
        sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("tramo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("debt_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_via_cobrador", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_via_debito", sa.Float(), nullable=False, server_default="0"),
        sa.Column("contracts_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contracts_paid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_rendimiento_agg_gestion_month", "analytics_rendimiento_agg", ["gestion_month"])
    op.create_index("ix_analytics_rendimiento_agg_gestion_un", "analytics_rendimiento_agg", ["gestion_month", "un"])
    op.create_index(
        "ix_analytics_rendimiento_agg_gestion_supervisor",
        "analytics_rendimiento_agg",
        ["gestion_month", "supervisor"],
    )
    op.create_index(
        "ux_analytics_rendimiento_agg_key",
        "analytics_rendimiento_agg",
        ["gestion_month", "un", "supervisor", "via_cobro", "categoria", "tramo"],
        unique=True,
    )

    op.create_table(
        "analytics_anuales_agg",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cutoff_month", sa.String(length=7), nullable=False),
        sa.Column("sale_year", sa.Integer(), nullable=False),
        sa.Column("sale_month", sa.String(length=7), nullable=False),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("contracts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contracts_vigentes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cuota_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_to_cutoff_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tx_to_cutoff_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paid_by_contract_month_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_by_contract_month_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("culminados", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("culminados_vigentes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cuota_cul_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cuota_cul_total_vigente", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_by_contract_month_cul_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_by_contract_month_cul_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paid_by_contract_month_cul_total_vigente", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_by_contract_month_cul_count_vigente", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cobrado_cul_vigente", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_deberia_cul_vigente", sa.Float(), nullable=False, server_default="0"),
        sa.Column("months_weighted_numerator_cul_vigente", sa.Float(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_anuales_agg_cutoff_month", "analytics_anuales_agg", ["cutoff_month"])
    op.create_index("ix_analytics_anuales_agg_sale_month", "analytics_anuales_agg", ["sale_month"])
    op.create_index("ix_analytics_anuales_agg_cutoff_un", "analytics_anuales_agg", ["cutoff_month", "un"])
    op.create_index("ix_analytics_anuales_agg_cutoff_year", "analytics_anuales_agg", ["cutoff_month", "sale_year"])
    op.create_index(
        "ux_analytics_anuales_agg_key",
        "analytics_anuales_agg",
        ["cutoff_month", "sale_year", "sale_month", "un"],
        unique=True,
    )

    op.execute(
        "INSERT INTO dim_negocio_un_map (source_un, canonical_un, mapping_version, is_active) "
        "SELECT 'ODONTOLOGIA TTO', 'ODONTOLOGIA', 'v1', true "
        "WHERE NOT EXISTS ("
        "SELECT 1 FROM dim_negocio_un_map WHERE source_un='ODONTOLOGIA TTO' AND mapping_version='v1'"
        ")"
    )


def downgrade() -> None:
    op.drop_index("ux_analytics_anuales_agg_key", table_name="analytics_anuales_agg")
    op.drop_index("ix_analytics_anuales_agg_cutoff_year", table_name="analytics_anuales_agg")
    op.drop_index("ix_analytics_anuales_agg_cutoff_un", table_name="analytics_anuales_agg")
    op.drop_index("ix_analytics_anuales_agg_sale_month", table_name="analytics_anuales_agg")
    op.drop_index("ix_analytics_anuales_agg_cutoff_month", table_name="analytics_anuales_agg")
    op.drop_table("analytics_anuales_agg")

    op.drop_index("ux_analytics_rendimiento_agg_key", table_name="analytics_rendimiento_agg")
    op.drop_index("ix_analytics_rendimiento_agg_gestion_supervisor", table_name="analytics_rendimiento_agg")
    op.drop_index("ix_analytics_rendimiento_agg_gestion_un", table_name="analytics_rendimiento_agg")
    op.drop_index("ix_analytics_rendimiento_agg_gestion_month", table_name="analytics_rendimiento_agg")
    op.drop_table("analytics_rendimiento_agg")

    op.drop_index("ix_dim_negocio_contrato_gestion_supervisor", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_gestion_un", table_name="dim_negocio_contrato")
    op.drop_index("ux_dim_negocio_contrato_key", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_categoria_canonica", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_via_canonica", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_supervisor_canonico", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_un_canonica", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_gestion_month", table_name="dim_negocio_contrato")
    op.drop_index("ix_dim_negocio_contrato_contract_id", table_name="dim_negocio_contrato")
    op.drop_table("dim_negocio_contrato")

    op.drop_index("ux_dim_negocio_un_map_key", table_name="dim_negocio_un_map")
    op.drop_index("ix_dim_negocio_un_map_active", table_name="dim_negocio_un_map")
    op.drop_index("ix_dim_negocio_un_map_canonical_un", table_name="dim_negocio_un_map")
    op.drop_index("ix_dim_negocio_un_map_source_un", table_name="dim_negocio_un_map")
    op.drop_table("dim_negocio_un_map")
