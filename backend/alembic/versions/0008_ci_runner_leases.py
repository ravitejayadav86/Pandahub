"""Repository-scoped CI runner identities and leased jobs.

Revision ID: 0008_ci_runner_leases
Revises: 0007_native_ci_queue

Existing CI run results are retained; all lease columns are nullable.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_ci_runner_leases"
down_revision = "0007_native_ci_queue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ci_runner_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("token_sha256", sa.String(64), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_ci_runner_credentials_repository_id",
                    "ci_runner_credentials", ["repository_id"])
    op.add_column("ci_runs", sa.Column(
        "runner_credential_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("ci_runner_credentials.id", ondelete="SET NULL"),
        nullable=True))
    op.add_column("ci_runs", sa.Column(
        "lease_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("ci_runs", sa.Column(
        "lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ci_runs", sa.Column(
        "last_heartbeat_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_ci_runs_runner_credential_id",
                    "ci_runs", ["runner_credential_id"])


def downgrade() -> None:
    op.drop_index("ix_ci_runs_runner_credential_id", table_name="ci_runs")
    op.drop_column("ci_runs", "last_heartbeat_at")
    op.drop_column("ci_runs", "lease_expires_at")
    op.drop_column("ci_runs", "lease_id")
    op.drop_column("ci_runs", "runner_credential_id")
    op.drop_index("ix_ci_runner_credentials_repository_id",
                  table_name="ci_runner_credentials")
    op.drop_table("ci_runner_credentials")
