"""CI runner-only API: repository-scoped credentials and time-bounded job leases.

A runner bearer token is *not* an account JWT and cannot access user routes.
Results remain administrator-provisioned and advisory, NOT deploy attestations.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_repository, require_repo_permission
from app.db.session import get_db
from app.models.ci_run import CIRun
from app.models.ci_runner_credential import CIRunnerCredential
from app.models.enums import PermissionLevel
from app.models.repo import Repository
from app.services.ci_runner_auth import authenticate_runner, mint_runner_token

router = APIRouter(tags=["native-ci-runner"])

# Heartbeats extend the lease; an expired lease cannot produce a new success.
LEASE_DURATION = timedelta(minutes=3)
MAX_RUN_DURATION = timedelta(minutes=10)
MAX_ACTIVE_RUNNERS_PER_REPO = 5


class RunnerRegistration(BaseModel):
    name: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9 _.-]+$")


class RunnerLeaseProof(BaseModel):
    lease_id: uuid.UUID


class RunnerConclusion(RunnerLeaseProof):
    conclusion: Literal["success", "failure", "error", "timed_out"]
    log_excerpt: str = Field(default="", max_length=10000)


def _credential_view(row: CIRunnerCredential) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
        "revoked": row.revoked_at is not None,
    }


def _lease_valid(run: CIRun, credential_id: uuid.UUID, lease_id: uuid.UUID,
                 now: datetime) -> bool:
    return (
        run.status == "running" and
        run.runner_credential_id == credential_id and
        run.lease_id == lease_id and
        run.lease_expires_at is not None and
        run.lease_expires_at.tzinfo is not None and
        run.started_at is not None and
        run.started_at.tzinfo is not None and
        now < run.started_at + MAX_RUN_DURATION and
        now < run.lease_expires_at
    )


def _lease_view(run: CIRun) -> dict:
    return {
        "id": str(run.id),
        "branch": run.branch_name,
        "sha": run.commit_sha,
        "status": run.status,
        "lease_id": str(run.lease_id),
        "lease_expires_at": run.lease_expires_at.isoformat(),
        "trusted_for_deployment": False,
    }


@router.post("/{owner}/{repo}/ci/runner/credentials", status_code=201)
async def create_runner_credential(
    payload: RunnerRegistration,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict:
    """Return the credential secret exactly once. Never persist plaintext."""
    count = await db.scalar(select(func.count()).select_from(CIRunnerCredential).where(
        CIRunnerCredential.repository_id == repository.id,
        CIRunnerCredential.revoked_at.is_(None),
    ))
    if (count or 0) >= MAX_ACTIVE_RUNNERS_PER_REPO:
        raise HTTPException(status_code=409, detail="Active CI runner credential limit reached")
    identity, token, token_hash = mint_runner_token()
    record = CIRunnerCredential(
        id=identity,
        repository_id=repository.id,
        name=payload.name,
        token_sha256=token_hash,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {**_credential_view(record), "token": token, "notice": (
        "Copy once to an access-restricted file outside the repository. "
        "Do not paste this token into source code, logs, or CI test outputs."
    )}


@router.get("/{owner}/{repo}/ci/runner/credentials")
async def list_runner_credentials(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> list[dict]:
    result = await db.execute(select(CIRunnerCredential)
                              .where(CIRunnerCredential.repository_id == repository.id)
                              .order_by(CIRunnerCredential.created_at.desc())
                              .limit(100))
    return [_credential_view(row) for row in result.scalars().all()]


@router.delete("/{owner}/{repo}/ci/runner/credentials/{credential_id}", status_code=204)
async def revoke_runner_credential(
    credential_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> Response:
    row = await db.scalar(select(CIRunnerCredential).where(
        CIRunnerCredential.id == credential_id,
        CIRunnerCredential.repository_id == repository.id,
    ).with_for_update())
    if row is None:
        raise HTTPException(status_code=404, detail="CI runner credential not found")
    if row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=204)


@router.post("/{owner}/{repo}/ci/runner/claim")
async def runner_claim_next(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    token: str | None = Header(default=None, alias="X-PandaHub-CI-Token"),
) -> dict:
    credential = await authenticate_runner(db, repository.id, token)
    if not repository.auto_ci_enabled:
        raise HTTPException(status_code=409, detail="CI job creation disabled for repository")
    # SKIP LOCKED prevents two distinct CI workers from claiming the same job.
    run = await db.scalar(select(CIRun).where(
        CIRun.repository_id == repository.id,
        CIRun.status == "queued",
    ).order_by(CIRun.created_at, CIRun.id).limit(1)
                          .with_for_update(skip_locked=True))
    if run is None:
        await db.commit()
        return Response(status_code=204)
    now = datetime.now(timezone.utc)
    run.status = "running"
    run.started_at = now
    run.last_heartbeat_at = now
    run.runner_credential_id = credential.id
    run.lease_id = uuid.uuid4()
    run.lease_expires_at = now + LEASE_DURATION
    await db.commit()
    return _lease_view(run)


@router.post("/{owner}/{repo}/ci/runner/runs/{run_id}/heartbeat")
async def runner_heartbeat(
    run_id: uuid.UUID,
    payload: RunnerLeaseProof,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    token: str | None = Header(default=None, alias="X-PandaHub-CI-Token"),
) -> dict:
    credential = await authenticate_runner(db, repository.id, token)
    run = await db.scalar(select(CIRun).where(
        CIRun.id == run_id, CIRun.repository_id == repository.id,
    ).with_for_update())
    if run is None:
        raise HTTPException(status_code=404, detail="CI job not found")
    now = datetime.now(timezone.utc)
    if not _lease_valid(run, credential.id, payload.lease_id, now):
        raise HTTPException(status_code=409, detail="CI runner lease is not active")
    run.last_heartbeat_at = now
    run.lease_expires_at = min(
        now + LEASE_DURATION, run.started_at + MAX_RUN_DURATION
    )
    await db.commit()
    return {"lease_expires_at": run.lease_expires_at.isoformat(), "status": "running"}


@router.post("/{owner}/{repo}/ci/runner/runs/{run_id}/complete")
async def runner_complete(
    run_id: uuid.UUID,
    payload: RunnerConclusion,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    token: str | None = Header(default=None, alias="X-PandaHub-CI-Token"),
) -> dict:
    credential = await authenticate_runner(db, repository.id, token)
    run = await db.scalar(select(CIRun).where(
        CIRun.id == run_id, CIRun.repository_id == repository.id,
    ).with_for_update())
    if run is None:
        raise HTTPException(status_code=404, detail="CI job not found")
    now = datetime.now(timezone.utc)
    if not _lease_valid(run, credential.id, payload.lease_id, now):
        raise HTTPException(status_code=409, detail="CI runner lease is not active")
    run.status = "completed"
    run.conclusion = payload.conclusion
    run.log_excerpt = payload.log_excerpt
    run.completed_at = now
    run.lease_expires_at = None
    await db.commit()
    return {"id": str(run.id), "status": run.status,
            "conclusion": run.conclusion, "trusted_for_deployment": False}
