"""Add gestor column to sync_records

Revision ID: 0032
Revises: 0031
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0032_sync_records_gestor'
down_revision = '0031_contratos_fact_gestor'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sync_records', sa.Column('gestor', sa.String(128), nullable=False, server_default='S/D'))
    op.create_index('ix_sync_records_gestor', 'sync_records', ['gestor'])


def downgrade() -> None:
    op.drop_index('ix_sync_records_gestor', table_name='sync_records')
    op.drop_column('sync_records', 'gestor')
