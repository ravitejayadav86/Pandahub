"""
Pull Request service — business logic layer for Module 10.

Responsibilities:
  - Sequential PR numbering (separate from issues, per-repo).
  - PR CRUD and state transitions.
  - Integration with git_engine.merger for conflict checking and merging.
  - Reviews and comments management.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, AppError
from app.core.logging import get_logger
from app.git_engine.merger import check_mergeability, get_pr_diff, merge_commit
from app.models.enums import PullRequestState, PermissionLevel
from app.models.pull_request import PullRequest, PRComment, PRReview, PRReviewComment
from app.models.repo import Repository
from app.models.user import User
from app.schemas.pr_schema import (
    PullRequestCreate,
    PullRequestUpdate,
    PRCommentCreate,
    PRReviewCreate,
    PRReviewCommentCreate,
)

logger = get_logger("app.services.pr_service")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _assign_next_number(db: AsyncSession, repo_id: uuid.UUID) -> int:
    """Assign the next sequential PR number for a repository using row-level locking."""
    result = await db.execute(
        select(func.max(PullRequest.number))
        .where(PullRequest.repository_id == repo_id)
        .with_for_update()
    )
    max_number: Optional[int] = result.scalar()
    return (max_number or 0) + 1


async def _get_pr_or_404(
    db: AsyncSession,
    repo_id: uuid.UUID,
    pr_number: int,
) -> PullRequest:
    """Load a single PR by (repo_id, number) with all relationships."""
    result = await db.execute(
        select(PullRequest)
        .where(
            PullRequest.repository_id == repo_id,
            PullRequest.number == pr_number,
        )
        .options(
            selectinload(PullRequest.author),
        )
    )
    pr = result.scalar_one_or_none()
    if pr is None:
        raise NotFoundError(f"Pull Request #{pr_number} not found.")
    return pr


# ---------------------------------------------------------------------------
# PR Core CRUD
# ---------------------------------------------------------------------------

async def list_pull_requests(
    db: AsyncSession,
    repo_id: uuid.UUID,
    state: PullRequestState = PullRequestState.OPEN,
    page: int = 1,
    per_page: int = 30,
) -> tuple[list[PullRequest], int]:
    base_q = select(PullRequest).where(
        PullRequest.repository_id == repo_id,
        PullRequest.state == state,
    )
    
    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar_one()

    page_q = (
        base_q
        .options(selectinload(PullRequest.author))
        .order_by(desc(PullRequest.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items_result = await db.execute(page_q)
    return list(items_result.scalars().all()), total


async def create_pull_request(
    db: AsyncSession,
    target_repo: Repository,
    author: User,
    payload: PullRequestCreate,
) -> PullRequest:
    """Create a new Pull Request."""
    source_repo_id = payload.source_repository_id or target_repo.id
    
    # Check if identical PR already exists
    existing = await db.execute(
        select(PullRequest).where(
            PullRequest.repository_id == target_repo.id,
            PullRequest.source_repository_id == source_repo_id,
            PullRequest.source_branch == payload.source_branch,
            PullRequest.target_branch == payload.target_branch,
            PullRequest.state == PullRequestState.OPEN,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("An open Pull Request already exists for these branches.")
        
    number = await _assign_next_number(db, target_repo.id)
    
    pr = PullRequest(
        repository_id=target_repo.id,
        number=number,
        title=payload.title,
        description=payload.description,
        author_id=author.id,
        source_branch=payload.source_branch,
        target_branch=payload.target_branch,
        source_repository_id=source_repo_id,
        is_draft=payload.is_draft,
        state=PullRequestState.OPEN,
    )
    db.add(pr)
    await db.commit()
    
    return await _get_pr_or_404(db, target_repo.id, number)


async def get_pull_request(
    db: AsyncSession,
    repo_id: uuid.UUID,
    pr_number: int,
) -> PullRequest:
    return await _get_pr_or_404(db, repo_id, pr_number)


async def update_pull_request(
    db: AsyncSession,
    repo_id: uuid.UUID,
    pr_number: int,
    payload: PullRequestUpdate,
    actor: User,
    actor_permission: PermissionLevel,
) -> PullRequest:
    pr = await _get_pr_or_404(db, repo_id, pr_number)
    now = datetime.now(timezone.utc)
    
    if payload.title is not None:
        pr.title = payload.title
    if payload.description is not None:
        pr.description = payload.description
    if payload.is_draft is not None:
        pr.is_draft = payload.is_draft
        
    if payload.state is not None and payload.state != pr.state:
        # Only author or triager can close/reopen
        _can_change_state = (pr.author_id == actor.id or actor_permission >= PermissionLevel.TRIAGE)
        if not _can_change_state:
            raise PermissionDeniedError("Only the author or a triager can change PR state.")
            
        pr.state = payload.state
        if payload.state == PullRequestState.CLOSED:
            pr.closed_at = now
        else:
            pr.closed_at = None

    await db.commit()
    return await _get_pr_or_404(db, repo_id, pr_number)


# ---------------------------------------------------------------------------
# Merge execution
# ---------------------------------------------------------------------------

async def merge_pull_request(
    db: AsyncSession,
    target_repo: Repository,
    pr_number: int,
    actor: User,
    actor_permission: PermissionLevel,
) -> PullRequest:
    """
    Execute the merge via pygit2, update the target branch, and close the PR.
    """
    if actor_permission < PermissionLevel.WRITE:
        raise PermissionDeniedError("Write access is required to merge pull requests.")
        
    pr = await _get_pr_or_404(db, target_repo.id, pr_number)
    
    if pr.state != PullRequestState.OPEN:
        raise ConflictError("Only open pull requests can be merged.")
        
    # Resolve source repo disk path
    if pr.source_repository_id == target_repo.id:
        source_disk_path = target_repo.disk_path
    else:
        source_repo = await db.execute(
            select(Repository).where(Repository.id == pr.source_repository_id)
        )
        source_repo_obj = source_repo.scalar_one_or_none()
        if not source_repo_obj:
            raise AppError("Source repository no longer exists.")
        source_disk_path = source_repo_obj.disk_path

    commit_msg = f"Merge pull request #{pr.number} from {pr.source_branch}\n\n{pr.title}"
    
    # Run the pygit2 merge in a thread pool
    loop = asyncio.get_running_loop()
    try:
        new_commit_sha = await loop.run_in_executor(
            None,
            merge_commit,
            target_repo.disk_path,
            source_disk_path,
            pr.target_branch,
            pr.source_branch,
            actor.username,
            "noreply@pandahub.dev",
            commit_msg,
        )
    except ConflictError as e:
        raise ConflictError(str(e))
    except Exception as e:
        logger.error(f"Merge failed for PR #{pr.number}: {e}")
        raise AppError("Git merge operation failed.")
        
    pr.state = PullRequestState.MERGED
    pr.merged_at = datetime.now(timezone.utc)
    pr.merged_by_id = actor.id
    pr.merge_commit_sha = new_commit_sha
    
    await db.commit()
    return pr


async def get_pull_request_diff(
    db: AsyncSession,
    target_repo: Repository,
    pr_number: int,
) -> str:
    """Get the raw git diff text for the PR."""
    pr = await _get_pr_or_404(db, target_repo.id, pr_number)
    
    if pr.source_repository_id == target_repo.id:
        source_disk_path = target_repo.disk_path
    else:
        source_repo = await db.execute(
            select(Repository).where(Repository.id == pr.source_repository_id)
        )
        source_repo_obj = source_repo.scalar_one_or_none()
        if not source_repo_obj:
            raise AppError("Source repository no longer exists.")
        source_disk_path = source_repo_obj.disk_path
        
    loop = asyncio.get_running_loop()
    try:
        diff_text = await loop.run_in_executor(
            None,
            get_pr_diff,
            target_repo.disk_path,
            source_disk_path,
            pr.target_branch,
            pr.source_branch,
        )
        return diff_text
    except Exception as e:
        logger.error(f"Failed to generate diff for PR #{pr.number}: {e}")
        raise AppError("Failed to generate diff.")


# ---------------------------------------------------------------------------
# General Comments
# ---------------------------------------------------------------------------

async def create_comment(
    db: AsyncSession,
    repo_id: uuid.UUID,
    pr_number: int,
    author: User,
    payload: PRCommentCreate,
) -> PRComment:
    pr = await _get_pr_or_404(db, repo_id, pr_number)
    
    comment = PRComment(
        pull_request_id=pr.id,
        author_id=author.id,
        body=payload.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    # Eager load author for response
    await db.execute(select(PRComment).where(PRComment.id == comment.id).options(selectinload(PRComment.author)))
    return comment


async def list_comments(
    db: AsyncSession,
    repo_id: uuid.UUID,
    pr_number: int,
) -> list[PRComment]:
    pr = await _get_pr_or_404(db, repo_id, pr_number)
    result = await db.execute(
        select(PRComment)
        .where(PRComment.pull_request_id == pr.id)
        .options(selectinload(PRComment.author))
        .order_by(PRComment.created_at.asc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

async def create_review(
    db: AsyncSession,
    repo_id: uuid.UUID,
    pr_number: int,
    reviewer: User,
    payload: PRReviewCreate,
) -> PRReview:
    pr = await _get_pr_or_404(db, repo_id, pr_number)
    
    review = PRReview(
        pull_request_id=pr.id,
        reviewer_id=reviewer.id,
        state=payload.state,
        body=payload.body,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review
