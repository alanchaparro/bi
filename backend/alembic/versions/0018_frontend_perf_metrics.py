"""frontend telemetry metrics table

Revision ID: 0018_frontend_perf_metrics
Revises: 0017_dim_negocio_sale_fields
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_frontend_perf_metrics"
down_revision = "0017_dim_negocio_sale_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "frontend_perf_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("route", sa.String(length=32), nullable=False),
        sa.Column("session_id", sa.String(length=128), nullable=False),
        sa.Column("trace_id", sa.String(length=128), nullable=True),
        sa.Column("ttfb_ms", sa.Float(), nullable=True),
        sa.Column("fcp_ms", sa.Float(), nullable=True),
        sa.Column("ready_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("api_calls_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("app_version", sa.String(length=64), nullable=False, server_default="dev"),
        sa.Column("event_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_frontend_perf_metrics_route", "frontend_perf_metrics", ["route"])
    op.create_index("ix_frontend_perf_metrics_session_id", "frontend_perf_metrics", ["session_id"])
    op.create_index("ix_frontend_perf_metrics_trace_id", "frontend_perf_metrics", ["trace_id"])
    op.create_index("ix_frontend_perf_metrics_event_at", "frontend_perf_metrics", ["event_at"])
    op.create_index("ix_frontend_perf_metrics_created_at", "frontend_perf_metrics", ["created_at"])
    op.create_index("ix_frontend_perf_route_event_at", "frontend_perf_metrics", ["route", "event_at"])


def downgrade() -> None:
    op.drop_index("ix_frontend_perf_route_event_at", table_name="frontend_perf_metrics")
    op.drop_index("ix_frontend_perf_metrics_created_at", table_name="frontend_perf_metrics")
    op.drop_index("ix_frontend_perf_metrics_event_at", table_name="frontend_perf_metrics")
    op.drop_index("ix_frontend_perf_metrics_trace_id", table_name="frontend_perf_metrics")
    op.drop_index("ix_frontend_perf_metrics_session_id", table_name="frontend_perf_metrics")
    op.drop_index("ix_frontend_perf_metrics_route", table_name="frontend_perf_metrics")
    op.drop_table("frontend_perf_metrics")
