"""
Startup Hub — lets users form startup profiles, recruit collaborators,
showcase repos as projects, and list investor/funding info.

`StartupOpenRole` and `StartupCollaborationRequest` are separate tables
(rather than folding "wants to join" straight into StartupMember) because
a request is a proposal that may be rejected — it should never touch the
membership table until explicitly accepted, keeping the audit trail of
who-applied-when distinct from who-is-actually-a-member.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import StartupStage, CollaborationRequestStatus


class Startup(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "startups"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(String(10000), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stage: Mapped[StartupStage] = mapped_column(nullable=False, default=StartupStage.IDEA)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    members: Mapped[list["StartupMember"]] = relationship(back_populates="startup", cascade="all, delete-orphan")
    open_roles: Mapped[list["StartupOpenRole"]] = relationship(back_populates="startup", cascade="all, delete-orphan")
    projects: Mapped[list["StartupProject"]] = relationship(back_populates="startup", cascade="all, delete-orphan")
    investors: Mapped[list["StartupInvestor"]] = relationship(back_populates="startup", cascade="all, delete-orphan")


class StartupMember(Base, UUIDPKMixin):
    __tablename__ = "startup_members"
    __table_args__ = (UniqueConstraint("startup_id", "user_id", name="uq_startup_member"),)

    startup_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("startups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Member")  # e.g. "Co-founder", "CTO"
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")

    startup: Mapped["Startup"] = relationship(back_populates="members")


class StartupOpenRole(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "startup_open_roles"

    startup_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("startups.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    is_filled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    startup: Mapped["Startup"] = relationship(back_populates="open_roles")


class StartupCollaborationRequest(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "startup_collaboration_requests"

    startup_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("startups.id", ondelete="CASCADE"), nullable=False, index=True)
    requester_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("startup_open_roles.id", ondelete="SET NULL"), nullable=True)
    message: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    status: Mapped[CollaborationRequestStatus] = mapped_column(nullable=False, default=CollaborationRequestStatus.PENDING)


class StartupProject(Base, UUIDPKMixin, TimestampMixin):
    """Links a showcased project (optionally an actual PandaHub repository) to a startup profile."""
    __tablename__ = "startup_projects"

    startup_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("startups.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(5000), nullable=True)

    startup: Mapped["Startup"] = relationship(back_populates="projects")


class StartupInvestor(Base, UUIDPKMixin, TimestampMixin):
    """Free-text investor/funding entries for the startup's investor page."""
    __tablename__ = "startup_investors"

    startup_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("startups.id", ondelete="CASCADE"), nullable=False, index=True)
    investor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    investor_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    round_name: Mapped[str | None] = mapped_column(String(100), nullable=True)   # e.g. "Seed", "Series A"
    amount_raised: Mapped[str | None] = mapped_column(String(100), nullable=True)  # free text, e.g. "$500K"

    startup: Mapped["Startup"] = relationship(back_populates="investors")
