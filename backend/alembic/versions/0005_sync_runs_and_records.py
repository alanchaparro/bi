"""sync runs and records

Revision ID: 0005_sync_runs_and_records
Revises: 0004_user_preferences
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa


revision = '0005_sync_runs_and_records'
down_revision = '0004_user_preferences'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sync_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.String(length=64), nullable=False),
        sa.Column('domain', sa.String(length=32), nullable=False),
        sa.Column('mode', sa.String(length=32), nullable=False),
        sa.Column('year_from', sa.Integer(), nullable=True),
        sa.Column('running', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('stage', sa.String(length=64), nullable=True),
        sa.Column('progress_pct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status_message', sa.String(length=512), nullable=True),
        sa.Column('rows_inserted', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_updated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_skipped', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duplicates_detected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('log_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('duration_sec', sa.Float(), nullable=True),
        sa.Column('actor', sa.String(length=128), nullable=False, server_default='system'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sync_runs_job_id', 'sync_runs', ['job_id'], unique=True)
    op.create_index('ix_sync_runs_domain', 'sync_runs', ['domain'])
    op.create_index('ix_sync_runs_running', 'sync_runs', ['running'])

    op.create_table(
        'sync_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('domain', sa.String(length=32), nullable=False),
        sa.Column('contract_id', sa.String(length=64), nullable=False),
        sa.Column('gestion_month', sa.String(length=7), nullable=False),
        sa.Column('supervisor', sa.String(length=128), nullable=False),
        sa.Column('un', sa.String(length=128), nullable=False),
        sa.Column('via', sa.String(length=32), nullable=False),
        sa.Column('tramo', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('payload_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('source_hash', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sync_records_domain', 'sync_records', ['domain'])
    op.create_index('ix_sync_records_gestion_month', 'sync_records', ['gestion_month'])
    op.create_index(
        'ux_sync_records_business_key',
        'sync_records',
        ['domain', 'contract_id', 'gestion_month', 'supervisor', 'un', 'via', 'tramo'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ux_sync_records_business_key', table_name='sync_records')
    op.drop_index('ix_sync_records_gestion_month', table_name='sync_records')
    op.drop_index('ix_sync_records_domain', table_name='sync_records')
    op.drop_table('sync_records')

    op.drop_index('ix_sync_runs_running', table_name='sync_runs')
    op.drop_index('ix_sync_runs_domain', table_name='sync_runs')
    op.drop_index('ix_sync_runs_job_id', table_name='sync_runs')
    op.drop_table('sync_runs')
