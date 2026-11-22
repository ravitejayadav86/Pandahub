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
from app.models.ci_run_attempt import CIRunAttempt
from app.models.enums import PermissionLevel
from app.models.repo import Repository

router = APIRouter(tags=["native-ci"])

# A local runner has a 120-second execution limit; allow ample time for
# startup/export/cleanup before an administrator can resolve a stranded job.
STALE_CI_AFTER = timedelta(minutes=10)
MAX_CI_ATTEMPTS = 3


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


class CIRetryRequest(BaseModel):
    # The backend cannot attest Docker cleanup; require an explicit operator.
    operator_confirmed_runner_stopped: Literal[True]
    reason: str = Field(min_length=10, max_length=300)


def _view(run: CIRun) -> dict:
    return {
        "id": str(run.id),
        "branch": run.branch_name,
        "sha": run.commit_sha,
        "status": run.status,
        "attempt_count": run.attempt_count,
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

    # This does not prove the original Docker container has stopped.
    attempt = await db.scalar(select(CIRunAttempt).where(
        CIRunAttempt.run_id == run.id,
        CIRunAttempt.attempt_number == run.attempt_count,
    ).with_for_update())
    if attempt is None or attempt.completed_at is not None:
        raise HTTPException(status_code=409, detail="Active CI attempt audit missing")
    attempt.completed_at = now
    attempt.conclusion = "timed_out"
    attempt.end_reason = "admin_unverified_timeout"
    run.status = "completed"
    run.conclusion = "timed_out"
    run.completed_at = now
    run.lease_expires_at = None
    run.log_excerpt = (
        "Administrative timeout: runner completion was not received within "
        "10 minutes of starting. This is not a verified Docker timeout and "
        "does not attest that the container has stopped. Inspect the runner "
        "host and its containers before starting another job."
    )
    attempt.log_excerpt = run.log_excerpt
    await db.commit()
    await db.refresh(run)
    return _view(run)


@router.get("/{owner}/{repo}/ci/runs/{run_id}/attempts")
async def list_ci_attempts(
    run_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> list[dict]:
    """Bounded history; never return runner tokens or lease secrets."""
    run = await db.scalar(select(CIRun).where(
        CIRun.id == run_id, CIRun.repository_id == repository.id,
    ))
    if run is None:
        raise HTTPException(status_code=404, detail="CI run not found")
    records = await db.execute(select(CIRunAttempt).where(
        CIRunAttempt.run_id == run.id,
    ).order_by(CIRunAttempt.attempt_number))
    return [{
        "attempt_number": item.attempt_number,
        "started_at": item.started_at.isoformat(),
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
        "conclusion": item.conclusion,
        "end_reason": item.end_reason,
        "log_excerpt": item.log_excerpt,
        "retry_requested_at": (
            item.retry_requested_at.isoformat() if item.retry_requested_at else None
        ),
        "retry_reason": item.retry_reason,
        "trusted_for_deployment": False,
    } for item in records.scalars().all()]


@router.post("/{owner}/{repo}/ci/runs/{run_id}/retry")
async def request_ci_retry(
    run_id: uuid.UUID,
    payload: CIRetryRequest,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict:
    """Manually requeue the *same* commit after confirming runner shutdown.

    Never automatically restart an expired/uncertain Docker container.
    No same-SHA Git push is needed; queue uniqueness is preserved.
    All prior results remain in ci_run_attempts, with retry authorizations.
    """
    run = await db.scalar(select(CIRun).where(
        CIRun.id == run_id, CIRun.repository_id == repository.id,
    ).with_for_update())
    if run is None:
        raise HTTPException(status_code=404, detail="CI run not found")
    if not repository.auto_ci_enabled:
        raise HTTPException(
            status_code=409, detail="Enable CI job creation explicitly before retrying"
        )
    if run.status != "completed" or run.conclusion not in (
        "failure", "error", "timed_out",
    ):
        raise HTTPException(
            status_code=409, detail="Only completed, unsuccessful CI runs can be retried"
        )
    if not 1 <= run.attempt_count < MAX_CI_ATTEMPTS:
        raise HTTPException(
            status_code=409, detail="Maximum three runner attempts reached"
        )

    last_attempt = await db.scalar(select(CIRunAttempt).where(
        CIRunAttempt.run_id == run.id,
        CIRunAttempt.attempt_number == run.attempt_count,
    ).with_for_update())
    if (
        last_attempt is None or last_attempt.completed_at is None or
        last_attempt.conclusion != run.conclusion or
        last_attempt.retry_requested_at is not None
    ):
        raise HTTPException(
            status_code=409, detail="Previous CI attempt audit is not finalized"
        )

    # The operator's assertion is retained for audit but is NOT technical
    # proof of actual container cleanup. Never mark the result trusted.
    last_attempt.retry_requested_at = datetime.now(timezone.utc)
    last_attempt.retry_reason = payload.reason
    run.status = "queued"
    run.conclusion = None
    run.log_excerpt = None
    run.started_at = None
    run.completed_at = None
    run.runner_credential_id = None
    run.lease_id = None
    run.lease_expires_at = None
    run.last_heartbeat_at = None
    await db.commit()
    await db.refresh(run)
    return _view(run)
