import asyncio
import uuid
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.models.pull_request import PullRequest, AIReviewResult
from app.models.repo import Repository
from app.services.ai_service import generate_code_review
from app.git_engine.merger import get_pr_diff
from app.worker.celery_app import celery_app

logger = logging.getLogger("app.worker.tasks.ai_tasks")
settings = get_settings()

def _get_sync_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    ).replace(
        "postgresql://", "postgresql+psycopg://"
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
    Celery task that fetches a PR's diff, calls the AI review service,
    and caches the result in the database.
    """
    pr_id = uuid.UUID(pr_id_str)
    
    with _get_sync_session() as db:
        # 1. Fetch PR and target repository
        pr = db.execute(select(PullRequest).where(PullRequest.id == pr_id)).scalar_one_or_none()
        if not pr:
            logger.error(f"PR {pr_id} not found for AI review.")
            return

        target_repo = db.execute(select(Repository).where(Repository.id == pr.target_repository_id)).scalar_one_or_none()
        if not target_repo:
            logger.error(f"Target repo not found for PR {pr_id}.")
            return
            
        source_repo = db.execute(select(Repository).where(Repository.id == pr.source_repository_id)).scalar_one_or_none()
        if not source_repo:
            logger.error(f"Source repo not found for PR {pr_id}.")
            return

        # 2. Get git diff synchronously using merger
        try:
            diff_text = get_pr_diff(
                target_disk_path=target_repo.disk_path,
                source_disk_path=source_repo.disk_path,
                target_branch=pr.target_branch,
                source_branch=pr.source_branch,
            )
        except Exception as e:
            logger.error(f"Failed to get diff for PR {pr_id}: {e}")
            return
            
        # 3. Request AI review using asyncio.run since ai_service is async
        try:
            review_result = asyncio.run(generate_code_review(diff_text))
        except Exception as e:
            logger.error(f"Failed to generate AI review for PR {pr_id}: {e}")
            # We could retry or save an error state, but failing silently for now
            return

        # 4. Save result to database
        # Delete any existing reviews for this PR
        existing = db.execute(select(AIReviewResult).where(AIReviewResult.pull_request_id == pr.id)).scalars().all()
        for e in existing:
            db.delete(e)
            
        new_review = AIReviewResult(
            pull_request_id=pr.id,
            summary=review_result.get("summary", ""),
            suggestions=review_result.get("suggestions", []),
            model_used=settings.AI_MODEL,
        )
        db.add(new_review)
        db.commit()
        logger.info(f"Successfully generated and saved AI review for PR {pr_id}.")
