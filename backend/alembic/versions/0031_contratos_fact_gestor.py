"""Add gestor column to contratos_fact

Revision ID: 0031
Revises: 0030
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0031_contratos_fact_gestor'
down_revision = '0030_cobranzas_fact_gestor'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('contratos_fact', sa.Column('gestor', sa.String(128), nullable=False, server_default='S/D'))
    op.create_index('ix_contratos_fact_gestor', 'contratos_fact', ['gestor'])


def downgrade() -> None:
    op.drop_index('ix_contratos_fact_gestor', table_name='contratos_fact')
    op.drop_column('contratos_fact', 'gestor')
