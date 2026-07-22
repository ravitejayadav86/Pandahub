"""
Git credential resolver — translates HTTP Authorization headers into User objects.

Git clients send credentials in one of two ways:
  1. ``Authorization: Bearer <JWT>``  — browser-initiated fetches, CI tokens
  2. ``Authorization: Basic <base64(username:PAT)>`` — standard git client flow

The username in Basic auth is ignored (git requires a non-empty username field,
so clients fill it with anything — the PAT is the actual secret in the password
field).  This is identical to how GitHub, GitLab, and Gitea handle PAT-based
HTTPS auth.

Resolution order:
  1. Try Bearer JWT  →  decode with existing ``decode_access_token``
  2. Try Basic auth  →  extract password, hash it, look up ``PersonalAccessToken``
     by hash, verify token has ``repo`` scope and is not expired/revoked.
  3. No valid credentials  →  return ``None``

Returning ``None`` does NOT automatically mean 403 — the route handler decides
whether anonymous access is acceptable (it is for public repo clone/fetch).

This module is intentionally a standalone function rather than a FastAPI
dependency because git routes use a custom streaming response pattern that
doesn't play well with Depends() for the outermost user resolution.
"""
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import decode_access_token, hash_token
from app.models.user import PersonalAccessToken, User

logger = get_logger("app.git_engine.auth")

# PATs used for git must carry the "repo" scope.
_GIT_REQUIRED_SCOPE = "repo"


async def authenticate_git_request(
    request: Request,
    db: AsyncSession,
) -> Optional[User]:
    """
    Resolve the ``Authorization`` header of a git HTTP request to a ``User``.

    Args:
        request: The incoming FastAPI request.
        db:      An active async SQLAlchemy session.

    Returns:
        The authenticated ``User`` ORM object, or ``None`` for anonymous callers.
    """
    auth_header: Optional[str] = request.headers.get("Authorization")
    if not auth_header:
        return None

    # ------------------------------------------------------------------
    # 1. Bearer JWT (web session tokens, CI access tokens)
    # ------------------------------------------------------------------
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        try:
            payload = decode_access_token(token)
            user_id = uuid.UUID(payload["sub"])
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user
        except (JWTError, KeyError, ValueError):
            pass
        # Fall through to Basic if Bearer fails (shouldn't happen in practice,
        # but avoids a confusing 401 if a client sends a malformed bearer).

    # ------------------------------------------------------------------
    # 2. Basic auth — extract PAT from the password field
    # ------------------------------------------------------------------
    if auth_header.startswith("Basic "):
        try:
            decoded = base64.b64decode(auth_header[len("Basic "):]).decode("utf-8")
            # Format is "username:password" — username is ignored
            _, _, pat_raw = decoded.partition(":")
        except Exception:
            return None

        if not pat_raw:
            return None

        token_hash = hash_token(pat_raw)
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(PersonalAccessToken).where(
                PersonalAccessToken.token_hash == token_hash,
                PersonalAccessToken.revoked.is_(False),
            )
        )
        pat: Optional[PersonalAccessToken] = result.scalar_one_or_none()

        if pat is None:
            logger.warning("git: PAT not found or revoked")
            return None

        # Check expiry (nullable → never expires)
        if pat.expires_at is not None and pat.expires_at < now:
            logger.warning("git: PAT expired", extra={"pat_id": str(pat.id)})
            return None

        # Scope check: PAT must carry the "repo" scope
        if _GIT_REQUIRED_SCOPE not in (pat.scopes or []):
            logger.warning(
                "git: PAT missing 'repo' scope",
                extra={"pat_id": str(pat.id), "scopes": pat.scopes},
            )
            return None

        # Load the owning user
        user_result = await db.execute(
            select(User).where(User.id == pat.user_id)
        )
        user = user_result.scalar_one_or_none()
        if user is None or not user.is_active:
            return None

        # Update last_used_at (best-effort, don't block on failure)
        try:
            pat.last_used_at = now
            await db.commit()
        except Exception:
            await db.rollback()

        return user

    return None


def make_www_authenticate_header(realm: str = "PandaHub") -> str:
    """
    Return the value for a ``WWW-Authenticate`` response header.

    git clients use this header to determine they need to prompt for
    credentials.  Without it many clients silently fail instead of
    prompting the user for a username/password.
    """
    return f'Basic realm="{realm}"'
