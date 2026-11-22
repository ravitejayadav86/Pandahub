"""Persisted, bounded audit of each separately leased CI execution attempt.

One CI run represents a commit/branch and retains its current summary.
Every actual runner claim writes a new immutable attempt number. A finalized
attempt remains available if an administrator explicitly queues another try.
No runner token, Git credential, or environment variable is persisted.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPKMixin


class CIRunAttempt(Base, UUIDPKMixin):
    __tablename__ = "ci_run_attempts"
    __table_args__ = (
        UniqueConstraint(
            "run_id", "attempt_number", name="uq_ci_attempt_run_number"
        ),
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ci_runs.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    runner_credential_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ci_runner_credentials.id", ondelete="SET NULL"),
        nullable=True,
    )
    lease_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    conclusion: Mapped[str | None] = mapped_column(String(20))
    end_reason: Mapped[str | None] = mapped_column(String(35))
    log_excerpt: Mapped[str | None] = mapped_column(String(10000))
