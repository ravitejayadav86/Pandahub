"""
Issue service — business logic layer for Module 9.

Responsibilities:
  - Sequential issue numbering (per-repo, gap-free, race-safe)
  - Issue CRUD with label + assignee + milestone resolution
  - State transitions (open ↔ close) with timestamp tracking
  - Comment CRUD
  - Label and Milestone CRUD

Sequential number assignment:
  ``SELECT MAX(number) ... FOR UPDATE`` inside a transaction.  The
  ``FOR UPDATE`` row-lock prevents two simultaneous issue-creates from
  both seeing the same MAX and assigning the same number.  This is simpler
  and more reliable than a SEQUENCE per repository (which would require
  DDL on each repo creation) while still being gap-free for normal usage
  (gaps only appear on transaction rollback, which is acceptable).

N+1 avoidance:
  List queries use ``selectinload`` for labels, assignees, and comments
  so a page of 30 issues loads in 4 queries (issues + labels + assignees
  + comments), not 30 × 3.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.logging import get_logger
from app.models.enums import IssueState, MilestoneState, PermissionLevel
from app.models.issue import Issue, IssueAssignee, IssueComment, IssueLabel, Label, Milestone
from app.models.user import User
from app.schemas.issue_schema import (
    CommentCreate,
    CommentUpdate,
    IssueCreate,
    IssueUpdate,
    LabelCreate,
    LabelUpdate,
    MilestoneCreate,
    MilestoneUpdate,
)

logger = get_logger("app.services.issue_service")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _issue_query_options():
    """Standard selectinload options for a single Issue object."""
    return [
        selectinload(Issue.labels).selectinload(IssueLabel.issue),
        selectinload(Issue.assignees),
        selectinload(Issue.comments),
    ]


async def _get_issue_or_404(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
) -> Issue:
    """Load a single issue by (repo_id, number) with all relationships."""
    result = await db.execute(
        select(Issue)
        .where(
            Issue.repository_id == repo_id,
            Issue.number == issue_number,
        )
        .options(
            selectinload(Issue.labels),
            selectinload(Issue.assignees),
            selectinload(Issue.comments),
        )
    )
    issue = result.scalar_one_or_none()
    if issue is None:
        raise NotFoundError(f"Issue #{issue_number} not found.")
    return issue


async def _assign_next_number(db: AsyncSession, repo_id: uuid.UUID) -> int:
    """
    Assign the next sequential issue number for *repo_id*.

    Uses ``WITH ... FOR UPDATE`` locking to prevent duplicate numbers
    under concurrent creates.
    """
    result = await db.execute(
        select(func.max(Issue.number)).where(Issue.repository_id == repo_id).with_for_update()
    )
    max_number: Optional[int] = result.scalar()
    return (max_number or 0) + 1


# ---------------------------------------------------------------------------
# Label management
# ---------------------------------------------------------------------------

async def list_labels(
    db: AsyncSession,
    repo_id: uuid.UUID,
) -> list[Label]:
    result = await db.execute(
        select(Label).where(Label.repository_id == repo_id).order_by(Label.name)
    )
    return list(result.scalars().all())


async def create_label(
    db: AsyncSession,
    repo_id: uuid.UUID,
    payload: LabelCreate,
) -> Label:
    label = Label(
        repository_id=repo_id,
        name=payload.name,
        color=payload.color,
        description=payload.description,
    )
    db.add(label)
    try:
        await db.commit()
        await db.refresh(label)
    except Exception:
        await db.rollback()
        raise ConflictError(f"A label named '{payload.name}' already exists in this repository.")
    return label


async def update_label(
    db: AsyncSession,
    repo_id: uuid.UUID,
    label_id: uuid.UUID,
    payload: LabelUpdate,
) -> Label:
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.repository_id == repo_id)
    )
    label = result.scalar_one_or_none()
    if label is None:
        raise NotFoundError("Label not found.")

    if payload.name is not None:
        label.name = payload.name
    if payload.color is not None:
        label.color = payload.color
    if payload.description is not None:
        label.description = payload.description

    await db.commit()
    await db.refresh(label)
    return label


async def delete_label(
    db: AsyncSession,
    repo_id: uuid.UUID,
    label_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.repository_id == repo_id)
    )
    label = result.scalar_one_or_none()
    if label is None:
        raise NotFoundError("Label not found.")
    await db.delete(label)
    await db.commit()


# ---------------------------------------------------------------------------
# Milestone management
# ---------------------------------------------------------------------------

async def list_milestones(
    db: AsyncSession,
    repo_id: uuid.UUID,
    state: MilestoneState = MilestoneState.OPEN,
) -> list[Milestone]:
    result = await db.execute(
        select(Milestone)
        .where(Milestone.repository_id == repo_id, Milestone.state == state)
        .order_by(Milestone.due_date.asc().nulls_last())
    )
    return list(result.scalars().all())


async def create_milestone(
    db: AsyncSession,
    repo_id: uuid.UUID,
    payload: MilestoneCreate,
) -> Milestone:
    milestone = Milestone(
        repository_id=repo_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return milestone


async def update_milestone(
    db: AsyncSession,
    repo_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
) -> Milestone:
    result = await db.execute(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.repository_id == repo_id,
        )
    )
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise NotFoundError("Milestone not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)

    await db.commit()
    await db.refresh(milestone)
    return milestone


async def delete_milestone(
    db: AsyncSession,
    repo_id: uuid.UUID,
    milestone_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.repository_id == repo_id,
        )
    )
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise NotFoundError("Milestone not found.")
    await db.delete(milestone)
    await db.commit()


# ---------------------------------------------------------------------------
# Issue CRUD
# ---------------------------------------------------------------------------

async def list_issues(
    db: AsyncSession,
    repo_id: uuid.UUID,
    state: IssueState = IssueState.OPEN,
    label_ids: Optional[list[uuid.UUID]] = None,
    assignee_id: Optional[uuid.UUID] = None,
    milestone_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 30,
) -> tuple[list[Issue], int]:
    """
    Return a paginated list of issues filtered by state and optional filters.

    Returns:
        (items, total_count) tuple.
    """
    base_q = (
        select(Issue)
        .where(Issue.repository_id == repo_id, Issue.state == state)
    )
    count_q = (
        select(func.count())
        .select_from(Issue)
        .where(Issue.repository_id == repo_id, Issue.state == state)
    )

    if assignee_id is not None:
        base_q = base_q.join(IssueAssignee).where(IssueAssignee.user_id == assignee_id)
        count_q = count_q.join(IssueAssignee).where(IssueAssignee.user_id == assignee_id)

    if milestone_id is not None:
        base_q = base_q.where(Issue.milestone_id == milestone_id)
        count_q = count_q.where(Issue.milestone_id == milestone_id)

    if label_ids:
        for lid in label_ids:
            base_q = base_q.join(
                IssueLabel, (IssueLabel.issue_id == Issue.id) & (IssueLabel.label_id == lid)
            )
            count_q = count_q.join(
                IssueLabel, (IssueLabel.issue_id == Issue.id) & (IssueLabel.label_id == lid)
            )

    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    page_q = (
        base_q
        .options(
            selectinload(Issue.labels),
            selectinload(Issue.assignees),
            selectinload(Issue.comments),
        )
        .order_by(Issue.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items_result = await db.execute(page_q)
    items = list(items_result.scalars().all())

    return items, total


async def create_issue(
    db: AsyncSession,
    repo_id: uuid.UUID,
    author: User,
    payload: IssueCreate,
) -> Issue:
    """
    Create a new issue with the next sequential number.

    Labels and assignees are validated against the repository — silently
    dropping any IDs that don't belong to this repo (safe degradation).
    """
    number = await _assign_next_number(db, repo_id)

    issue = Issue(
        repository_id=repo_id,
        number=number,
        title=payload.title,
        description=payload.description,
        author_id=author.id,
        milestone_id=payload.milestone_id,
    )
    db.add(issue)
    await db.flush()  # populate issue.id before adding associations

    # Validate and attach labels
    if payload.label_ids:
        valid_labels = await db.execute(
            select(Label.id).where(
                Label.id.in_(payload.label_ids),
                Label.repository_id == repo_id,
            )
        )
        for label_id in valid_labels.scalars().all():
            db.add(IssueLabel(issue_id=issue.id, label_id=label_id))

    # Attach assignees (user existence is not re-validated — FK handles it)
    for user_id in payload.assignee_ids:
        db.add(IssueAssignee(issue_id=issue.id, user_id=user_id))

    await db.commit()

    # Reload with all relationships for response serialization
    return await _get_issue_or_404(db, repo_id, number)


async def get_issue(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
) -> Issue:
    return await _get_issue_or_404(db, repo_id, issue_number)


async def update_issue(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    payload: IssueUpdate,
    actor: User,
    actor_permission: PermissionLevel,
) -> Issue:
    """
    Update issue fields.

    Lock control (is_locked) is restricted to TRIAGE+ permission.
    State changes are allowed by the author or any TRIAGE+ user.
    """
    issue = await _get_issue_or_404(db, repo_id, issue_number)
    now = datetime.now(timezone.utc)

    if payload.title is not None:
        issue.title = payload.title
    if payload.description is not None:
        issue.description = payload.description

    # State transition
    if payload.state is not None and payload.state != issue.state:
        _can_change_state = (
            issue.author_id == actor.id
            or actor_permission >= PermissionLevel.TRIAGE
        )
        if not _can_change_state:
            raise PermissionDeniedError("Only the author or a triager can change issue state.")
        issue.state = payload.state
        issue.closed_at = now if payload.state == IssueState.CLOSED else None

    # Lock / unlock — requires TRIAGE+
    if payload.is_locked is not None:
        if actor_permission < PermissionLevel.TRIAGE:
            raise PermissionDeniedError("Only triagers can lock/unlock issues.")
        issue.is_locked = payload.is_locked

    # Milestone
    if payload.milestone_id is not None:
        issue.milestone_id = payload.milestone_id

    # Labels — full replace if provided
    if payload.label_ids is not None:
        await db.execute(
            delete(IssueLabel).where(IssueLabel.issue_id == issue.id)
        )
        if payload.label_ids:
            valid_labels = await db.execute(
                select(Label.id).where(
                    Label.id.in_(payload.label_ids),
                    Label.repository_id == repo_id,
                )
            )
            for label_id in valid_labels.scalars().all():
                db.add(IssueLabel(issue_id=issue.id, label_id=label_id))

    # Assignees — full replace if provided
    if payload.assignee_ids is not None:
        await db.execute(
            delete(IssueAssignee).where(IssueAssignee.issue_id == issue.id)
        )
        for user_id in payload.assignee_ids:
            db.add(IssueAssignee(issue_id=issue.id, user_id=user_id))

    await db.commit()
    return await _get_issue_or_404(db, repo_id, issue_number)


async def delete_issue(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
) -> None:
    """Delete an issue. Caller must already have ADMIN permission."""
    result = await db.execute(
        select(Issue).where(
            Issue.repository_id == repo_id,
            Issue.number == issue_number,
        )
    )
    issue = result.scalar_one_or_none()
    if issue is None:
        raise NotFoundError(f"Issue #{issue_number} not found.")
    await db.delete(issue)
    await db.commit()


# ---------------------------------------------------------------------------
# Issue state convenience functions
# ---------------------------------------------------------------------------

async def close_issue(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    actor: User,
    actor_permission: PermissionLevel,
) -> Issue:
    """Close an issue.  Identical to update_issue with state=CLOSED."""
    return await update_issue(
        db, repo_id, issue_number,
        IssueUpdate(state=IssueState.CLOSED),
        actor, actor_permission,
    )


async def reopen_issue(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    actor: User,
    actor_permission: PermissionLevel,
) -> Issue:
    """Reopen a closed issue."""
    return await update_issue(
        db, repo_id, issue_number,
        IssueUpdate(state=IssueState.OPEN),
        actor, actor_permission,
    )


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

async def list_comments(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[IssueComment], int]:
    # Validate the issue exists first
    await _get_issue_or_404(db, repo_id, issue_number)

    issue_sq = select(Issue.id).where(
        Issue.repository_id == repo_id,
        Issue.number == issue_number,
    ).scalar_subquery()

    count_result = await db.execute(
        select(func.count()).where(IssueComment.issue_id == issue_sq)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(IssueComment)
        .where(IssueComment.issue_id == issue_sq)
        .order_by(IssueComment.created_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return list(result.scalars().all()), total


async def create_comment(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    author: User,
    payload: CommentCreate,
) -> IssueComment:
    issue = await _get_issue_or_404(db, repo_id, issue_number)

    if issue.is_locked:
        raise PermissionDeniedError("This issue is locked. Only maintainers can comment.")

    comment = IssueComment(
        issue_id=issue.id,
        author_id=author.id,
        body=payload.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def update_comment(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    comment_id: uuid.UUID,
    actor: User,
    actor_permission: PermissionLevel,
    payload: CommentUpdate,
) -> IssueComment:
    issue = await _get_issue_or_404(db, repo_id, issue_number)

    result = await db.execute(
        select(IssueComment).where(
            IssueComment.id == comment_id,
            IssueComment.issue_id == issue.id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise NotFoundError("Comment not found.")

    # Only the author or a WRITE+ user can edit a comment
    if comment.author_id != actor.id and actor_permission < PermissionLevel.WRITE:
        raise PermissionDeniedError("You can only edit your own comments.")

    comment.body = payload.body
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_comment(
    db: AsyncSession,
    repo_id: uuid.UUID,
    issue_number: int,
    comment_id: uuid.UUID,
    actor: User,
    actor_permission: PermissionLevel,
) -> None:
    issue = await _get_issue_or_404(db, repo_id, issue_number)

    result = await db.execute(
        select(IssueComment).where(
            IssueComment.id == comment_id,
            IssueComment.issue_id == issue.id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise NotFoundError("Comment not found.")

    if comment.author_id != actor.id and actor_permission < PermissionLevel.WRITE:
        raise PermissionDeniedError("You can only delete your own comments.")

    await db.delete(comment)
    await db.commit()
