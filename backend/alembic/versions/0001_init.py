"""initial brokers config tables

Revision ID: 0001_init
Revises: 
Create Date: 2026-02-13
"""

from alembic import op
import sqlalchemy as sa


revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'brokers_supervisor_scope',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('supervisors_json', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'commission_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rules_json', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'prize_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rules_json', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'audit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=32), nullable=False),
        sa.Column('actor', sa.String(length=64), nullable=False),
        sa.Column('payload_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_table('prize_rules')
    op.drop_table('commission_rules')
    op.drop_table('brokers_supervisor_scope')
