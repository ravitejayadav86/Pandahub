"""
Issue tracking: labels, milestones, issues, and their comments.

`number` on Issue is a per-repository sequential integer (issue #1, #2...),
matching the URL scheme users expect (/org/repo/issues/42). It is NOT the
primary key — the UUID `id` is — because sequential numbers must be
assigned transactionally per-repository (see issue_service.py, Module 10)
to avoid gaps/collisions, which a global auto-increment column can't do
per-partition cleanly.
"""
import uuid

from sqlalchemy import String, Integer, Boolean, Date, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import IssueState, MilestoneState


class Label(Base, UUIDPKMixin):
    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("repository_id", "name", name="uq_label_per_repo"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#ededed")  # hex color
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Milestone(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "milestones"

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    due_date: Mapped[object | None] = mapped_column(Date, nullable=True)
    state: Mapped[MilestoneState] = mapped_column(nullable=False, default=MilestoneState.OPEN)


class Issue(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "issues"
    __table_args__ = (UniqueConstraint("repository_id", "number", name="uq_issue_number_per_repo"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(String(20000), nullable=True)
    state: Mapped[IssueState] = mapped_column(nullable=False, default=IssueState.OPEN, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closed_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    labels: Mapped[list["IssueLabel"]] = relationship(back_populates="issue", cascade="all, delete-orphan")
    assignees: Mapped[list["IssueAssignee"]] = relationship(back_populates="issue", cascade="all, delete-orphan")
    comments: Mapped[list["IssueComment"]] = relationship(back_populates="issue", cascade="all, delete-orphan")


class IssueLabel(Base):
    """Pure association table (issue <-> label), no surrogate PK needed."""
    __tablename__ = "issue_labels"

    issue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("issues.id", ondelete="CASCADE"), primary_key=True)
    label_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True)

    issue: Mapped["Issue"] = relationship(back_populates="labels")


class IssueAssignee(Base):
    __tablename__ = "issue_assignees"

    issue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("issues.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    issue: Mapped["Issue"] = relationship(back_populates="assignees")


class IssueComment(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "issue_comments"

    issue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body: Mapped[str] = mapped_column(String(20000), nullable=False)

    issue: Mapped["Issue"] = relationship(back_populates="comments")
