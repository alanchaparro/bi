"""dwh semantic dimensions and options tables

Revision ID: 0019_dwh_dims_and_options
Revises: 0018_frontend_perf_metrics
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_dwh_dims_and_options"
down_revision = "0018_frontend_perf_metrics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cartera_fact", sa.Column("contract_date", sa.Date(), nullable=True))
    op.add_column("cartera_fact", sa.Column("contract_month", sa.String(length=7), nullable=False, server_default=""))
    op.add_column("cartera_fact", sa.Column("culm_date", sa.Date(), nullable=True))
    op.add_column("cartera_fact", sa.Column("culm_month", sa.String(length=7), nullable=False, server_default=""))
    op.add_column("cartera_fact", sa.Column("cuota_amount", sa.Float(), nullable=False, server_default="0"))
    op.create_index("ix_cartera_fact_contract_date", "cartera_fact", ["contract_date"])
    op.create_index("ix_cartera_fact_contract_month", "cartera_fact", ["contract_month"])
    op.create_index("ix_cartera_fact_culm_date", "cartera_fact", ["culm_date"])
    op.create_index("ix_cartera_fact_culm_month", "cartera_fact", ["culm_month"])
    op.create_index(
        "ix_cartera_fact_gestion_un_supervisor_tramo",
        "cartera_fact",
        ["gestion_month", "un", "supervisor", "tramo"],
    )
    op.create_index(
        "ix_cartera_fact_gestion_close_contract",
        "cartera_fact",
        ["gestion_month", "close_month", "contract_id"],
    )
    op.create_index(
        "ix_cobranzas_fact_payment_month_contract_via",
        "cobranzas_fact",
        ["payment_month", "contract_id", "payment_via_class"],
    )

    op.create_table(
        "dim_time",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("month_key", sa.String(length=7), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("quarter", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("month_name", sa.String(length=16), nullable=False, server_default=""),
        sa.Column("sort_key", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("month_key"),
    )
    op.create_index("ix_dim_time_year", "dim_time", ["year"])
    op.create_index("ix_dim_time_quarter", "dim_time", ["quarter"])
    op.create_index("ix_dim_time_month", "dim_time", ["month"])
    op.create_index("ix_dim_time_sort_key", "dim_time", ["sort_key"])

    op.create_table(
        "dim_un",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("un_raw", sa.String(length=128), nullable=False),
        sa.Column("un_canonica", sa.String(length=128), nullable=False),
        sa.Column("mapping_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_un_un_raw", "dim_un", ["un_raw"])
    op.create_index("ix_dim_un_un_canonica", "dim_un", ["un_canonica"])
    op.create_index("ix_dim_un_is_active", "dim_un", ["is_active"])
    op.create_index("ux_dim_un_key", "dim_un", ["un_raw", "mapping_version"], unique=True)

    op.create_table(
        "dim_supervisor",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("supervisor_raw", sa.String(length=128), nullable=False),
        sa.Column("supervisor_canonico", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_supervisor_supervisor_raw", "dim_supervisor", ["supervisor_raw"])
    op.create_index("ix_dim_supervisor_supervisor_canonico", "dim_supervisor", ["supervisor_canonico"])
    op.create_index("ix_dim_supervisor_is_active", "dim_supervisor", ["is_active"])
    op.create_index("ux_dim_supervisor_key", "dim_supervisor", ["supervisor_raw"], unique=True)

    op.create_table(
        "dim_via",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("via_raw", sa.String(length=32), nullable=False),
        sa.Column("via_canonica", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_via_via_raw", "dim_via", ["via_raw"])
    op.create_index("ix_dim_via_via_canonica", "dim_via", ["via_canonica"])
    op.create_index("ix_dim_via_is_active", "dim_via", ["is_active"])
    op.create_index("ux_dim_via_key", "dim_via", ["via_raw"], unique=True)

    op.create_table(
        "dim_categoria",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("categoria_raw", sa.String(length=16), nullable=False),
        sa.Column("categoria_canonica", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_categoria_categoria_raw", "dim_categoria", ["categoria_raw"])
    op.create_index("ix_dim_categoria_categoria_canonica", "dim_categoria", ["categoria_canonica"])
    op.create_index("ix_dim_categoria_is_active", "dim_categoria", ["is_active"])
    op.create_index("ux_dim_categoria_key", "dim_categoria", ["categoria_raw"], unique=True)

    op.create_table(
        "dim_contract_month",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contract_id", sa.String(length=64), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("sale_month", sa.String(length=7), nullable=False, server_default=""),
        sa.Column("sale_year", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("un_canonica", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor_canonico", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_canonica", sa.String(length=32), nullable=False, server_default="DEBITO"),
        sa.Column("categoria_canonica", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("tramo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dim_contract_month_contract_id", "dim_contract_month", ["contract_id"])
    op.create_index("ix_dim_contract_month_gestion_month", "dim_contract_month", ["gestion_month"])
    op.create_index("ix_dim_contract_month_sale_month", "dim_contract_month", ["sale_month"])
    op.create_index("ix_dim_contract_month_sale_year", "dim_contract_month", ["sale_year"])
    op.create_index("ix_dim_contract_month_un_canonica", "dim_contract_month", ["un_canonica"])
    op.create_index("ix_dim_contract_month_supervisor_canonico", "dim_contract_month", ["supervisor_canonico"])
    op.create_index("ix_dim_contract_month_via_canonica", "dim_contract_month", ["via_canonica"])
    op.create_index("ix_dim_contract_month_categoria_canonica", "dim_contract_month", ["categoria_canonica"])
    op.create_index("ix_dim_contract_month_tramo", "dim_contract_month", ["tramo"])
    op.create_index("ux_dim_contract_month_key", "dim_contract_month", ["contract_id", "gestion_month"], unique=True)

    op.create_table(
        "mv_options_cartera",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("close_month", sa.String(length=7), nullable=False),
        sa.Column("contract_year", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_cobro", sa.String(length=32), nullable=False, server_default="DEBITO"),
        sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("tramo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mv_options_cartera_gestion_month", "mv_options_cartera", ["gestion_month"])
    op.create_index("ix_mv_options_cartera_close_month", "mv_options_cartera", ["close_month"])
    op.create_index("ix_mv_options_cartera_contract_year", "mv_options_cartera", ["contract_year"])
    op.create_index("ix_mv_options_cartera_un", "mv_options_cartera", ["un"])
    op.create_index("ix_mv_options_cartera_supervisor", "mv_options_cartera", ["supervisor"])
    op.create_index("ix_mv_options_cartera_via_cobro", "mv_options_cartera", ["via_cobro"])
    op.create_index("ix_mv_options_cartera_categoria", "mv_options_cartera", ["categoria"])
    op.create_index("ix_mv_options_cartera_tramo", "mv_options_cartera", ["tramo"])
    op.create_index(
        "ux_mv_options_cartera_key",
        "mv_options_cartera",
        ["gestion_month", "close_month", "un", "supervisor", "via_cobro", "categoria", "tramo", "contract_year"],
        unique=True,
    )

    op.create_table(
        "mv_options_cohorte",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cutoff_month", sa.String(length=7), nullable=False),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_cobro", sa.String(length=32), nullable=False, server_default="DEBITO"),
        sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mv_options_cohorte_cutoff_month", "mv_options_cohorte", ["cutoff_month"])
    op.create_index("ix_mv_options_cohorte_un", "mv_options_cohorte", ["un"])
    op.create_index("ix_mv_options_cohorte_supervisor", "mv_options_cohorte", ["supervisor"])
    op.create_index("ix_mv_options_cohorte_via_cobro", "mv_options_cohorte", ["via_cobro"])
    op.create_index("ix_mv_options_cohorte_categoria", "mv_options_cohorte", ["categoria"])
    op.create_index(
        "ux_mv_options_cohorte_key",
        "mv_options_cohorte",
        ["cutoff_month", "un", "supervisor", "via_cobro", "categoria"],
        unique=True,
    )

    op.create_table(
        "mv_options_rendimiento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_cobro", sa.String(length=32), nullable=False, server_default="DEBITO"),
        sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("tramo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mv_options_rendimiento_gestion_month", "mv_options_rendimiento", ["gestion_month"])
    op.create_index("ix_mv_options_rendimiento_un", "mv_options_rendimiento", ["un"])
    op.create_index("ix_mv_options_rendimiento_supervisor", "mv_options_rendimiento", ["supervisor"])
    op.create_index("ix_mv_options_rendimiento_via_cobro", "mv_options_rendimiento", ["via_cobro"])
    op.create_index("ix_mv_options_rendimiento_categoria", "mv_options_rendimiento", ["categoria"])
    op.create_index("ix_mv_options_rendimiento_tramo", "mv_options_rendimiento", ["tramo"])
    op.create_index(
        "ux_mv_options_rendimiento_key",
        "mv_options_rendimiento",
        ["gestion_month", "un", "supervisor", "via_cobro", "categoria", "tramo"],
        unique=True,
    )

    op.create_table(
        "mv_options_anuales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cutoff_month", sa.String(length=7), nullable=False),
        sa.Column("sale_month", sa.String(length=7), nullable=False),
        sa.Column("sale_year", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mv_options_anuales_cutoff_month", "mv_options_anuales", ["cutoff_month"])
    op.create_index("ix_mv_options_anuales_sale_month", "mv_options_anuales", ["sale_month"])
    op.create_index("ix_mv_options_anuales_sale_year", "mv_options_anuales", ["sale_year"])
    op.create_index("ix_mv_options_anuales_un", "mv_options_anuales", ["un"])
    op.create_index(
        "ux_mv_options_anuales_key",
        "mv_options_anuales",
        ["cutoff_month", "sale_month", "sale_year", "un"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_mv_options_anuales_key", table_name="mv_options_anuales")
    op.drop_index("ix_mv_options_anuales_un", table_name="mv_options_anuales")
    op.drop_index("ix_mv_options_anuales_sale_year", table_name="mv_options_anuales")
    op.drop_index("ix_mv_options_anuales_sale_month", table_name="mv_options_anuales")
    op.drop_index("ix_mv_options_anuales_cutoff_month", table_name="mv_options_anuales")
    op.drop_table("mv_options_anuales")

    op.drop_index("ux_mv_options_rendimiento_key", table_name="mv_options_rendimiento")
    op.drop_index("ix_mv_options_rendimiento_tramo", table_name="mv_options_rendimiento")
    op.drop_index("ix_mv_options_rendimiento_categoria", table_name="mv_options_rendimiento")
    op.drop_index("ix_mv_options_rendimiento_via_cobro", table_name="mv_options_rendimiento")
    op.drop_index("ix_mv_options_rendimiento_supervisor", table_name="mv_options_rendimiento")
    op.drop_index("ix_mv_options_rendimiento_un", table_name="mv_options_rendimiento")
    op.drop_index("ix_mv_options_rendimiento_gestion_month", table_name="mv_options_rendimiento")
    op.drop_table("mv_options_rendimiento")

    op.drop_index("ux_mv_options_cohorte_key", table_name="mv_options_cohorte")
    op.drop_index("ix_mv_options_cohorte_categoria", table_name="mv_options_cohorte")
    op.drop_index("ix_mv_options_cohorte_via_cobro", table_name="mv_options_cohorte")
    op.drop_index("ix_mv_options_cohorte_supervisor", table_name="mv_options_cohorte")
    op.drop_index("ix_mv_options_cohorte_un", table_name="mv_options_cohorte")
    op.drop_index("ix_mv_options_cohorte_cutoff_month", table_name="mv_options_cohorte")
    op.drop_table("mv_options_cohorte")

    op.drop_index("ux_mv_options_cartera_key", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_tramo", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_categoria", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_via_cobro", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_supervisor", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_un", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_contract_year", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_close_month", table_name="mv_options_cartera")
    op.drop_index("ix_mv_options_cartera_gestion_month", table_name="mv_options_cartera")
    op.drop_table("mv_options_cartera")

    op.drop_index("ux_dim_contract_month_key", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_tramo", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_categoria_canonica", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_via_canonica", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_supervisor_canonico", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_un_canonica", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_sale_year", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_sale_month", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_gestion_month", table_name="dim_contract_month")
    op.drop_index("ix_dim_contract_month_contract_id", table_name="dim_contract_month")
    op.drop_table("dim_contract_month")

    op.drop_index("ux_dim_categoria_key", table_name="dim_categoria")
    op.drop_index("ix_dim_categoria_is_active", table_name="dim_categoria")
    op.drop_index("ix_dim_categoria_categoria_canonica", table_name="dim_categoria")
    op.drop_index("ix_dim_categoria_categoria_raw", table_name="dim_categoria")
    op.drop_table("dim_categoria")

    op.drop_index("ux_dim_via_key", table_name="dim_via")
    op.drop_index("ix_dim_via_is_active", table_name="dim_via")
    op.drop_index("ix_dim_via_via_canonica", table_name="dim_via")
    op.drop_index("ix_dim_via_via_raw", table_name="dim_via")
    op.drop_table("dim_via")

    op.drop_index("ux_dim_supervisor_key", table_name="dim_supervisor")
    op.drop_index("ix_dim_supervisor_is_active", table_name="dim_supervisor")
    op.drop_index("ix_dim_supervisor_supervisor_canonico", table_name="dim_supervisor")
    op.drop_index("ix_dim_supervisor_supervisor_raw", table_name="dim_supervisor")
    op.drop_table("dim_supervisor")

    op.drop_index("ux_dim_un_key", table_name="dim_un")
    op.drop_index("ix_dim_un_is_active", table_name="dim_un")
    op.drop_index("ix_dim_un_un_canonica", table_name="dim_un")
    op.drop_index("ix_dim_un_un_raw", table_name="dim_un")
    op.drop_table("dim_un")

    op.drop_index("ix_dim_time_sort_key", table_name="dim_time")
    op.drop_index("ix_dim_time_month", table_name="dim_time")
    op.drop_index("ix_dim_time_quarter", table_name="dim_time")
    op.drop_index("ix_dim_time_year", table_name="dim_time")
    op.drop_table("dim_time")

    op.drop_index("ix_cobranzas_fact_payment_month_contract_via", table_name="cobranzas_fact")
    op.drop_index("ix_cartera_fact_gestion_close_contract", table_name="cartera_fact")
    op.drop_index("ix_cartera_fact_gestion_un_supervisor_tramo", table_name="cartera_fact")
    op.drop_index("ix_cartera_fact_culm_month", table_name="cartera_fact")
    op.drop_index("ix_cartera_fact_culm_date", table_name="cartera_fact")
    op.drop_index("ix_cartera_fact_contract_month", table_name="cartera_fact")
    op.drop_index("ix_cartera_fact_contract_date", table_name="cartera_fact")
    op.drop_column("cartera_fact", "cuota_amount")
    op.drop_column("cartera_fact", "culm_month")
    op.drop_column("cartera_fact", "culm_date")
    op.drop_column("cartera_fact", "contract_month")
    op.drop_column("cartera_fact", "contract_date")
