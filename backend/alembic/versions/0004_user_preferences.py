"""user preferences for brokers filters

Revision ID: 0004_user_preferences
Revises: 0003_auth_users
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa


revision = '0004_user_preferences'
down_revision = '0003_auth_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('pref_key', sa.String(length=64), nullable=False),
        sa.Column('value_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_preferences_username', 'user_preferences', ['username'])
    op.create_index('ix_user_preferences_pref_key', 'user_preferences', ['pref_key'])
    op.create_index(
        'ux_user_preferences_username_key',
        'user_preferences',
        ['username', 'pref_key'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ux_user_preferences_username_key', table_name='user_preferences')
    op.drop_index('ix_user_preferences_pref_key', table_name='user_preferences')
    op.drop_index('ix_user_preferences_username', table_name='user_preferences')
    op.drop_table('user_preferences')
