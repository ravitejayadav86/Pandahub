"""Persist opt-in AI analysis of accepted Git commits.

Revision ID: 0006_commit_ai_analysis
Revises: 0005_code_analysis_feedback

Requires existing local migrations 0004 and 0005 to be committed before deployment.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_commit_ai_analysis"
down_revision = "0005_code_analysis_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "repositories", sa.Column("auto_ai_analysis_enabled", sa.Boolean(),
                                   nullable=False, server_default=sa.false())
    )
    op.create_table(
        "commit_ai_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_name", sa.String(length=255), nullable=False),
        sa.Column("commit_sha", sa.String(length=40), nullable=False),
        sa.Column("base_sha", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("summary", sa.String(length=12000), nullable=True),
        sa.Column("model_used", sa.String(length=150), nullable=True),
        sa.Column("suggestions", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("next_steps", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("error_message", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("repository_id", "branch_name", "commit_sha", name="uq_commit_ai_repo_branch_sha"),
    )
    op.create_index("ix_commit_ai_analyses_repository_id", "commit_ai_analyses", ["repository_id"])
    op.create_index("ix_commit_ai_analyses_commit_sha", "commit_ai_analyses", ["commit_sha"])
    op.create_index("ix_commit_ai_repo_created", "commit_ai_analyses", ["repository_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_commit_ai_repo_created", table_name="commit_ai_analyses")
    op.drop_index("ix_commit_ai_analyses_commit_sha", table_name="commit_ai_analyses")
    op.drop_index("ix_commit_ai_analyses_repository_id", table_name="commit_ai_analyses")
    op.drop_table("commit_ai_analyses")
    op.drop_column("repositories", "auto_ai_analysis_enabled")
