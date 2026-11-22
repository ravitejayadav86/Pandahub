"""Permission-scoped commit AI insights and explicit opt-in setting."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_repository, require_repo_permission
from app.db.session import get_db
from app.models.commit_ai_analysis import CommitAIAnalysis
from app.models.enums import PermissionLevel
from app.models.repo import Repository

router = APIRouter(tags=["commit-insights"])


class AISettingsChange(BaseModel):
    enabled: bool


def _view(item: CommitAIAnalysis) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "branch": item.branch_name,
        "sha": item.commit_sha,
        "base_sha": item.base_sha,
        "status": item.status,
        "summary": item.summary,
        "model_used": item.model_used,
        "suggestions": item.suggestions,
        "next_steps": item.next_steps,
        "error": item.error_message,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "deployment_verified": False,  # AI review never proves that builds/tests passed.
    }


@router.get("/{owner}/{repo}/insights/settings")
async def get_insights_settings(
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> dict[str, bool]:
    return {"enabled": repository.auto_ai_analysis_enabled}


@router.patch("/{owner}/{repo}/insights/settings")
async def update_insights_settings(
    payload: AISettingsChange,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(
        PermissionLevel.ADMIN, allow_anonymous=False
    )),
) -> dict[str, bool]:
    """Repo admin explicitly opts into sending changed code to AI providers."""
    repository.auto_ai_analysis_enabled = payload.enabled
    await db.commit()
    return {"enabled": repository.auto_ai_analysis_enabled}


@router.get("/{owner}/{repo}/insights")
async def list_commit_insights(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict[str, Any]]:
    rows = await db.execute(
        select(CommitAIAnalysis)
        .where(CommitAIAnalysis.repository_id == repository.id)
        .order_by(desc(CommitAIAnalysis.created_at)).limit(limit)
    )
    return [_view(item) for item in rows.scalars().all()]


@router.get("/{owner}/{repo}/insights/{sha}")
async def get_commit_insight(
    sha: str,
    branch: str | None = Query(default=None, max_length=255),
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> dict[str, Any]:
    if len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha):
        raise HTTPException(422, detail="Commit SHA must be 40 lowercase hex characters")
    stmt = select(CommitAIAnalysis).where(
        CommitAIAnalysis.repository_id == repository.id,
        CommitAIAnalysis.commit_sha == sha,
    )
    if branch is not None:
        stmt = stmt.where(CommitAIAnalysis.branch_name == branch)
    record = await db.scalar(stmt.order_by(desc(CommitAIAnalysis.created_at)))
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis for this commit")
    return _view(record)


@router.post("/{owner}/{repo}/insights/{sha}/retry")
async def retry_commit_insight(
    sha: str,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(
        PermissionLevel.ADMIN, allow_anonymous=False
    )),
) -> dict[str, Any]:
    if not repository.auto_ai_analysis_enabled:
        raise HTTPException(409, detail="Enable AI analysis for this repository first")
    record = await db.scalar(
        select(CommitAIAnalysis)
        .where(CommitAIAnalysis.repository_id == repository.id, CommitAIAnalysis.commit_sha == sha)
        .order_by(desc(CommitAIAnalysis.created_at))
    )
    if record is None:
        raise HTTPException(404, detail="No analysis record for this commit")
    if record.status != "failed":
        raise HTTPException(409, detail="Only failed analyses can be retried")

    record.status = "queued"
    record.error_message = None
    await db.commit()
    try:
        from app.worker.tasks.commit_ai_tasks import analyze_commit_task
        analyze_commit_task.apply_async(args=[str(record.id)], queue="ai_ops")
    except Exception as exc:
        record.status = "failed"
        record.error_message = "Worker queue unavailable"
        await db.commit()
        raise HTTPException(status_code=503, detail="AI job could not be queued") from exc
    return {"status": "queued", "analysis_id": str(record.id)}
