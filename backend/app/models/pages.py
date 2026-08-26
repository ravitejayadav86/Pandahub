"""
RepositoryPages model — PandaHub Pages static-site hosting.

One row per repository.  The Pages feature lets users publish a static site
directly from a branch in any public repository, served at:

    GET /api/v1/pages/{owner}/{repo}/{path}

Design decisions:
- One-to-one relationship with Repository (enforced by UniqueConstraint on
  repository_id — not a FK → FK one-to-one so Alembic can add the table
  independently without touching the repositories table).
- ``status`` is a plain VARCHAR, not a Postgres enum, because the set of
  states is small and might grow (e.g., adding "degraded") without needing
  an ALTER TYPE migration.
- ``published_sha`` and ``published_at`` are updated atomically by the Celery
  build task after every successful upload to MinIO, so the serving endpoint
  can always tell whether the published content is fresh.
- ``custom_domain`` is stored but not yet validated / provisioned — reserved
  for a future milestone that adds ACME cert management.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.repo import Repository


class RepositoryPages(Base, UUIDPKMixin, TimestampMixin):
    """Configuration + build state for PandaHub Pages on a single repository."""

    __tablename__ = "repository_pages"
    __table_args__ = (
        UniqueConstraint("repository_id", name="uq_repository_pages_repo"),
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Which branch to build from (e.g. "main", "gh-pages")
    source_branch: Mapped[str] = mapped_column(String(255), nullable=False, default="main")

    # Which sub-folder inside that branch ("/" = repo root, "/docs" = docs folder)
    source_folder: Mapped[str] = mapped_column(String(500), nullable=False, default="/")

    # Build lifecycle
    # Possible values: "pending" | "building" | "active" | "failed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # SHA of the last successfully built commit
    published_sha: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Optional: custom domain support (future milestone)
    custom_domain: Mapped[Optional[str]] = mapped_column(String(253), nullable=True)

    # Relationship back to the owning repository
    repository: Mapped["Repository"] = relationship("Repository")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RepositoryPages repo={self.repository_id} status={self.status}>"
