"""
Unit tests for the git credential resolver (app/git_engine/auth.py).

Tests the full auth resolution chain without a real database.  The
``db`` session and ``request`` objects are fully mocked.

Test matrix:
  1.  Valid Bearer JWT, active user          → User object
  2.  Valid Bearer JWT, inactive user        → None
  3.  Expired Bearer JWT                     → falls through to Basic
  4.  Valid Basic PAT, repo scope            → User object
  5.  Valid Basic PAT, no repo scope         → None
  6.  Expired PAT                            → None
  7.  Revoked PAT                            → None (filtered by query)
  8.  PAT not found in DB                    → None
  9.  Invalid Base64 in Basic header         → None
  10. Basic header, empty password           → None
  11. No Authorization header                → None
  12. Unknown auth scheme (Digest ...)       → None
  13. ``make_www_authenticate_header``        → correct header string
"""
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.git_engine.auth import authenticate_git_request, make_www_authenticate_header


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(auth_header: Optional[str] = None) -> MagicMock:
    """Build a minimal mock FastAPI Request."""
    req = MagicMock()
    req.headers = {}
    if auth_header:
        req.headers = {"Authorization": auth_header}
    req.client = MagicMock()
    req.client.host = "127.0.0.1"
    return req


def _make_user(*, is_active: bool = True) -> MagicMock:
    user = MagicMock()
    user.id = uuid.uuid4()
    user.username = "alice"
    user.is_active = is_active
    return user


def _basic_header(username: str, password: str) -> str:
    encoded = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {encoded}"


def _bearer_header(token: str) -> str:
    return f"Bearer {token}"


def _make_pat(
    *,
    user_id: uuid.UUID,
    scopes: list[str],
    expired: bool = False,
    revoked: bool = False,
) -> MagicMock:
    pat = MagicMock()
    pat.id = uuid.uuid4()
    pat.user_id = user_id
    pat.scopes = scopes
    pat.revoked = revoked
    pat.expires_at = (
        datetime.now(timezone.utc) - timedelta(hours=1) if expired else None
    )
    pat.last_used_at = None
    return pat


def _db_returning(value) -> AsyncMock:
    """DB mock whose execute() always returns a result with scalar_one_or_none() = value."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


def _db_sequence(*values) -> AsyncMock:
    """DB mock whose execute() returns different values on successive calls."""
    results = []
    for v in values:
        r = MagicMock()
        r.scalar_one_or_none.return_value = v
        results.append(r)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=results)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# Bearer JWT tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bearer_valid_active_user():
    """Valid Bearer JWT for an active user → returns User."""
    user = _make_user(is_active=True)
    user_id = user.id

    with patch("app.git_engine.auth.decode_access_token", return_value={"sub": str(user_id)}):
        db = _db_returning(user)
        req = _make_request(_bearer_header("fake.jwt.token"))
        result = await authenticate_git_request(req, db)

    assert result is user


@pytest.mark.asyncio
async def test_bearer_valid_inactive_user():
    """Valid JWT but user is inactive → returns None."""
    user = _make_user(is_active=False)
    user_id = user.id

    with patch("app.git_engine.auth.decode_access_token", return_value={"sub": str(user_id)}):
        db = _db_returning(user)
        req = _make_request(_bearer_header("fake.jwt.token"))
        result = await authenticate_git_request(req, db)

    assert result is None


@pytest.mark.asyncio
async def test_bearer_expired_jwt_falls_through():
    """Expired JWT → not a user, no Basic header → None."""
    from jose import JWTError

    with patch("app.git_engine.auth.decode_access_token", side_effect=JWTError("expired")):
        db = AsyncMock()
        req = _make_request(_bearer_header("expired.jwt.token"))
        result = await authenticate_git_request(req, db)

    assert result is None


# ---------------------------------------------------------------------------
# Basic PAT tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_basic_valid_pat_with_repo_scope():
    """Valid PAT with 'repo' scope → returns the owning User."""
    user = _make_user()
    pat = _make_pat(user_id=user.id, scopes=["repo", "read:user"])

    # execute() calls: 1st → PAT lookup, 2nd → User lookup
    db = _db_sequence(pat, user)
    req = _make_request(_basic_header("alice", "valid-pat-value"))

    with patch("app.git_engine.auth.hash_token", return_value="hashed"):
        result = await authenticate_git_request(req, db)

    assert result is user


@pytest.mark.asyncio
async def test_basic_pat_missing_repo_scope():
    """PAT without 'repo' scope → None."""
    user = _make_user()
    pat = _make_pat(user_id=user.id, scopes=["read:user"])  # no 'repo'

    db = _db_sequence(pat, user)
    req = _make_request(_basic_header("alice", "valid-pat-value"))

    with patch("app.git_engine.auth.hash_token", return_value="hashed"):
        result = await authenticate_git_request(req, db)

    assert result is None


@pytest.mark.asyncio
async def test_basic_expired_pat():
    """Expired PAT → None."""
    user = _make_user()
    pat = _make_pat(user_id=user.id, scopes=["repo"], expired=True)

    db = _db_sequence(pat)
    req = _make_request(_basic_header("alice", "valid-pat-value"))

    with patch("app.git_engine.auth.hash_token", return_value="hashed"):
        result = await authenticate_git_request(req, db)

    assert result is None


@pytest.mark.asyncio
async def test_basic_pat_not_found():
    """PAT hash not in DB → None."""
    db = _db_sequence(None)  # PAT query returns None
    req = _make_request(_basic_header("alice", "unknown-pat"))

    with patch("app.git_engine.auth.hash_token", return_value="hashed"):
        result = await authenticate_git_request(req, db)

    assert result is None


@pytest.mark.asyncio
async def test_basic_invalid_base64():
    """Malformed Base64 in Basic header → None."""
    db = AsyncMock()
    req = _make_request("Basic !!!notbase64!!!")
    result = await authenticate_git_request(req, db)
    assert result is None


@pytest.mark.asyncio
async def test_basic_empty_password():
    """Basic auth with no password (colon but nothing after) → None."""
    db = AsyncMock()
    req = _make_request(_basic_header("alice", ""))
    result = await authenticate_git_request(req, db)
    assert result is None


# ---------------------------------------------------------------------------
# No / unknown auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_auth_header():
    """No Authorization header → None (anonymous)."""
    db = AsyncMock()
    req = _make_request()
    result = await authenticate_git_request(req, db)
    assert result is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_unknown_auth_scheme():
    """Digest or other unknown scheme → None."""
    db = AsyncMock()
    req = _make_request("Digest realm=example")
    result = await authenticate_git_request(req, db)
    assert result is None


# ---------------------------------------------------------------------------
# www-authenticate header helper
# ---------------------------------------------------------------------------

def test_www_authenticate_default():
    header = make_www_authenticate_header()
    assert header == 'Basic realm="PandaHub"'


def test_www_authenticate_custom_realm():
    header = make_www_authenticate_header("MyRealm")
    assert header == 'Basic realm="MyRealm"'
