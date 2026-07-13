"""
User identity and credential models.

Key design decision (from Module 1's security architecture): web-session
auth (JWT refresh tokens) and git/CLI auth (personal access tokens, SSH
keys) are stored in ENTIRELY SEPARATE tables, not unified into one
"credentials" table. This means a leaked git PAT can be scoped to
`repo:read` and revoked independently, without touching the user's web
login session at all.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPKMixin, TimestampMixin
from app.models.enums import OAuthProvider


class User(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(39), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # Nullable: a user who signs up purely via OAuth never sets a password.
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Encrypted at the application layer before storage — see core/security.py (Module 4).
    two_factor_secret_encrypted: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ---- Relationships ----
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    personal_access_tokens: Mapped[list["PersonalAccessToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ssh_keys: Mapped[list["SSHKey"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class OAuthAccount(Base, UUIDPKMixin):
    """Links a User to a third-party identity provider (GitHub, Google)."""
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        {"comment": "Unique constraint on (provider, provider_account_id) enforced in migration"},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[OAuthProvider] = mapped_column(nullable=False)
    provider_account_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Tokens encrypted at rest (Fernet, see core/security.py) — never stored plaintext.
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")


class RefreshToken(Base, UUIDPKMixin):
    """Long-lived, rotatable refresh token backing the short-lived JWT access token.

    We store a HASH of the token (never the raw value) so a DB leak doesn't
    hand out valid credentials directly — the same principle as password
    storage, applied to tokens.
    """
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    device_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class PersonalAccessToken(Base, UUIDPKMixin):
    """Scoped tokens used by `panda` CLI and git-over-HTTPS — deliberately
    separate from web session tokens (see module docstring)."""
    __tablename__ = "personal_access_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String(50)), nullable=False, default=list)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    user: Mapped["User"] = relationship(back_populates="personal_access_tokens")


class SSHKey(Base, UUIDPKMixin):
    __tablename__ = "ssh_keys"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    public_key: Mapped[str] = mapped_column(String(4000), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)

    user: Mapped["User"] = relationship(back_populates="ssh_keys")


class EmailVerificationToken(Base, UUIDPKMixin):
    __tablename__ = "email_verification_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)


class PasswordResetToken(Base, UUIDPKMixin):
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)
