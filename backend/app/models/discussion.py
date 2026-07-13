"""
Repository discussions — freeform Q&A/announcements, distinct from Issues
(actionable work items) and PRs (code changes). Comments support one level
of threading via `parent_comment_id` (a reply to a reply flattens to the
top-level thread, matching how most discussion UIs render — avoids
unbounded recursive tree rendering on the frontend).
"""
import uuid

from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import DiscussionCategory


class Discussion(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "discussions"

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(String(20000), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[DiscussionCategory] = mapped_column(nullable=False, default=DiscussionCategory.GENERAL)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    comments: Mapped[list["DiscussionComment"]] = relationship(back_populates="discussion", cascade="all, delete-orphan")


class DiscussionComment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "discussion_comments"

    discussion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("discussion_comments.id", ondelete="CASCADE"), nullable=True)
    body: Mapped[str] = mapped_column(String(20000), nullable=False)

    discussion: Mapped["Discussion"] = relationship(back_populates="comments")
