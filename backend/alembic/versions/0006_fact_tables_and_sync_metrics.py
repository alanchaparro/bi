"""fact tables and sync metrics

Revision ID: 0006_fact_tables_sync_metrics
Revises: 0005_sync_runs_and_records
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa


revision = '0006_fact_tables_sync_metrics'
down_revision = '0005_sync_runs_and_records'
branch_labels = None
depends_on = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind is not None and bind.dialect.name == 'postgresql'


def _upgrade_postgres() -> None:
    op.execute("ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS close_month VARCHAR(7)")
    op.execute("ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS target_table VARCHAR(64)")
    op.execute("ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS rows_read INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS rows_upserted INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS rows_unchanged INTEGER NOT NULL DEFAULT 0")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS cartera_fact (
            id BIGSERIAL PRIMARY KEY,
            contract_id VARCHAR(64) NOT NULL,
            close_date DATE NOT NULL,
            close_month VARCHAR(7) NOT NULL,
            close_year INTEGER NOT NULL,
            gestion_month VARCHAR(7) NOT NULL,
            supervisor VARCHAR(128) NOT NULL DEFAULT 'S/D',
            un VARCHAR(128) NOT NULL DEFAULT 'S/D',
            via_cobro VARCHAR(32) NOT NULL DEFAULT 'S/D',
            tramo INTEGER NOT NULL DEFAULT 0,
            category VARCHAR(16) NOT NULL DEFAULT 'VIGENTE',
            contracts_total INTEGER NOT NULL DEFAULT 1,
            monto_vencido DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            total_saldo DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            capital_saldo DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            capital_vencido DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            source_hash VARCHAR(64) NOT NULL,
            payload_json TEXT NOT NULL DEFAULT '{}',
            loaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_cartera_fact_contract_close_date ON cartera_fact (contract_id, close_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_close_date ON cartera_fact (close_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_close_month ON cartera_fact (close_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_close_year ON cartera_fact (close_year)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_gestion_month ON cartera_fact (gestion_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_un_close_month ON cartera_fact (un, close_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_supervisor_close_month ON cartera_fact (supervisor, close_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_tramo_close_month ON cartera_fact (tramo, close_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cartera_fact_un_close_month_tramo ON cartera_fact (un, close_month, tramo)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS analytics_fact (
            id BIGSERIAL PRIMARY KEY,
            contract_id VARCHAR(64) NOT NULL,
            gestion_month VARCHAR(7) NOT NULL,
            supervisor VARCHAR(128) NOT NULL DEFAULT 'S/D',
            un VARCHAR(128) NOT NULL DEFAULT 'S/D',
            via VARCHAR(32) NOT NULL DEFAULT 'S/D',
            tramo INTEGER NOT NULL DEFAULT 0,
            contracts_total INTEGER NOT NULL DEFAULT 1,
            debt_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            paid_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            source_hash VARCHAR(64) NOT NULL,
            payload_json TEXT NOT NULL DEFAULT '{}',
            loaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_analytics_fact_business_key ON analytics_fact (contract_id, gestion_month, supervisor, un, via, tramo)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_analytics_fact_gestion_month ON analytics_fact (gestion_month)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_analytics_fact_un_gestion_month ON analytics_fact (un, gestion_month)")

    for table_name in ['cobranzas_fact', 'contratos_fact', 'gestores_fact']:
        op.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                id BIGSERIAL PRIMARY KEY,
                contract_id VARCHAR(64) NOT NULL,
                gestion_month VARCHAR(7) NOT NULL,
                supervisor VARCHAR(128) NOT NULL DEFAULT 'S/D',
                un VARCHAR(128) NOT NULL DEFAULT 'S/D',
                via VARCHAR(32) NOT NULL DEFAULT 'S/D',
                tramo INTEGER NOT NULL DEFAULT 0,
                source_hash VARCHAR(64) NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{{}}',
                loaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
            )
            """
        )
        op.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{table_name}_business_key ON {table_name} (contract_id, gestion_month, supervisor, un, via, tramo)"
        )
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_{table_name}_gestion_month ON {table_name} (gestion_month)")
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_{table_name}_un_gestion_month ON {table_name} (un, gestion_month)")


def _upgrade_sqlite() -> None:
    op.add_column('sync_runs', sa.Column('close_month', sa.String(length=7), nullable=True))
    op.add_column('sync_runs', sa.Column('target_table', sa.String(length=64), nullable=True))
    op.add_column('sync_runs', sa.Column('rows_read', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('sync_runs', sa.Column('rows_upserted', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('sync_runs', sa.Column('rows_unchanged', sa.Integer(), nullable=False, server_default='0'))

    op.create_table(
        'cartera_fact',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.String(length=64), nullable=False),
        sa.Column('close_date', sa.Date(), nullable=False),
        sa.Column('close_month', sa.String(length=7), nullable=False),
        sa.Column('close_year', sa.Integer(), nullable=False),
        sa.Column('gestion_month', sa.String(length=7), nullable=False),
        sa.Column('supervisor', sa.String(length=128), nullable=False, server_default='S/D'),
        sa.Column('un', sa.String(length=128), nullable=False, server_default='S/D'),
        sa.Column('via_cobro', sa.String(length=32), nullable=False, server_default='S/D'),
        sa.Column('tramo', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('category', sa.String(length=16), nullable=False, server_default='VIGENTE'),
        sa.Column('contracts_total', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('monto_vencido', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_saldo', sa.Float(), nullable=False, server_default='0'),
        sa.Column('capital_saldo', sa.Float(), nullable=False, server_default='0'),
        sa.Column('capital_vencido', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source_hash', sa.String(length=64), nullable=False),
        sa.Column('payload_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('loaded_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'close_date', name='ux_cartera_fact_contract_close_date'),
    )
    op.create_index('ix_cartera_fact_close_date', 'cartera_fact', ['close_date'])
    op.create_index('ix_cartera_fact_close_month', 'cartera_fact', ['close_month'])
    op.create_index('ix_cartera_fact_close_year', 'cartera_fact', ['close_year'])
    op.create_index('ix_cartera_fact_gestion_month', 'cartera_fact', ['gestion_month'])
    op.create_index('ix_cartera_fact_un_close_month', 'cartera_fact', ['un', 'close_month'])
    op.create_index('ix_cartera_fact_supervisor_close_month', 'cartera_fact', ['supervisor', 'close_month'])
    op.create_index('ix_cartera_fact_tramo_close_month', 'cartera_fact', ['tramo', 'close_month'])
    op.create_index('ix_cartera_fact_un_close_month_tramo', 'cartera_fact', ['un', 'close_month', 'tramo'])

    for table_name, analytics in [
        ('analytics_fact', True),
        ('cobranzas_fact', False),
        ('contratos_fact', False),
        ('gestores_fact', False),
    ]:
        cols = [
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('contract_id', sa.String(length=64), nullable=False),
            sa.Column('gestion_month', sa.String(length=7), nullable=False),
            sa.Column('supervisor', sa.String(length=128), nullable=False, server_default='S/D'),
            sa.Column('un', sa.String(length=128), nullable=False, server_default='S/D'),
            sa.Column('via', sa.String(length=32), nullable=False, server_default='S/D'),
            sa.Column('tramo', sa.Integer(), nullable=False, server_default='0'),
        ]
        if analytics:
            cols.extend(
                [
                    sa.Column('contracts_total', sa.Integer(), nullable=False, server_default='1'),
                    sa.Column('debt_total', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('paid_total', sa.Float(), nullable=False, server_default='0'),
                ]
            )
        cols.extend(
            [
                sa.Column('source_hash', sa.String(length=64), nullable=False),
                sa.Column('payload_json', sa.Text(), nullable=False, server_default='{}'),
                sa.Column('loaded_at', sa.DateTime(), nullable=False),
                sa.Column('updated_at', sa.DateTime(), nullable=False),
                sa.PrimaryKeyConstraint('id'),
            ]
        )
        op.create_table(table_name, *cols)
        op.create_index(f'ix_{table_name}_gestion_month', table_name, ['gestion_month'])
        op.create_index(f'ix_{table_name}_un_gestion_month', table_name, ['un', 'gestion_month'])
        op.create_index(
            f'ux_{table_name}_business_key',
            table_name,
            ['contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo'],
            unique=True,
        )


def upgrade() -> None:
    if _is_postgres():
        _upgrade_postgres()
    else:
        _upgrade_sqlite()


def downgrade() -> None:
    for table_name in ['gestores_fact', 'contratos_fact', 'cobranzas_fact', 'analytics_fact']:
        op.drop_index(f'ux_{table_name}_business_key', table_name=table_name)
        op.drop_index(f'ix_{table_name}_un_gestion_month', table_name=table_name)
        op.drop_index(f'ix_{table_name}_gestion_month', table_name=table_name)
        op.drop_table(table_name)

    op.drop_index('ix_cartera_fact_un_close_month_tramo', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_tramo_close_month', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_supervisor_close_month', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_un_close_month', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_gestion_month', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_close_year', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_close_month', table_name='cartera_fact')
    op.drop_index('ix_cartera_fact_close_date', table_name='cartera_fact')
    op.drop_table('cartera_fact')

    op.drop_column('sync_runs', 'rows_unchanged')
    op.drop_column('sync_runs', 'rows_upserted')
    op.drop_column('sync_runs', 'rows_read')
    op.drop_column('sync_runs', 'target_table')
    op.drop_column('sync_runs', 'close_month')
