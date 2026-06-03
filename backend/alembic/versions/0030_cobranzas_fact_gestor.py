"""Add gestor column to cobranzas_fact

Revision ID: 0030
Revises: 0029
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0030_cobranzas_fact_gestor'
down_revision = '0029_cohorte_gestor'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cobranzas_fact', sa.Column('gestor', sa.String(128), nullable=False, server_default='S/D'))
    op.create_index('ix_cobranzas_fact_gestor', 'cobranzas_fact', ['gestor'])


def downgrade() -> None:
    op.drop_index('ix_cobranzas_fact_gestor', table_name='cobranzas_fact')
    op.drop_column('cobranzas_fact', 'gestor')
