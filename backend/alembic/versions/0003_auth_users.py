"""auth users table

Revision ID: 0003_auth_users
Revises: 0002_indexes_and_auth
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa


revision = '0003_auth_users'
down_revision = '0002_indexes_and_auth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'auth_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=128), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='viewer'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_auth_users_username', 'auth_users', ['username'], unique=True)
    op.create_index('ix_auth_users_is_active', 'auth_users', ['is_active'])


def downgrade() -> None:
    op.drop_index('ix_auth_users_is_active', table_name='auth_users')
    op.drop_index('ix_auth_users_username', table_name='auth_users')
    op.drop_table('auth_users')
