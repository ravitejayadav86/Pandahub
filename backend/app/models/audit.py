"""
Audit log — append-only record of security-sensitive actions
(login, permission changes, repo deletion, PAT creation, etc.),
feeding the Admin Panel's security dashboard (Module 15).

`metadata_json` (JSONB) holds action-specific detail (e.g. which
permission changed from what to what) without needing a separate table
per action type — audit logs are written far more than they're queried
by structure, so a flexible blob beats a rigid schema here.
"""
import uuid

from datetime import datetime

from sqlalchemy import String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPKMixin


class AuditLog(Base, UUIDPKMixin):
    __tablename__ = "audit_logs"

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")

    # Note: no FK constraint on actor_user_id -> users.id. Audit rows must
    # survive user deletion (compliance requirement: "who deleted this
    # account" needs to remain queryable after the account itself is gone).
