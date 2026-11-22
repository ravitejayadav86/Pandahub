"""Persistent, advisory CI run records for accepted Git branch tips.

No repository code executes in the API or Celery worker. A separately
operated, constrained runner may claim and report these jobs.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPKMixin


class CIRun(Base, UUIDPKMixin):
    __tablename__ = "ci_runs"
    __table_args__ = (
        UniqueConstraint(
            "repository_id", "branch_name", "commit_sha",
            name="uq_ci_run_repo_branch_sha",
        ),
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    branch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    # queued -> running -> completed (no job retry or deployment in this MVP)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    # null | success | failure | error | timed_out
    conclusion: Mapped[str | None] = mapped_column(String(20))
    # Deliberately bounded; never store unbounded test logs in PostgreSQL.
    log_excerpt: Mapped[str | None] = mapped_column(String(10000))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    runner_credential_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ci_runner_credentials.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    lease_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Count actual runner claims, not queue insertions or retry requests.
    attempt_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
