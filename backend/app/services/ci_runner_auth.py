"""Runner credentials are distinct from user JWTs and scoped to one repository.

MVP: opaque 256-bit bearer token, keyed SHA-256 lookup, immediate revocation.
Do not log raw tokens. Run locally on loopback or behind TLS only.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ci_runner_credential import CIRunnerCredential

PREFIX = "phci_"


def mint_runner_token() -> tuple[uuid.UUID, str, str]:
    credential_id = uuid.uuid4()
    raw = PREFIX + credential_id.hex + "_" + secrets.token_urlsafe(32)
    return credential_id, raw, hashlib.sha256(raw.encode("ascii")).hexdigest()


def parse_runner_token(raw: str | None) -> uuid.UUID | None:
    if not raw or len(raw) > 180 or not raw.startswith(PREFIX):
        return None
    chunks = raw[len(PREFIX):].split("_", 1)
    if len(chunks) != 2 or len(chunks[0]) != 32 or len(chunks[1]) < 40:
        return None
    try:
        return uuid.UUID(hex=chunks[0])
    except ValueError:
        return None


async def authenticate_runner(
    db: AsyncSession,
    repository_id: uuid.UUID,
    raw: str | None,
) -> CIRunnerCredential:
    credential_id = parse_runner_token(raw)
    if credential_id is None or raw is None:
        raise HTTPException(status_code=401, detail="Valid repository CI runner token required")
    credential = await db.scalar(select(CIRunnerCredential).where(
        CIRunnerCredential.id == credential_id,
        CIRunnerCredential.repository_id == repository_id,
        CIRunnerCredential.revoked_at.is_(None),
    ))
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    if credential is None or not hmac.compare_digest(digest, credential.token_sha256):
        raise HTTPException(status_code=401, detail="Valid repository CI runner token required")
    credential.last_used_at = datetime.now(timezone.utc)
    return credential
