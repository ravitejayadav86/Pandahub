"""Native CI status API.

Development MVP: repository administrators operate the external Docker runner
and report results. Because administrators can self-report, these statuses are
ADVISORY ONLY: never treat them as trusted protection or deployment approval.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_repository, require_repo_permission
from app.db.session import get_db
from app.models.ci_run import CIRun
from app.models.enums import PermissionLevel
from app.models.repo import Repository

router = APIRouter(tags=["native-ci"])

# A local runner has a 120-second execution limit; allow ample time for
# startup/export/cleanup before an administrator can resolve a stranded job.
STALE_CI_AFTER = timedelta(minutes=10)


def ci_run_is_stale(
    status: str,
    started_at: datetime | None,
    now: datetime,
    lease_expires_at: datetime | None = None,
) -> bool:
    """Never time out a job with a currently valid runner heartbeat lease."""
    if status != "running" or started_at is None:
        return False
    if started_at.tzinfo is None or now.tzinfo is None:
        return False
    if lease_expires_at is not None:
        if lease_expires_at.tzinfo is None or now < lease_expires_at:
            return False
    return now >= started_at + STALE_CI_AFTER


class CISettingsChange(BaseModel):
    enabled: bool


class CIResult(BaseModel):
    conclusion: Literal["success", "failure", "error", "timed_out"]
    log_excerpt: str = Field(default="", max_length=10000)


def _view(run: CIRun) -> dict:
    return {
        "id": str(run.id),
        "branch": run.branch_name,
        "sha": run.commit_sha,
        "status": run.status,
        "conclusion": run.conclusion,
        "log_excerpt": run.log_excerpt,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "lease_expires_at": run.lease_expires_at.isoformat() if getattr(run, "lease_expires_at", None) else None,
        "attestation": (
            "repository_scoped_runner_reported"
            if getattr(run, "runner_credential_id", None)
            else "repository_admin_reported"
        ),
        "trusted_for_deployment": False,
    }


@router.get("/{owner}/{repo}/ci/settings")
async def get_ci_settings(
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> dict[str, bool]:
    return {"enabled": repository.auto_ci_enabled}


@router.patch("/{owner}/{repo}/ci/settings")
async def update_ci_settings(
    payload: CISettingsChange,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict[str, bool]:
    # Enabling CI only queues records on future pushes. Never executes code.
    repository.auto_ci_enabled = payload.enabled
    await db.commit()
    return {"enabled": repository.auto_ci_enabled}


@router.get("/{owner}/{repo}/ci/runs")
async def list_ci_runs(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict]:
    result = await db.execute(
        select(CIRun)
        .where(CIRun.repository_id == repository.id)
        .order_by(desc(CIRun.created_at), desc(CIRun.id))
        .limit(limit)
    )
    return [_view(run) for run in result.scalars().all()]


@router.get("/{owner}/{repo}/ci/runs/{run_id}")
async def get_ci_run(
    run_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> dict:
    run = await db.scalar(select(CIRun).where(
        CIRun.id == run_id, CIRun.repository_id == repository.id,
    ))
    if run is None:
        raise HTTPException(status_code=404, detail="CI run not found")
    return _view(run)


# Legacy admin-controlled claims/reports are disabled once runner identities
# exist. Keeping these explicit 410 responses prevents old CLI clients from
# silently forging results after migration 0008.
@router.post("/{owner}/{repo}/ci/runs/{run_id}/claim")
async def claim_ci_run(
    run_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict:
    raise HTTPException(status_code=410, detail=(
        "Legacy admin CI claim disabled. Use the repository-scoped runner API."
    ))


@router.post("/{owner}/{repo}/ci/runs/{run_id}/complete")
async def complete_ci_run(
    run_id: uuid.UUID,
    payload: CIResult,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict:
    raise HTTPException(status_code=410, detail=(
        "Legacy admin CI completion disabled. Use the leased runner API."
    ))


@router.post("/{owner}/{repo}/ci/runs/{run_id}/timeout")
async def mark_stale_ci_run_timed_out(
    run_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict:
    """Explicit administrative resolution of a stranded CI runner.

    Never report success, impersonate a runner, or replay a commit. The row
    lock makes completion and timeout mutually exclusive. A repo admin can
    only resolve their own run after it has been running at least 10 minutes.
    """
    run = await db.scalar(
        select(CIRun).where(
            CIRun.id == run_id,
            CIRun.repository_id == repository.id,
        ).with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="CI run not found")

    now = datetime.now(timezone.utc)
    if not ci_run_is_stale(run.status, run.started_at, now, getattr(run, "lease_expires_at", None)):
        raise HTTPException(
            status_code=409,
            detail="Only a running CI job older than 10 minutes may be marked timed out",
        )

    run.status = "completed"
    run.conclusion = "timed_out"
    run.completed_at = now
    run.log_excerpt = (
        "Administrative timeout: runner completion was not received within "
        "10 minutes of starting. This is not a verified Docker timeout and "
        "does not attest that the container has stopped. Inspect the runner "
        "host and its containers before starting another job."
    )
    await db.commit()
    await db.refresh(run)
    return _view(run)
