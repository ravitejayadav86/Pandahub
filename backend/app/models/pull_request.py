"""
Pull requests and the review workflow.

`source_repository_id` supports cross-fork PRs (contributing back to the
upstream repo from your own fork) — it defaults to the same repository for
the common same-repo-branch-to-branch case, but is a separate column so a
PR from a fork doesn't require modeling source/target as always identical.
"""
from app.models import User
import uuid

from sqlalchemy import String, Boolean, Integer, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import PullRequestState, ReviewState


class PullRequest(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "pull_requests"
    __table_args__ = (UniqueConstraint("repository_id", "number", name="uq_pr_number_per_repo"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(String(20000), nullable=True)
    state: Mapped[PullRequestState] = mapped_column(nullable=False, default=PullRequestState.OPEN, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    source_branch: Mapped[str] = mapped_column(String(255), nullable=False)
    target_branch: Mapped[str] = mapped_column(String(255), nullable=False)
    source_repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)

    is_draft: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    merged_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merged_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    merge_commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    closed_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    merged_by: Mapped["User"] = relationship(foreign_keys=[merged_by_id])

    reviews: Mapped[list["PRReview"]] = relationship(back_populates="pull_request", cascade="all, delete-orphan")
    comments: Mapped[list["PRComment"]] = relationship(back_populates="pull_request", cascade="all, delete-orphan")


class PRReview(Base, UUIDPKMixin):
    __tablename__ = "pr_reviews"

    pull_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    state: Mapped[ReviewState] = mapped_column(nullable=False, default=ReviewState.PENDING)
    body: Mapped[str | None] = mapped_column(String(10000), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    reviewer: Mapped["User"] = relationship(foreign_keys=[reviewer_id])

    pull_request: Mapped["PullRequest"] = relationship(back_populates="reviews")
    inline_comments: Mapped[list["PRReviewComment"]] = relationship(back_populates="review", cascade="all, delete-orphan")


class PRReviewComment(Base, UUIDPKMixin):
    """Inline, file+line-anchored comment attached to a specific review."""
    __tablename__ = "pr_review_comments"

    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pr_reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    pull_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[str] = mapped_column(String(10000), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    review: Mapped["PRReview"] = relationship(back_populates="inline_comments")


class PRComment(Base, UUIDPKMixin, TimestampMixin):
    """General (non-inline) discussion comment on a PR's conversation tab."""
    __tablename__ = "pr_comments"

    pull_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body: Mapped[str] = mapped_column(String(20000), nullable=False)

    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    pull_request: Mapped["PullRequest"] = relationship(back_populates="comments")


class AIReviewResult(Base, UUIDPKMixin):
    """Cached output of an AI code review pass over a PR (Module 11).

    Cached rather than regenerated on every page view: AI inference is slow
    and costs money per call, and the PR diff doesn't change until a new
    commit is pushed — so we only regenerate when `pull_request.updated_at`
    advances past this row's created_at.
    """
    __tablename__ = "ai_review_results"

    pull_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pull_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(String(10000), nullable=False)
    suggestions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)
