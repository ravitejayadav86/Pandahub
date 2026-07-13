"""
Repository and everything that hangs directly off it.

Ownership model: a repository is owned by EITHER a user OR an organization,
never both — enforced by a CHECK constraint (exactly one of
owner_user_id / owner_organization_id is non-null) rather than trusting
application code alone. This matters because ownership determines the
default permission root for the entire permission-resolution chain.

Branches table: git itself is the source of truth for refs, but we cache
branch name, protection status, and last known commit SHA here so the
repository page can render a branch list and "N commits ahead" badges
without shelling out to libgit2 on every page load. The git_engine
(Module 8) is responsible for keeping this cache in sync on every push.
"""
import uuid

from sqlalchemy import (
    String, Boolean, BigInteger, Integer, ForeignKey, UniqueConstraint,
    CheckConstraint, DateTime, ARRAY,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import RepositoryVisibility, PermissionLevel


class Repository(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "repositories"
    __table_args__ = (
        CheckConstraint(
            "(owner_user_id IS NOT NULL)::int + (owner_organization_id IS NOT NULL)::int = 1",
            name="ck_repo_single_owner",
        ),
        # Partial unique indexes (owner + name) are added by hand in the migration,
        # since SQLAlchemy's UniqueConstraint doesn't support a WHERE clause directly.
    )

    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    owner_organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    visibility: Mapped[RepositoryVisibility] = mapped_column(nullable=False, default=RepositoryVisibility.PRIVATE)
    default_branch: Mapped[str] = mapped_column(String(255), nullable=False, default="main")

    is_fork: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    forked_from_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True)

    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Absolute path to the bare repo on the shared git_storage volume, e.g.
    # /data/repositories/<uuid>.git — NOT derived from name, so renaming a
    # repo never requires moving files on disk or breaking existing clone URLs.
    disk_path: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)

    size_kb: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    # Denormalized counters: read on every repo card/listing page, and doing
    # COUNT(*) on stars/watchers per row at list-render time would be
    # prohibitively slow. Kept in sync via service-layer transactions
    # (see repo_service.py, Module 7) whenever a star/watch is added/removed.
    star_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fork_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    watcher_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    pushed_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    collaborators: Mapped[list["RepositoryCollaborator"]] = relationship(back_populates="repository", cascade="all, delete-orphan")
    branches: Mapped[list["Branch"]] = relationship(back_populates="repository", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Repository {self.name}>"


class RepositoryCollaborator(Base, UUIDPKMixin):
    """Direct, one-off user grant on a repo — independent of org/team membership."""
    __tablename__ = "repository_collaborators"
    __table_args__ = (UniqueConstraint("repository_id", "user_id", name="uq_repo_collaborator"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission: Mapped[PermissionLevel] = mapped_column(nullable=False, default=PermissionLevel.READ)

    repository: Mapped["Repository"] = relationship(back_populates="collaborators")
    user: Mapped["User"] = relationship()


class Branch(Base, UUIDPKMixin):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("repository_id", "name", name="uq_branch_per_repo"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_protected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_pushed_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    repository: Mapped["Repository"] = relationship(back_populates="branches")


class RepositoryStar(Base, UUIDPKMixin):
    __tablename__ = "repository_stars"
    __table_args__ = (UniqueConstraint("repository_id", "user_id", name="uq_repo_star"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)


class RepositoryWatcher(Base, UUIDPKMixin):
    __tablename__ = "repository_watchers"
    __table_args__ = (UniqueConstraint("repository_id", "user_id", name="uq_repo_watcher"),)

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)


class Webhook(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "webhooks"

    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    secret_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    events: Mapped[list[str]] = mapped_column(ARRAY(String(50)), nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
