from __future__ import annotations
"""
Organizations, Teams, and team-level repository permissions.

Permission model: a user can gain access to a repository through THREE
independent paths — being the direct owner, being an explicit
RepositoryCollaborator, or being a member of a Team that has a
TeamRepository grant. The permissions service (Module 4) resolves all
three and takes the highest level. Modeling it this way (rather than a
single flattened ACL table) mirrors how real engineering orgs actually
grant access — via team membership — while still allowing one-off
individual exceptions.
"""
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import OrganizationRole, TeamRole, PermissionLevel


class Organization(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(39), unique=True, index=True, nullable=False)  # url slug
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    teams: Mapped[list["Team"]] = relationship(back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Organization {self.name}>"


class OrganizationMember(Base, UUIDPKMixin):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_member"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[OrganizationRole] = mapped_column(nullable=False, default=OrganizationRole.MEMBER)

    organization: Mapped["Organization"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class Team(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_team_name_per_org"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    repository_grants: Mapped[list["TeamRepository"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base, UUIDPKMixin):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[TeamRole] = mapped_column(nullable=False, default=TeamRole.MEMBER)

    team: Mapped["Team"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class TeamRepository(Base, UUIDPKMixin):
    """Grants a Team a permission level on a Repository."""
    __tablename__ = "team_repositories"
    __table_args__ = (UniqueConstraint("team_id", "repository_id", name="uq_team_repo_grant"),)

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    permission: Mapped[PermissionLevel] = mapped_column(nullable=False, default=PermissionLevel.READ)

    team: Mapped["Team"] = relationship(back_populates="repository_grants")
