"""
Base declarative class + shared mixins for every PandaHub ORM model.

Design decisions:
- UUID primary keys (not auto-increment ints): repository/org/user IDs are
  exposed in URLs and API responses. UUIDs avoid leaking sequential counts
  (e.g. "we have exactly 1,842 users") and make merging data across future
  shards/read-replicas conflict-free.
- `naming_convention` is set explicitly because Alembic's autogenerate diffing
  is unreliable without deterministic constraint/index names -- without this,
  renaming a column can produce a migration that drops and recreates an
  unrelated, auto-named constraint.
- TimestampMixin uses `server_default=func.now()` (DB-side) rather than a
  Python-side default, so timestamps are correct even for rows inserted by
  raw SQL, triggers, or another service directly against Postgres.
- `type_annotation_map` is CRITICAL: without it, SQLAlchemy serializes Python
  str-Enum members using their .name ("PUBLIC") instead of their .value
  ("public"). Our Postgres enum types only accept the lowercase .value
  strings (see models/enums.py), so every enum column would fail on insert
  without this. `values_callable` forces SQLAlchemy to always use .value.
"""
import uuid
from datetime import datetime

from sqlalchemy import MetaData, DateTime, func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.models.enums import (
    RepositoryVisibility,
    OwnerType,
    PermissionLevel,
    OrganizationRole,
    TeamRole,
    IssueState,
    PullRequestState,
    ReviewState,
    MilestoneState,
    DiscussionCategory,
    StartupStage,
    CollaborationRequestStatus,
    OAuthProvider,
)

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def _enum_type(enum_cls):
    """Every enum column uses .value ('public'), never .name ('PUBLIC'),
    matching the lowercase values the Postgres enum types actually accept."""
    return SQLEnum(enum_cls, values_callable=lambda obj: [e.value for e in obj])


class Base(DeclarativeBase):
    """Shared declarative base for all models. Import this, never create a second Base."""
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    type_annotation_map = {
        RepositoryVisibility: _enum_type(RepositoryVisibility),
        OwnerType: _enum_type(OwnerType),
        PermissionLevel: _enum_type(PermissionLevel),
        OrganizationRole: _enum_type(OrganizationRole),
        TeamRole: _enum_type(TeamRole),
        IssueState: _enum_type(IssueState),
        PullRequestState: _enum_type(PullRequestState),
        ReviewState: _enum_type(ReviewState),
        MilestoneState: _enum_type(MilestoneState),
        DiscussionCategory: _enum_type(DiscussionCategory),
        StartupStage: _enum_type(StartupStage),
        CollaborationRequestStatus: _enum_type(CollaborationRequestStatus),
        OAuthProvider: _enum_type(OAuthProvider),
    }


class UUIDPKMixin:
    """Adds a UUID v4 primary key generated application-side (uuid.uuid4).

    Application-side generation (vs. Postgres' gen_random_uuid()) means the
    ORM object has a valid `.id` immediately after construction, before any
    flush -- useful for building related objects in the same transaction
    without needing to round-trip to the DB first.
    """
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    """Adds created_at / updated_at columns, maintained by the database itself."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
