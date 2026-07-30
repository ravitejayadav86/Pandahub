"""
SecurityAlert model for secret scanning, dependency vulnerability, and code quality findings.

Each alert is scoped to a repository and records the specific finding location
(file + line), severity, and dismissal metadata. This mirrors GitHub's
Code Scanning Alerts model.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin

import enum


class AlertType(str, enum.Enum):
    SECRET = "secret"
    VULNERABILITY = "vulnerability"
    CODE_QUALITY = "code_quality"


class AlertSeverity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class SecurityAlert(Base, UUIDPKMixin):
    """
    A single security finding scoped to a repository.

    alert_type distinguishes the scanner that found it:
      - secret      → regex secret scanner (on push)
      - vulnerability → OSV dependency scanner (on push, nightly)
      - code_quality  → Semgrep static analysis (on push)
    """
    __tablename__ = "security_alerts"

    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # The git commit where this was found
    commit_sha: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Source location
    file_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    line_number: Mapped[Optional[int]] = mapped_column(nullable=True)

    alert_type: Mapped[AlertType] = mapped_column(SAEnum(AlertType, name="alert_type_enum"), nullable=False, index=True)
    severity: Mapped[AlertSeverity] = mapped_column(SAEnum(AlertSeverity, name="alert_severity_enum"), nullable=False, index=True)

    # Machine-readable rule identifier, e.g. "aws-access-key", "CVE-2023-1234", "semgrep.python.sql-injection"
    rule_id: Mapped[str] = mapped_column(String(255), nullable=False)
    # Human-readable title/description
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # The raw secret/snippet (truncated / partially masked) for display
    raw_finding: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Dismissal
    dismissed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    dismiss_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    repository: Mapped["Repository"] = relationship("Repository", foreign_keys=[repo_id])

    @property
    def is_open(self) -> bool:
        return self.dismissed_at is None

    def __repr__(self) -> str:
        return f"<SecurityAlert {self.alert_type}:{self.rule_id} repo={self.repo_id}>"
