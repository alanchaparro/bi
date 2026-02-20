"""cartera corte aggregate and typed cobranzas fields

Revision ID: 0007_corte_agg
Revises: 0006_fact_tables_sync_metrics
Create Date: 2026-02-19
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_corte_agg"
down_revision = "0006_fact_tables_sync_metrics"
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind is not None and bind.dialect.name == "postgresql"


def _upgrade_postgres() -> None:
    op.execute("ALTER TABLE cobranzas_fact ADD COLUMN IF NOT EXISTS payment_date DATE")
    op.execute("ALTER TABLE cobranzas_fact ADD COLUMN IF NOT EXISTS payment_month VARCHAR(7)")
    op.execute("ALTER TABLE cobranzas_fact ADD COLUMN IF NOT EXISTS payment_year INTEGER")
    op.execute("ALTER TABLE cobranzas_fact ADD COLUMN IF NOT EXISTS payment_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE cobranzas_fact ADD COLUMN IF NOT EXISTS payment_via_class VARCHAR(16) NOT NULL DEFAULT 'COBRADOR'")

    # Backfill existing rows with safe defaults.
    op.execute(
        """
        UPDATE cobranzas_fact
        SET payment_month = COALESCE(NULLIF(payment_month, ''), gestion_month)
        WHERE payment_month IS NULL OR payment_month = ''
        """
    )
    op.execute(
        """
        UPDATE cobranzas_fact
        SET payment_year = CAST(RIGHT(payment_month, 4) AS INTEGER)
        WHERE payment_year IS NULL AND payment_month ~ '^[0-1][0-9]/[0-9]{4}$'
        """
    )
    op.execute(
        """
        UPDATE cobranzas_fact
        SET payment_date = TO_DATE('01/' || payment_month, 'DD/MM/YYYY')
        WHERE payment_date IS NULL AND payment_month ~ '^[0-1][0-9]/[0-9]{4}$'
        """
    )
    op.execute("UPDATE cobranzas_fact SET payment_year = COALESCE(payment_year, 2000)")
    op.execute("UPDATE cobranzas_fact SET payment_date = COALESCE(payment_date, DATE '2000-01-01')")

    op.execute("ALTER TABLE cobranzas_fact ALTER COLUMN payment_date SET NOT NULL")
    op.execute("ALTER TABLE cobranzas_fact ALTER COLUMN payment_month SET NOT NULL")
    op.execute("ALTER TABLE cobranzas_fact ALTER COLUMN payment_year SET NOT NULL")

    op.execute("DROP INDEX IF EXISTS ux_cobranzas_fact_business_key")
    op.execute(
        """
        WITH ranked AS (
            SELECT
                ctid,
                ROW_NUMBER() OVER (
                    PARTITION BY contract_id, payment_date, payment_amount, payment_via_class
                    ORDER BY updated_at DESC NULLS LAST, id DESC
                ) AS rn
            FROM cobranzas_fact
        )
        DELETE FROM cobranzas_fact t
        USING ranked r
        WHERE t.ctid = r.ctid
          AND r.rn > 1
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_cobranzas_fact_business_key
        ON cobranzas_fact (contract_id, payment_date, payment_amount, payment_via_class)
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_cobranzas_fact_payment_month ON cobranzas_fact (payment_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cobranzas_fact_payment_year ON cobranzas_fact (payment_year)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cobranzas_fact_payment_month_un ON cobranzas_fact (payment_month, un)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS cartera_corte_agg (
            id BIGSERIAL PRIMARY KEY,
            gestion_month VARCHAR(7) NOT NULL,
            close_month VARCHAR(7) NOT NULL,
            close_year INTEGER NOT NULL,
            contract_year INTEGER NOT NULL DEFAULT 0,
            un VARCHAR(128) NOT NULL DEFAULT 'S/D',
            supervisor VARCHAR(128) NOT NULL DEFAULT 'S/D',
            via_cobro VARCHAR(32) NOT NULL DEFAULT 'S/D',
            categoria VARCHAR(16) NOT NULL DEFAULT 'VIGENTE',
            tramo INTEGER NOT NULL DEFAULT 0,
            contracts_total INTEGER NOT NULL DEFAULT 0,
            vigentes_total INTEGER NOT NULL DEFAULT 0,
            morosos_total INTEGER NOT NULL DEFAULT 0,
            monto_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            monto_vencido_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            contracts_cobrador INTEGER NOT NULL DEFAULT 0,
            contracts_debito INTEGER NOT NULL DEFAULT 0,
            paid_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            paid_via_cobrador DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            paid_via_debito DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            contracts_paid_total INTEGER NOT NULL DEFAULT 0,
            contracts_paid_via_cobrador INTEGER NOT NULL DEFAULT 0,
            contracts_paid_via_debito INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_cartera_corte_agg_key
        ON cartera_corte_agg
        (gestion_month, close_month, un, supervisor, via_cobro, categoria, tramo, contract_year)
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_corte_agg_gestion_un ON cartera_corte_agg (gestion_month, un)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cartera_corte_agg_gestion_supervisor ON cartera_corte_agg (gestion_month, supervisor)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_corte_agg_gestion_via ON cartera_corte_agg (gestion_month, via_cobro)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cartera_corte_agg_gestion_categoria_tramo ON cartera_corte_agg (gestion_month, categoria, tramo)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_corte_agg_close_un_tramo ON cartera_corte_agg (close_month, un, tramo)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_corte_agg_contract_year ON cartera_corte_agg (contract_year)")


def _upgrade_sqlite() -> None:
    op.add_column("cobranzas_fact", sa.Column("payment_date", sa.Date(), nullable=True))
    op.add_column("cobranzas_fact", sa.Column("payment_month", sa.String(length=7), nullable=True))
    op.add_column("cobranzas_fact", sa.Column("payment_year", sa.Integer(), nullable=True))
    op.add_column("cobranzas_fact", sa.Column("payment_amount", sa.Float(), nullable=False, server_default="0"))
    op.add_column(
        "cobranzas_fact", sa.Column("payment_via_class", sa.String(length=16), nullable=False, server_default="COBRADOR")
    )
    op.create_index("ix_cobranzas_fact_payment_month", "cobranzas_fact", ["payment_month"])
    op.create_index("ix_cobranzas_fact_payment_year", "cobranzas_fact", ["payment_year"])
    op.create_index("ix_cobranzas_fact_payment_month_un", "cobranzas_fact", ["payment_month", "un"])

    op.create_table(
        "cartera_corte_agg",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gestion_month", sa.String(length=7), nullable=False),
        sa.Column("close_month", sa.String(length=7), nullable=False),
        sa.Column("close_year", sa.Integer(), nullable=False),
        sa.Column("contract_year", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("un", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("supervisor", sa.String(length=128), nullable=False, server_default="S/D"),
        sa.Column("via_cobro", sa.String(length=32), nullable=False, server_default="S/D"),
        sa.Column("categoria", sa.String(length=16), nullable=False, server_default="VIGENTE"),
        sa.Column("tramo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contracts_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("vigentes_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("morosos_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("monto_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("monto_vencido_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("contracts_cobrador", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contracts_debito", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paid_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_via_cobrador", sa.Float(), nullable=False, server_default="0"),
        sa.Column("paid_via_debito", sa.Float(), nullable=False, server_default="0"),
        sa.Column("contracts_paid_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contracts_paid_via_cobrador", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contracts_paid_via_debito", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ux_cartera_corte_agg_key",
        "cartera_corte_agg",
        ["gestion_month", "close_month", "un", "supervisor", "via_cobro", "categoria", "tramo", "contract_year"],
        unique=True,
    )
    op.create_index("ix_cartera_corte_agg_gestion_un", "cartera_corte_agg", ["gestion_month", "un"])
    op.create_index("ix_cartera_corte_agg_gestion_supervisor", "cartera_corte_agg", ["gestion_month", "supervisor"])
    op.create_index("ix_cartera_corte_agg_gestion_via", "cartera_corte_agg", ["gestion_month", "via_cobro"])
    op.create_index(
        "ix_cartera_corte_agg_gestion_categoria_tramo",
        "cartera_corte_agg",
        ["gestion_month", "categoria", "tramo"],
    )
    op.create_index("ix_cartera_corte_agg_close_un_tramo", "cartera_corte_agg", ["close_month", "un", "tramo"])
    op.create_index("ix_cartera_corte_agg_contract_year", "cartera_corte_agg", ["contract_year"])


def upgrade() -> None:
    if _is_postgres():
        _upgrade_postgres()
    else:
        _upgrade_sqlite()


def downgrade() -> None:
    op.drop_index("ix_cartera_corte_agg_contract_year", table_name="cartera_corte_agg")
    op.drop_index("ix_cartera_corte_agg_close_un_tramo", table_name="cartera_corte_agg")
    op.drop_index("ix_cartera_corte_agg_gestion_categoria_tramo", table_name="cartera_corte_agg")
    op.drop_index("ix_cartera_corte_agg_gestion_via", table_name="cartera_corte_agg")
    op.drop_index("ix_cartera_corte_agg_gestion_supervisor", table_name="cartera_corte_agg")
    op.drop_index("ix_cartera_corte_agg_gestion_un", table_name="cartera_corte_agg")
    op.drop_index("ux_cartera_corte_agg_key", table_name="cartera_corte_agg")
    op.drop_table("cartera_corte_agg")

    op.drop_index("ix_cobranzas_fact_payment_month_un", table_name="cobranzas_fact")
    op.drop_index("ix_cobranzas_fact_payment_year", table_name="cobranzas_fact")
    op.drop_index("ix_cobranzas_fact_payment_month", table_name="cobranzas_fact")
    op.drop_index("ux_cobranzas_fact_business_key", table_name="cobranzas_fact")
    op.create_index(
        "ux_cobranzas_fact_business_key",
        "cobranzas_fact",
        ["contract_id", "gestion_month", "supervisor", "un", "via", "tramo"],
        unique=True,
    )
    op.drop_column("cobranzas_fact", "payment_via_class")
    op.drop_column("cobranzas_fact", "payment_amount")
    op.drop_column("cobranzas_fact", "payment_year")
    op.drop_column("cobranzas_fact", "payment_month")
    op.drop_column("cobranzas_fact", "payment_date")
