"""Añade visibilidad de menú EERR para todos los roles (auth_role_nav)

Revision ID: 0023_auth_role_nav_eerr
Revises: 0022_auth_role_nav
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa


revision = '0023_auth_role_nav_eerr'
down_revision = '0022_auth_role_nav'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    for role in ('admin', 'analyst', 'viewer'):
        conn.execute(
            sa.text(
                'INSERT INTO auth_role_nav (role, nav_id) VALUES (:role, :nav_id) '
                'ON CONFLICT (role, nav_id) DO NOTHING'
            ),
            {'role': role, 'nav_id': 'eerr'},
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM auth_role_nav WHERE nav_id = 'eerr'"))
