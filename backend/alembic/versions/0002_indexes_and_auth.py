"""auth hardening and analytics indexes

Revision ID: 0002_indexes_and_auth
Revises: 0001_init
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa


revision = '0002_indexes_and_auth'
down_revision = '0001_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'auth_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('refresh_token_hash', sa.String(length=255), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('rotated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_auth_sessions_username', 'auth_sessions', ['username'])
    op.create_index('ix_auth_sessions_revoked', 'auth_sessions', ['revoked'])
    op.create_index('ix_auth_sessions_refresh_hash', 'auth_sessions', ['refresh_token_hash'], unique=True)

    op.create_table(
        'auth_user_state',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('failed_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('blocked_until', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_auth_user_state_username', 'auth_user_state', ['username'], unique=True)

    op.create_table(
        'analytics_contract_snapshot',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.String(length=32), nullable=False),
        sa.Column('sale_month', sa.String(length=7), nullable=False),
        sa.Column('close_month', sa.String(length=7), nullable=False),
        sa.Column('supervisor', sa.String(length=128), nullable=False),
        sa.Column('un', sa.String(length=128), nullable=False),
        sa.Column('via', sa.String(length=32), nullable=False),
        sa.Column('tramo', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('debt', sa.Float(), nullable=False, server_default='0'),
        sa.Column('paid', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_acs_contract_id', 'analytics_contract_snapshot', ['contract_id'])
    op.create_index('ix_acs_sale_month', 'analytics_contract_snapshot', ['sale_month'])
    op.create_index('ix_acs_close_month', 'analytics_contract_snapshot', ['close_month'])
    op.create_index('ix_acs_supervisor', 'analytics_contract_snapshot', ['supervisor'])
    op.create_index('ix_acs_un', 'analytics_contract_snapshot', ['un'])
    op.create_index('ix_acs_via', 'analytics_contract_snapshot', ['via'])


def downgrade() -> None:
    op.drop_index('ix_acs_via', table_name='analytics_contract_snapshot')
    op.drop_index('ix_acs_un', table_name='analytics_contract_snapshot')
    op.drop_index('ix_acs_supervisor', table_name='analytics_contract_snapshot')
    op.drop_index('ix_acs_close_month', table_name='analytics_contract_snapshot')
    op.drop_index('ix_acs_sale_month', table_name='analytics_contract_snapshot')
    op.drop_index('ix_acs_contract_id', table_name='analytics_contract_snapshot')
    op.drop_table('analytics_contract_snapshot')

    op.drop_index('ix_auth_user_state_username', table_name='auth_user_state')
    op.drop_table('auth_user_state')

    op.drop_index('ix_auth_sessions_refresh_hash', table_name='auth_sessions')
    op.drop_index('ix_auth_sessions_revoked', table_name='auth_sessions')
    op.drop_index('ix_auth_sessions_username', table_name='auth_sessions')
    op.drop_table('auth_sessions')
