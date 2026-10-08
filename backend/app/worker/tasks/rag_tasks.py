"""
RAG Indexer Tasks — Celery tasks for vector knowledge base management.

Tasks
─────
  index_pr_review_task(pr_id_str)
    After a PR is reviewed (by any method), this task embeds the diff + merged
    review comments and upserts them into the PRIMARY Qdrant collection. This
    continuously grows the project-specific knowledge base.

  seed_crc_dataset_task()
    One-shot task that loads the crc-py-dataset (bundled JSON file or remote
    download) and bulk-upserts it into the SECONDARY Qdrant collection.
    Safe to re-run — point IDs are content-hashed so duplicates are overwritten,
    not inserted twice.

  rebuild_rag_index_task(repo_id_str)
    Re-indexes all existing AIReviewResult rows for a given repository.
    Useful when the Qdrant volume is wiped or when the embedding model changes.
"""
import asyncio
import json
import logging
import uuid
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.models.pull_request import PullRequest, AIReviewResult, PRComment, PRReviewComment
from app.git_engine.merger import get_pr_diff
from app.services.ai_router import classify_diff
from app.models.repo import Repository
from app.services.rag_store import (
    index_review,
    seed_secondary_collection,
    ensure_collections_exist,
    PRIMARY_COLL,
)
from app.worker.celery_app import celery_app

logger = logging.getLogger("app.worker.tasks.rag_tasks")
settings = get_settings()

# Path to the bundled crc-py-dataset seed file (packaged with the repo)
_CRC_SEED_FILE = Path(__file__).parent.parent.parent.parent / "data" / "crc_py_seed.json"


def _get_sync_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_url = (
        settings.DATABASE_URL
        .replace("postgresql+asyncpg://", "postgresql+psycopg://")
        .replace("postgresql://",         "postgresql+psycopg://")
    )
    engine  = create_engine(sync_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    return Session()


# ─────────────────────────────────────────────────────────────────────────────
# Task 1 — Index a newly completed or merged PR review (Continuous Indexing Loop)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.worker.tasks.rag_tasks.index_pr_review_task",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def index_pr_review_task(pr_id_str: str) -> None:
    """
    Fetch the PR's diff + review comments and index them into Qdrant.

    Contribution 5 (Asynchronous Continuous Indexing Loop):
      Non-Blocking Architecture: decoupled background worker.
      Dynamic Refresh: whenever a PR is approved and merged (or reviewed),
      this worker captures the final code-comment pairs, embeds them into
      384-dimensional vectors, and updates the vector database in the background
      without adding latency to the active review or merge pipeline.

    Args:
        pr_id_str: String UUID of the PullRequest to index.
    """
    pr_id = uuid.UUID(pr_id_str)

    with _get_sync_session() as db:
        pr = db.execute(
            select(PullRequest).where(PullRequest.id == pr_id)
        ).scalar_one_or_none()
        if not pr:
            logger.warning("PR %s not found for RAG indexing.", pr_id)
            return

        repo = db.execute(
            select(Repository).where(Repository.id == pr.repository_id)
        ).scalar_one_or_none()
        if not repo:
            logger.warning("Repo not found for PR %s — skipping RAG index.", pr_id)
            return

        source_repo = db.execute(
            select(Repository).where(Repository.id == pr.source_repository_id)
        ).scalar_one_or_none() or repo

        review = db.execute(
            select(AIReviewResult).where(AIReviewResult.pull_request_id == pr_id)
        ).scalar_one_or_none()

        # Human comments on this PR
        human_comments = db.execute(
            select(PRComment).where(PRComment.pull_request_id == pr_id)
        ).scalars().all()
        inline_comments = db.execute(
            select(PRReviewComment).where(PRReviewComment.pull_request_id == pr_id)
        ).scalars().all()

        # 1. Resolve review comment text
        comment_parts: list[str] = []
        category = "functional"
        severity = "medium"

        if review:
            category = review.diff_category or "functional"
            severity = review.severity or "medium"
            if review.summary:
                comment_parts.append(review.summary)
            suggestions = review.suggestions or []
            if isinstance(suggestions, list):
                for s in suggestions[:5]:
                    if isinstance(s, dict):
                        comment_parts.append(
                            f"[{s.get('severity','?')}] {s.get('file','?')}: {s.get('comment','')}"
                        )

        # Include human discussion/inline comments if any
        for hc in human_comments:
            if hc.body and len(hc.body.strip()) > 10:
                comment_parts.append(hc.body.strip())
        for ic in inline_comments:
            if ic.body and len(ic.body.strip()) > 10:
                comment_parts.append(f"{ic.file_path}:{ic.line_number}: {ic.body.strip()}")

        # If no comments at all, fall back to PR description
        if not comment_parts and pr.description:
            comment_parts.append(pr.description.strip())

        review_comment = "\n\n".join(filter(None, comment_parts)).strip()
        if not review_comment:
            logger.info("PR %s has no comments or description to index.", pr_id)
            return

        # 2. Resolve diff text
        diff_text = ""
        if review and (review.routing_metadata or {}).get("diff_text_snippet"):
            diff_text = review.routing_metadata["diff_text_snippet"]

        if not diff_text:
            try:
                diff_text = get_pr_diff(
                    target_disk_path=repo.disk_path,
                    source_disk_path=source_repo.disk_path,
                    target_branch=pr.target_branch,
                    source_branch=pr.source_branch,
                )
            except Exception as exc:
                logger.warning("Failed to extract git diff for PR %s: %s", pr_id, exc)
                return

        if not diff_text.strip():
            logger.info("PR %s has empty diff, skipping RAG index.", pr_id)
            return

        if not review:
            category = classify_diff(diff_text).value

    # 3. Dynamic Refresh: embed and upsert into Qdrant PRIMARY_COLL
    success = asyncio.run(
        index_review(
            diff_text=diff_text,
            review_comment=review_comment,
            repo_id=str(repo.id),
            category=category,
            severity=severity,
            pr_id=str(pr_id),
            collection=PRIMARY_COLL,
        )
    )

    if success:
        logger.info(
            "Continuous Indexing Loop: Successfully indexed PR %s (%s) into RAG primary layer.",
            pr_id, category,
        )
    else:
        logger.error("Continuous Indexing Loop: Failed to index PR %s into RAG primary layer.", pr_id)


# ─────────────────────────────────────────────────────────────────────────────
# Task 2 — Seed the secondary collection from crc-py-dataset
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.worker.tasks.rag_tasks.seed_crc_dataset_task",
    max_retries=2,
    default_retry_delay=60,
    acks_late=True,
)
def seed_crc_dataset_task() -> None:
    """
    Bootstrap the secondary Qdrant collection from the crc-py-dataset.

    The seed file is a JSON array of objects with keys:
        diff_text, review_comment, category, severity

    This task is idempotent — point IDs are content-hashed so running it
    twice just overwrites the same vectors without creating duplicates.
    """
    ensure_collections_exist()

    if not _CRC_SEED_FILE.exists():
        logger.warning(
            "crc-py seed file not found at %s. "
            "Create backend/data/crc_py_seed.json to enable secondary RAG layer.",
            _CRC_SEED_FILE,
        )
        return

    try:
        records = json.loads(_CRC_SEED_FILE.read_text(encoding="utf-8"))
        logger.info("Seeding crc-py-dataset: %d records", len(records))
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to load crc_py_seed.json: %s", exc)
        return

    seeded = asyncio.run(seed_secondary_collection(records))
    logger.info("crc-py-dataset seeding complete: %d records indexed.", seeded)


# ─────────────────────────────────────────────────────────────────────────────
# Task 3 — Rebuild index for a repository
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.worker.tasks.rag_tasks.rebuild_rag_index_task",
    max_retries=1,
    default_retry_delay=120,
    acks_late=True,
)
def rebuild_rag_index_task(repo_id_str: str) -> None:
    """
    Re-index all AIReviewResult rows for a given repository into Qdrant.

    Use this after:
      - Qdrant data volume is wiped (e.g. on first deploy)
      - The embedding model changes
      - The collection is manually deleted

    Args:
        repo_id_str: String UUID of the Repository to re-index.
    """
    ensure_collections_exist()
    repo_id = uuid.UUID(repo_id_str)

    with _get_sync_session() as db:
        results = (
            db.execute(
                select(AIReviewResult)
                .join(PullRequest, AIReviewResult.pull_request_id == PullRequest.id)
                .where(PullRequest.repository_id == repo_id)
            )
            .scalars()
            .all()
        )
        logger.info(
            "Rebuilding RAG index for repo %s: %d review records",
            repo_id, len(results),
        )

    indexed = 0
    for review in results:
        diff_text = (review.routing_metadata or {}).get("diff_text_snippet", "")
        if not diff_text:
            continue

        suggestions = review.suggestions or []
        comment_parts = [review.summary or ""]
        if isinstance(suggestions, list):
            for s in suggestions[:5]:
                if isinstance(s, dict):
                    comment_parts.append(
                        f"[{s.get('severity','?')}] {s.get('file','?')}: {s.get('comment','')}"
                    )
        review_comment = "\n".join(filter(None, comment_parts))

        success = asyncio.run(
            index_review(
                diff_text=diff_text,
                review_comment=review_comment,
                repo_id=str(repo_id),
                category=review.diff_category or "functional",
                severity=review.severity or "medium",
                pr_id=str(review.pull_request_id),
                collection=PRIMARY_COLL,
            )
        )
        if success:
            indexed += 1

    logger.info("Rebuilt RAG index for repo %s: %d/%d records indexed.", repo_id, indexed, len(results))
