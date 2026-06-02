"""Add gestor column to cartera_fact, cobranzas_cohorte_agg and mv_options_cohorte

Revision ID: 0029
Revises: 0028
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0029_cohorte_gestor'
down_revision = '0028_eerr_fact_uk_is_tapo'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cartera_fact', sa.Column('gestor', sa.String(128), nullable=False, server_default='S/D'))
    op.add_column('cobranzas_cohorte_agg', sa.Column('gestor', sa.String(128), nullable=False, server_default='S/D'))
    op.add_column('mv_options_cohorte', sa.Column('gestor', sa.String(128), nullable=False, server_default='S/D'))
    op.create_index('ix_cartera_fact_gestor', 'cartera_fact', ['gestor'])
    op.create_index('ix_cobranzas_cohorte_agg_gestor', 'cobranzas_cohorte_agg', ['gestor'])
    op.create_index('ix_mv_options_cohorte_gestor', 'mv_options_cohorte', ['gestor'])


def downgrade() -> None:
    op.drop_index('ix_mv_options_cohorte_gestor', table_name='mv_options_cohorte')
    op.drop_index('ix_cobranzas_cohorte_agg_gestor', table_name='cobranzas_cohorte_agg')
    op.drop_index('ix_cartera_fact_gestor', table_name='cartera_fact')
    op.drop_column('mv_options_cohorte', 'gestor')
    op.drop_column('cobranzas_cohorte_agg', 'gestor')
    op.drop_column('cartera_fact', 'gestor')
