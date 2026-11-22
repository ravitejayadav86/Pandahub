"""Opt-in native CI queue and durable result records.

Revision ID: 0007_native_ci_queue
Revises: 0006_commit_ai_analysis

No source code is executed by this migration or by the post-receive worker.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_native_ci_queue"
down_revision = "0006_commit_ai_analysis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "repositories",
        sa.Column(
            "auto_ci_enabled", sa.Boolean(), nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_table(
        "ci_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "repository_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("branch_name", sa.String(length=255), nullable=False),
        sa.Column("commit_sha", sa.String(length=40), nullable=False),
        sa.Column(
            "status", sa.String(length=20), nullable=False,
            server_default="queued",
        ),
        sa.Column("conclusion", sa.String(length=20), nullable=True),
        sa.Column("log_excerpt", sa.String(length=10000), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "repository_id", "branch_name", "commit_sha",
            name="uq_ci_run_repo_branch_sha",
        ),
    )
    op.create_index("ix_ci_runs_repository_id", "ci_runs", ["repository_id"])
    op.create_index("ix_ci_runs_commit_sha", "ci_runs", ["commit_sha"])
    op.create_index(
        "ix_ci_runs_repo_created", "ci_runs",
        ["repository_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ci_runs_repo_created", table_name="ci_runs")
    op.drop_index("ix_ci_runs_commit_sha", table_name="ci_runs")
    op.drop_index("ix_ci_runs_repository_id", table_name="ci_runs")
    op.drop_table("ci_runs")
    op.drop_column("repositories", "auto_ci_enabled")
