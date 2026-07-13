"""
Base declarative class + shared mixins for every PandaHub ORM model.

Design decisions:
- UUID primary keys (not auto-increment ints): repository/org/user IDs are
  exposed in URLs and API responses. UUIDs avoid leaking sequential counts
  (e.g. "we have exactly 1,842 users") and make merging data across future
  shards/read-replicas conflict-free.
- `naming_convention` is set explicitly because Alembic's autogenerate diffing
  is unreliable without deterministic constraint/index names — without this,
  renaming a column can produce a migration that drops and recreates an
  unrelated, auto-named constraint.
- TimestampMixin uses `server_default=func.now()` (DB-side) rather than a
  Python-side default, so timestamps are correct even for rows inserted by
  raw SQL, triggers, or another service directly against Postgres.
"""
import uuid
from datetime import datetime

from sqlalchemy import MetaData, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Shared declarative base for all models. Import this, never create a second Base."""
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPKMixin:
    """Adds a UUID v4 primary key generated application-side (uuid.uuid4).

    Application-side generation (vs. Postgres' gen_random_uuid()) means the
    ORM object has a valid `.id` immediately after construction, before any
    flush — useful for building related objects in the same transaction
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
