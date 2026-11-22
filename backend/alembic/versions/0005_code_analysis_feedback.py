"""Add per-finding developer feedback for code-analysis reports.

Revision ID: 0005_code_analysis_feedback
Revises: 0004_code_analysis_history
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_code_analysis_feedback"
down_revision = "0004_code_analysis_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "code_analysis_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "report_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("code_analysis_reports.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("finding_index", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(length=32), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "report_id", "user_id", "finding_index",
            name="uq_code_analysis_feedback_report_user_finding",
        ),
    )
    op.create_index("ix_code_analysis_feedback_report_id", "code_analysis_feedback", ["report_id"])
    op.create_index("ix_code_analysis_feedback_user_id", "code_analysis_feedback", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_code_analysis_feedback_user_id", table_name="code_analysis_feedback")
    op.drop_index("ix_code_analysis_feedback_report_id", table_name="code_analysis_feedback")
    op.drop_table("code_analysis_feedback")
