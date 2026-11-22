"""Native CI status API.

Development MVP: repository administrators operate the external Docker runner
and report results. Because administrators can self-report, these statuses are
ADVISORY ONLY: never treat them as trusted protection or deployment approval.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
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
        "attestation": "repository_admin_reported",
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


@router.post("/{owner}/{repo}/ci/runs/{run_id}/claim")
async def claim_ci_run(
    run_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> dict:
    """Atomic manual claim by a repository administrator; no execution here."""
    run = await db.scalar(
        select(CIRun).where(
            CIRun.id == run_id, CIRun.repository_id == repository.id,
        ).with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="CI run not found")
    if not repository.auto_ci_enabled:
        raise HTTPException(status_code=409, detail="CI disabled for this repository")
    if run.status != "queued":
        raise HTTPException(status_code=409, detail="CI run already claimed or completed")
    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return _view(run)


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
    """Record a bounded runner report; NEVER mark a deployment verified."""
    run = await db.scalar(
        select(CIRun).where(
            CIRun.id == run_id, CIRun.repository_id == repository.id,
        ).with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="CI run not found")
    if run.status != "running":
        raise HTTPException(status_code=409, detail="CI run is not running")
    run.status = "completed"
    run.conclusion = payload.conclusion
    run.log_excerpt = payload.log_excerpt
    run.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return _view(run)
