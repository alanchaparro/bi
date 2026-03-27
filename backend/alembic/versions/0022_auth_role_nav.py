"""auth_role_nav: visibilidad de menú por rol

Revision ID: 0022_auth_role_nav
Revises: 0021_cartera_conflict_key
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa


revision = '0022_auth_role_nav'
down_revision = '0021_cartera_conflict_key'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'auth_role_nav',
        sa.Column('role', sa.String(length=32), nullable=False),
        sa.Column('nav_id', sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint('role', 'nav_id'),
    )
    op.create_index('ix_auth_role_nav_role', 'auth_role_nav', ['role'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_auth_role_nav_role', table_name='auth_role_nav')
    op.drop_table('auth_role_nav')
