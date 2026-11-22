"""Add user-scoped code analysis history.

Revision ID: 0004_code_analysis_history
Revises: 0003_ai_routing_provenance
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_code_analysis_history"
down_revision = "0003_ai_routing_provenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "code_analysis_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=False),
        sa.Column("quality_score", sa.Integer(), nullable=False),
        sa.Column("issue_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("findings", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("ai_review", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_code_analysis_reports_user_id", "code_analysis_reports", ["user_id"])
    op.create_index("ix_code_analysis_reports_language", "code_analysis_reports", ["language"])
    op.create_index("ix_code_analysis_reports_created_at", "code_analysis_reports", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_code_analysis_reports_created_at", table_name="code_analysis_reports")
    op.drop_index("ix_code_analysis_reports_language", table_name="code_analysis_reports")
    op.drop_index("ix_code_analysis_reports_user_id", table_name="code_analysis_reports")
    op.drop_table("code_analysis_reports")
