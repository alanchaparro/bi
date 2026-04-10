"""eerr_fact: agregar columna is_tapo para identificar tratamientos odontológicos financiados por TAPO

Revision ID: 0027_eerr_fact_is_tapo
Revises: 0026_auth_nav_config_subsections
Create Date: 2025-01-08
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0027_eerr_fact_is_tapo"
down_revision = "0026_auth_nav_config_subsections"
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna is_tapo a eerr_fact
    # Identifica asientos contables de tratamientos odontológicos financiados por TAPO
    # Criterio: enterprise_id = 1 (Odontología) AND service_invoice_id = 2 (Tratamiento Odontológico) AND financing = 1
    op.add_column(
        "eerr_fact",
        sa.Column(
            "is_tapo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
    )

    # Crear índice para mejorar consultas con filtro is_tapo
    # Usado cuando exclude_tapo = True en la API
    op.create_index(
        "ix_eerr_fact_is_tapo",
        "eerr_fact",
        ["is_tapo"],
    )

    # Índice compuesto para consultas frecuentes con is_tapo
    # Consultas por mes + bloque + is_tapo
    op.create_index(
        "ix_eerr_fact_gestion_block_tapo",
        "eerr_fact",
        ["gestion_month", "eerr_block", "is_tapo"],
    )


def downgrade():
    # Eliminar índices
    op.drop_index("ix_eerr_fact_gestion_block_tapo", table_name="eerr_fact")
    op.drop_index("ix_eerr_fact_is_tapo", table_name="eerr_fact")

    # Eliminar columna
    op.drop_column("eerr_fact", "is_tapo")
