import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RepoVisibility(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    INTERNAL = "internal"


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (
        Index("ix_repo_owner_name", "owner_id", "name", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Owner: either a user OR an org (exactly one set)
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    org_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[RepoVisibility] = mapped_column(
        Enum(RepoVisibility, native_enum=False), default=RepoVisibility.PUBLIC, nullable=False
    )
    default_branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)

    # Counters (denormalised for speed)
    star_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fork_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    open_issues_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    watcher_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_fork: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    forked_from_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="SET NULL")
    )

    # Disk path (relative to GIT_REPOS_ROOT, e.g. "owner/repo.git")
    disk_path: Mapped[str] = mapped_column(String(500), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="repositories", foreign_keys=[owner_id])  # noqa: F821
    organization: Mapped["Organization"] = relationship("Organization", back_populates="repositories")  # noqa: F821
    stars: Mapped[list["Star"]] = relationship("Star", back_populates="repository", cascade="all, delete-orphan")  # noqa: F821
    issues: Mapped[list["Issue"]] = relationship("Issue", back_populates="repository", cascade="all, delete-orphan")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Repository id={self.id} slug={self.slug!r}>"
