"""
Pull Requests REST router — Module 10.

Route layout:
  GET    /{owner}/{repo}/pulls                     list PRs
  POST   /{owner}/{repo}/pulls                     create PR
  GET    /{owner}/{repo}/pulls/{number}            get PR details
  PATCH  /{owner}/{repo}/pulls/{number}            update PR metadata
  
  GET    /{owner}/{repo}/pulls/{number}/diff       get raw git diff
  POST   /{owner}/{repo}/pulls/{number}/merge      execute 3-way merge
  
  GET    /{owner}/{repo}/pulls/{number}/comments   list comments
  POST   /{owner}/{repo}/pulls/{number}/comments   add comment
  
  POST   /{owner}/{repo}/pulls/{number}/reviews    submit review
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_active_user,
    get_current_verified_user,
    get_repository,
    require_repo_permission,
)
from app.db.session import get_db
from app.models.enums import PullRequestState, PermissionLevel
from app.models.repo import Repository
from app.models.user import User
from app.schemas.pr_schema import (
    PullRequestCreate,
    PullRequestOut,
    PullRequestListOut,
    PullRequestUpdate,
    PRCommentCreate,
    PRCommentOut,
    PRReviewCreate,
    PRReviewOut,
)
from app.services import pr_service

router = APIRouter(tags=["pulls"])


@router.get(
    "/{owner}/{repo}/pulls",
    response_model=PullRequestListOut,
    summary="List pull requests",
)
async def list_pulls(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    state: PullRequestState = Query(PullRequestState.OPEN),
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 30,
) -> PullRequestListOut:
    items, total = await pr_service.list_pull_requests(
        db,
        repo_id=repository.id,
        state=state,
        page=page,
        per_page=per_page,
    )
    out_items = [PullRequestOut.model_validate(item) for item in items]
    return PullRequestListOut(
        items=out_items,
        total=total,
        page=page,
        per_page=per_page,
        state=state,
    )


@router.post(
    "/{owner}/{repo}/pulls",
    response_model=PullRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a pull request",
)
async def create_pull(
    payload: PullRequestCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> PullRequestOut:
    pr = await pr_service.create_pull_request(db, repository, current_user, payload)
    return PullRequestOut.model_validate(pr)


@router.get(
    "/{owner}/{repo}/pulls/{number}",
    response_model=PullRequestOut,
    summary="Get a pull request by number",
)
async def get_pull(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> PullRequestOut:
    pr = await pr_service.get_pull_request(db, repository.id, number)
    return PullRequestOut.model_validate(pr)


@router.patch(
    "/{owner}/{repo}/pulls/{number}",
    response_model=PullRequestOut,
    summary="Update a pull request",
)
async def update_pull(
    number: int,
    payload: PullRequestUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> PullRequestOut:
    pr = await pr_service.update_pull_request(
        db, repository.id, number, payload, current_user, perm
    )
    return PullRequestOut.model_validate(pr)


@router.get(
    "/{owner}/{repo}/pulls/{number}/diff",
    summary="Get raw diff for a pull request",
)
async def get_pull_diff(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> Response:
    """Returns the unified diff text between source and target branches."""
    diff_text = await pr_service.get_pull_request_diff(db, repository, number)
    return Response(content=diff_text, media_type="text/plain")


@router.post(
    "/{owner}/{repo}/pulls/{number}/merge",
    response_model=PullRequestOut,
    summary="Merge a pull request",
)
async def merge_pull(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.WRITE)),
) -> PullRequestOut:
    """
    Executes a 3-way merge using pygit2, creates a merge commit on the target
    branch, and updates the PR state to MERGED.
    """
    pr = await pr_service.merge_pull_request(
        db, repository, number, current_user, perm
    )
    return PullRequestOut.model_validate(pr)


# ---------------------------------------------------------------------------
# Comments & Reviews
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/pulls/{number}/comments",
    response_model=list[PRCommentOut],
    summary="List PR general comments",
)
async def list_comments(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> list[PRCommentOut]:
    comments = await pr_service.list_comments(db, repository.id, number)
    return [PRCommentOut.model_validate(c) for c in comments]


@router.post(
    "/{owner}/{repo}/pulls/{number}/comments",
    response_model=PRCommentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a general comment to a PR",
)
async def create_comment(
    number: int,
    payload: PRCommentCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> PRCommentOut:
    comment = await pr_service.create_comment(
        db, repository.id, number, current_user, payload
    )
    return PRCommentOut.model_validate(comment)


@router.post(
    "/{owner}/{repo}/pulls/{number}/reviews",
    response_model=PRReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a code review",
)
async def create_review(
    number: int,
    payload: PRReviewCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> PRReviewOut:
    review = await pr_service.create_review(
        db, repository.id, number, current_user, payload
    )
    return PRReviewOut.model_validate(review)
