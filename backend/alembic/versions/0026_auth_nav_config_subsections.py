"""Sustituye nav_id config por secciones finas en auth_role_nav

Revision ID: 0026_auth_nav_config_subsections
Revises: 0025_eerr_monthly_agg
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0026_auth_nav_config_subsections"
down_revision = "0025_eerr_monthly_agg"
branch_labels = None
depends_on = None

_CONFIG_SECTIONS = (
    "config_usuarios",
    "config_roles_menus",
    "config_layouts_filtros",
    "config_negocio",
    "config_importaciones",
    "config_programacion",
)


def upgrade() -> None:
    conn = op.get_bind()
    res = conn.execute(sa.text("SELECT DISTINCT role FROM auth_role_nav WHERE nav_id = 'config'"))
    roles = [r[0] for r in res.fetchall()]
    conn.execute(sa.text("DELETE FROM auth_role_nav WHERE nav_id = 'config'"))
    for role in roles:
        for nid in _CONFIG_SECTIONS:
            conn.execute(
                sa.text(
                    "INSERT INTO auth_role_nav (role, nav_id) VALUES (:role, :nav_id) "
                    "ON CONFLICT (role, nav_id) DO NOTHING"
                ),
                {"role": role, "nav_id": nid},
            )


def downgrade() -> None:
    conn = op.get_bind()
    in_list = ", ".join(f"'{x}'" for x in _CONFIG_SECTIONS)
    conn.execute(sa.text(f"DELETE FROM auth_role_nav WHERE nav_id IN ({in_list})"))
    for role in ("admin", "analyst", "viewer"):
        conn.execute(
            sa.text(
                "INSERT INTO auth_role_nav (role, nav_id) VALUES (:role, 'config') "
                "ON CONFLICT (role, nav_id) DO NOTHING"
            ),
            {"role": role},
        )
