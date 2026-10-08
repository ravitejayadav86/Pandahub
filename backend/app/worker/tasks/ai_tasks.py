"""
Celery AI tasks — Module 11.

Orchestrates the full Dynamic Hybrid Expert Routing pipeline for PR code
reviews.  The task is a thin coordinator:

  1. Fetch PR + repo rows from the database (sync session, Celery worker).
  2. Pull the git diff via pygit2 (already in merger.py).
  3. Hand the diff to `ai_router.route_and_review()` which:
       a) classifies the diff into a semantic category (no API cost)
       b) dispatches to the right specialist model with k=3 samples
       c) merges and deduplicates the expert results
  4. Persist the structured RoutedReviewResult to `ai_review_results`.

Retry policy: 3 retries with 60-second back-off.  The most common transient
failure is an OpenRouter rate-limit (429) or a momentary network blip.
"""
import asyncio
import uuid
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.models.pull_request import PullRequest, AIReviewResult
from app.models.repo import Repository
from app.services.ai_router import route_and_review
from app.git_engine.merger import get_pr_diff
from app.worker.celery_app import celery_app

logger = logging.getLogger("app.worker.tasks.ai_tasks")
settings = get_settings()


def _get_sync_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_url = (
        settings.DATABASE_URL
        .replace("postgresql+asyncpg://", "postgresql+psycopg://")
        .replace("postgresql://",        "postgresql+psycopg://")
    )
    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    return Session()


@celery_app.task(
    name="app.worker.tasks.ai_tasks.generate_pr_review_task",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def generate_pr_review_task(pr_id_str: str) -> None:
    """
    Celery task: fetch a PR's diff → hybrid-route to expert models →
    cache the structured RoutedReviewResult in the database.

    Args:
        pr_id_str: String representation of the PullRequest UUID.
    """
    pr_id = uuid.UUID(pr_id_str)

    with _get_sync_session() as db:
        # ── 1. Fetch PR and associated repositories ───────────────────────
        pr = db.execute(
            select(PullRequest).where(PullRequest.id == pr_id)
        ).scalar_one_or_none()
        if not pr:
            logger.error("PR %s not found for AI review.", pr_id)
            return

        target_repo = db.execute(
            select(Repository).where(Repository.id == pr.repository_id)
        ).scalar_one_or_none()
        if not target_repo:
            logger.error("Target repo not found for PR %s.", pr_id)
            return

        source_repo = db.execute(
            select(Repository).where(Repository.id == pr.source_repository_id)
        ).scalar_one_or_none()
        if not source_repo:
            logger.error("Source repo not found for PR %s.", pr_id)
            return

        # ── 2. Generate git diff ──────────────────────────────────────────
        try:
            diff_text = get_pr_diff(
                target_disk_path=target_repo.disk_path,
                source_disk_path=source_repo.disk_path,
                target_branch=pr.target_branch,
                source_branch=pr.source_branch,
            )
        except Exception as exc:
            logger.error("Failed to get diff for PR %s: %s", pr_id, exc)
            return

        # ── 3. Dynamic Hybrid Expert Routing ─────────────────────────────
        try:
            result = asyncio.run(route_and_review(
                diff_text=diff_text,
                repo_id=str(target_repo.id),   # enables per-project RAG retrieval
            ))
        except Exception as exc:
            logger.error(
                "Hybrid routing failed for PR %s: %s", pr_id, exc, exc_info=True
            )
            return

        logger.info(
            "PR %s reviewed | category=%s model=%s k=%d severity=%s "
            "suggestions=%d",
            pr_id,
            result.category,
            result.model_used,
            result.k_samples,
            result.severity,
            len(result.suggestions),
        )

        # ── 4. Persist result ─────────────────────────────────────────────
        # Delete any stale review rows for this PR before inserting the new one
        existing = (
            db.execute(
                select(AIReviewResult).where(AIReviewResult.pull_request_id == pr.id)
            )
            .scalars()
            .all()
        )
        for old in existing:
            db.delete(old)

        new_review = AIReviewResult(
            pull_request_id=pr.id,
            summary=result.summary,
            suggestions=result.suggestions,
            model_used=result.model_used,
            # Hybrid routing provenance
            diff_category=result.category,
            severity=result.severity,
            k_samples=result.k_samples,
            routing_metadata=result.routing_metadata,
        )
        db.add(new_review)
        db.commit()

        logger.info("AI review persisted for PR %s.", pr_id)

        # Trigger async RAG indexing (non-blocking — fire-and-forget)
        try:
            from app.worker.tasks.rag_tasks import index_pr_review_task
            index_pr_review_task.apply_async(
                args=[str(pr_id)],
                countdown=5,  # small delay so the DB commit is visible
                queue="ai_ops",
            )
            logger.debug("Dispatched RAG indexing task for PR %s.", pr_id)
        except Exception as exc:
            logger.warning("Failed to dispatch RAG indexing task: %s", exc)
