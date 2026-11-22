"""Optional async commit analysis after an accepted PandaHub Git push."""
from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select

from app.models.commit_ai_analysis import CommitAIAnalysis
from app.models.repo import Repository
from app.services.ai_router import route_and_review
from app.services.commit_insights_service import (
    next_steps_from_suggestions, read_commit_diff, redact_common_secrets,
)
from app.worker.celery_app import celery_app

logger = logging.getLogger("app.worker.tasks.commit_ai_tasks")


@celery_app.task(
    name="app.worker.tasks.commit_ai_tasks.analyze_commit_task",
    queue="ai_ops",
    acks_late=True,
    max_retries=0,  # Preserve failure; never auto-bill repeatedly after provider outages.
)
def analyze_commit_task(analysis_id: str) -> dict:
    """Review exactly one immutable SHA; do not execute any repository code."""
    from app.worker.tasks.git_tasks import _get_sync_session

    item_id = uuid.UUID(analysis_id)
    with _get_sync_session() as db:
        item = db.execute(select(CommitAIAnalysis).where(
            CommitAIAnalysis.id == item_id).with_for_update()
        ).scalar_one_or_none()
        if item is None:
            return {"status": "not_found"}
        if item.status not in ("queued", "failed"):
            return {"status": item.status}
        repository = db.execute(select(Repository).where(
            Repository.id == item.repository_id
        )).scalar_one_or_none()
        if repository is None or not repository.auto_ai_analysis_enabled:
            item.status = "skipped"
            item.summary = "AI commit review was disabled or repository no longer exists."
            db.commit()
            return {"status": "skipped"}
        path, sha, base_sha, repo_id = (
            repository.disk_path, item.commit_sha, item.base_sha, str(repository.id)
        )
        item.status = "running"
        item.error_message = None
        db.commit()

    try:
        diff, truncated = read_commit_diff(path, sha, base_sha)
        if not diff.strip():
            status, summary, suggestions, next_steps, model = (
                "skipped", "No content changes in this commit diff.", [], [], "none"
            )
        else:
            # Never send code before the repository admin explicitly enables AI analysis.
            prompt = redact_common_secrets(diff)
            if truncated:
                prompt += "\n\n[Diff truncated for review; do not claim full coverage.]"
            review = asyncio.run(route_and_review(prompt, repo_id=repo_id))
            suggestions = review.suggestions if isinstance(review.suggestions, list) else []
            next_steps = next_steps_from_suggestions(suggestions)
            model = review.model_used
            summary = review.summary[:12000]
            status = "skipped" if review.k_samples == 0 else "completed"
            if truncated:
                summary += "\n\nNote: This review covered only part of the commit diff."
        error_message = None
    except Exception as exc:
        logger.exception("Commit analysis failed for %s: %s", analysis_id, type(exc).__name__)
        status, summary, suggestions, next_steps, model = (
            "failed", None, [], [], None
        )
        # The exception text may contain confidential provider details.
        error_message = f"Analysis failed ({type(exc).__name__}); check server logs."

    with _get_sync_session() as db:
        item = db.execute(select(CommitAIAnalysis).where(
            CommitAIAnalysis.id == item_id
        ).with_for_update()).scalar_one_or_none()
        if item is None:
            return {"status": "not_found"}
        item.status = status
        item.summary = summary
        item.suggestions = suggestions
        item.next_steps = next_steps
        item.model_used = model
        item.error_message = error_message
        db.commit()

    return {"status": status, "analysis_id": str(item_id)}
