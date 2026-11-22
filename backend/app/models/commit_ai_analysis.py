"""Repository-scoped analysis of accepted commits (never demo results)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPKMixin


class CommitAIAnalysis(Base, UUIDPKMixin):
    __tablename__ = "commit_ai_analyses"
    __table_args__ = (
        UniqueConstraint("repository_id", "branch_name", "commit_sha", name="uq_commit_ai_repo_branch_sha"),
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    base_sha: Mapped[str | None] = mapped_column(String(40))
    # "queued" | "running" | "completed" | "skipped" | "failed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    summary: Mapped[str | None] = mapped_column(String(12000))
    model_used: Mapped[str | None] = mapped_column(String(150))
    suggestions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    next_steps: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    error_message: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
