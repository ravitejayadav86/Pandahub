"""Durable CI attempt history and opt-in, administrator-confirmed retry.

Revision ID: 0009_ci_attempt_audit
Revises: 0008_ci_runner_leases

Backfills one historical attempt for each previously started/completed run.
This preserves all existing 0008 data and does not enqueue or execute jobs.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_ci_attempt_audit"
down_revision = "0008_ci_runner_leases"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_runs",
        sa.Column(
            "attempt_count", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.create_table(
        "ci_run_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "run_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ci_runs.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column(
            "runner_credential_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ci_runner_credentials.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("lease_id", postgresql.UUID(as_uuid=True)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("conclusion", sa.String(20)),
        sa.Column("end_reason", sa.String(35)),
        sa.Column("log_excerpt", sa.String(10000)),
        sa.Column("retry_requested_at", sa.DateTime(timezone=True)),
        sa.Column("retry_reason", sa.String(300)),
        sa.UniqueConstraint(
            "run_id", "attempt_number", name="uq_ci_attempt_run_number"
        ),
    )
    op.create_index("ix_ci_run_attempts_run_id", "ci_run_attempts", ["run_id"])

    # The old schema stored the latest result on ci_runs. Preserve it as
    # attempt #1 before any later retry can clear the run summary.
    op.execute(sa.text("""
        INSERT INTO ci_run_attempts
            (id, run_id, attempt_number, runner_credential_id, lease_id,
             started_at, completed_at, conclusion, end_reason, log_excerpt)
        SELECT
            gen_random_uuid(), id, 1, runner_credential_id, lease_id,
            COALESCE(started_at, created_at), completed_at,
            conclusion,
            CASE WHEN status = 'completed' THEN 'legacy_backfill'
                 ELSE NULL END,
            log_excerpt
        FROM ci_runs
        WHERE status IN ('running', 'completed')
    """))
    op.execute(sa.text("""
        UPDATE ci_runs SET attempt_count = 1
        WHERE status IN ('running', 'completed')
    """))


def downgrade() -> None:
    # A downgrade would discard retry history. Operators must deliberately
    # back up the database before rolling the schema backward.
    op.drop_index("ix_ci_run_attempts_run_id", table_name="ci_run_attempts")
    op.drop_table("ci_run_attempts")
    op.drop_column("ci_runs", "attempt_count")
