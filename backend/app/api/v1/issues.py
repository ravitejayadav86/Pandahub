from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.issue import Issue, IssueComment, IssueState
from app.models.user import User
from app.schemas.issue import (
    IssueCommentCreate,
    IssueCommentRead,
    IssueCreate,
    IssueRead,
    IssueUpdate,
)
from app.services.repo_service import get_repo_by_slug

router = APIRouter(tags=["issues"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("/repos/{owner}/{repo_name}/issues", response_model=IssueRead, status_code=201)
async def create_issue(
    owner: str, repo_name: str, data: IssueCreate, current_user: CurrentUser, db: DbDep
):
    repo = await get_repo_by_slug(db, owner, repo_name)
    # Get next issue number
    count_result = await db.execute(
        select(func.count(Issue.id)).where(Issue.repository_id == repo.id)
    )
    next_number = (count_result.scalar() or 0) + 1

    issue = Issue(
        repository_id=repo.id,
        author_id=current_user.id,
        number=next_number,
        title=data.title,
        body=data.body,
        priority=data.priority,
        assignee_id=data.assignee_id,
    )
    db.add(issue)
    repo.open_issues_count += 1
    await db.flush()
    return issue


@router.get("/repos/{owner}/{repo_name}/issues", response_model=list[IssueRead])
async def list_issues(
    owner: str, repo_name: str, db: DbDep, state: str = "open", skip: int = 0, limit: int = 30
):
    repo = await get_repo_by_slug(db, owner, repo_name)
    issue_state = IssueState.OPEN if state == "open" else IssueState.CLOSED
    result = await db.execute(
        select(Issue)
        .where(Issue.repository_id == repo.id, Issue.state == issue_state)
        .order_by(Issue.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/repos/{owner}/{repo_name}/issues/{number}", response_model=IssueRead)
async def get_issue(owner: str, repo_name: str, number: int, db: DbDep):
    repo = await get_repo_by_slug(db, owner, repo_name)
    result = await db.execute(
        select(Issue).where(Issue.repository_id == repo.id, Issue.number == number)
    )
    issue = result.scalar_one_or_none()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.patch("/repos/{owner}/{repo_name}/issues/{number}", response_model=IssueRead)
async def update_issue(
    owner: str, repo_name: str, number: int, data: IssueUpdate, current_user: CurrentUser, db: DbDep
):
    repo = await get_repo_by_slug(db, owner, repo_name)
    result = await db.execute(
        select(Issue).where(Issue.repository_id == repo.id, Issue.number == number)
    )
    issue = result.scalar_one_or_none()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(issue, field, value)
    if data.state == IssueState.CLOSED and issue.closed_at is None:
        issue.closed_at = datetime.now(timezone.utc)
        repo.open_issues_count = max(0, repo.open_issues_count - 1)
    return issue


@router.post(
    "/repos/{owner}/{repo_name}/issues/{number}/comments",
    response_model=IssueCommentRead,
    status_code=201,
)
async def create_comment(
    owner: str, repo_name: str, number: int, data: IssueCommentCreate, current_user: CurrentUser, db: DbDep
):
    repo = await get_repo_by_slug(db, owner, repo_name)
    result = await db.execute(
        select(Issue).where(Issue.repository_id == repo.id, Issue.number == number)
    )
    issue = result.scalar_one_or_none()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    comment = IssueComment(issue_id=issue.id, author_id=current_user.id, body=data.body)
    db.add(comment)
    await db.flush()
    return comment


@router.get(
    "/repos/{owner}/{repo_name}/issues/{number}/comments",
    response_model=list[IssueCommentRead],
)
async def list_comments(owner: str, repo_name: str, number: int, db: DbDep):
    repo = await get_repo_by_slug(db, owner, repo_name)
    result = await db.execute(
        select(Issue).where(Issue.repository_id == repo.id, Issue.number == number)
    )
    issue = result.scalar_one_or_none()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    comments_result = await db.execute(
        select(IssueComment)
        .where(IssueComment.issue_id == issue.id)
        .order_by(IssueComment.created_at)
    )
    return comments_result.scalars().all()
