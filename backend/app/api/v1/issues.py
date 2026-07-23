"""
Issues REST router — Module 9.

Route layout:
  GET    /{owner}/{repo}/issues                     list issues (paginated, filtered)
  POST   /{owner}/{repo}/issues                     create issue
  GET    /{owner}/{repo}/issues/{number}            get issue details
  PATCH  /{owner}/{repo}/issues/{number}            update issue
  DELETE /{owner}/{repo}/issues/{number}            delete issue (admin)

  POST   /{owner}/{repo}/issues/{number}/close      close issue
  POST   /{owner}/{repo}/issues/{number}/reopen     reopen issue

  GET    /{owner}/{repo}/issues/{number}/comments   list comments
  POST   /{owner}/{repo}/issues/{number}/comments   add comment
  PATCH  /{owner}/{repo}/issues/{number}/comments/{cid} update comment
  DELETE /{owner}/{repo}/issues/{number}/comments/{cid} delete comment

  GET    /{owner}/{repo}/labels                     list labels
  POST   /{owner}/{repo}/labels                     create label
  PATCH  /{owner}/{repo}/labels/{lid}               update label
  DELETE /{owner}/{repo}/labels/{lid}               delete label

  GET    /{owner}/{repo}/milestones                 list milestones
  POST   /{owner}/{repo}/milestones                 create milestone
  PATCH  /{owner}/{repo}/milestones/{mid}           update milestone
  DELETE /{owner}/{repo}/milestones/{mid}           delete milestone
"""
from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_active_user,
    get_current_verified_user,
    get_repository,
    require_repo_permission,
)
from app.db.session import get_db
from app.models.enums import IssueState, MilestoneState, PermissionLevel
from app.models.repo import Repository
from app.models.user import User
from app.schemas.issue_schema import (
    CommentCreate,
    CommentListOut,
    CommentOut,
    CommentUpdate,
    IssueCreate,
    IssueListOut,
    IssueOut,
    IssueUpdate,
    LabelCreate,
    LabelOut,
    LabelUpdate,
    MilestoneCreate,
    MilestoneListOut,
    MilestoneOut,
    MilestoneUpdate,
)
from app.services import issue_service

router = APIRouter(tags=["issues"])


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/issues",
    response_model=IssueListOut,
    summary="List repository issues",
)
async def list_issues(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    state: IssueState = Query(IssueState.OPEN),
    label_id: Optional[list[uuid.UUID]] = Query(None),
    assignee_id: Optional[uuid.UUID] = Query(None),
    milestone_id: Optional[uuid.UUID] = Query(None),
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 30,
) -> IssueListOut:
    items, total = await issue_service.list_issues(
        db,
        repo_id=repository.id,
        state=state,
        label_ids=label_id,
        assignee_id=assignee_id,
        milestone_id=milestone_id,
        page=page,
        per_page=per_page,
    )
    # Serialize issues manually or via model_validate
    out_items = [IssueOut.model_validate(item) for item in items]
    return IssueListOut(
        items=out_items,
        total=total,
        page=page,
        per_page=per_page,
        state=state,
    )


@router.post(
    "/{owner}/{repo}/issues",
    response_model=IssueOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an issue",
)
async def create_issue(
    payload: IssueCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> IssueOut:
    issue = await issue_service.create_issue(db, repository.id, current_user, payload)
    return IssueOut.model_validate(issue)


@router.get(
    "/{owner}/{repo}/issues/{number}",
    response_model=IssueOut,
    summary="Get an issue by number",
)
async def get_issue(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> IssueOut:
    issue = await issue_service.get_issue(db, repository.id, number)
    return IssueOut.model_validate(issue)


@router.patch(
    "/{owner}/{repo}/issues/{number}",
    response_model=IssueOut,
    summary="Update an issue",
)
async def update_issue(
    number: int,
    payload: IssueUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> IssueOut:
    updated = await issue_service.update_issue(
        db, repository.id, number, payload, current_user, perm
    )
    return IssueOut.model_validate(updated)


@router.delete(
    "/{owner}/{repo}/issues/{number}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete an issue",
)
async def delete_issue(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> None:
    await issue_service.delete_issue(db, repository.id, number)


@router.post(
    "/{owner}/{repo}/issues/{number}/close",
    response_model=IssueOut,
    summary="Close an issue",
)
async def close_issue(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> IssueOut:
    closed = await issue_service.close_issue(db, repository.id, number, current_user, perm)
    return IssueOut.model_validate(closed)


@router.post(
    "/{owner}/{repo}/issues/{number}/reopen",
    response_model=IssueOut,
    summary="Reopen an issue",
)
async def reopen_issue(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> IssueOut:
    reopened = await issue_service.reopen_issue(db, repository.id, number, current_user, perm)
    return IssueOut.model_validate(reopened)


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/issues/{number}/comments",
    response_model=CommentListOut,
    summary="List issue comments",
)
async def list_comments(
    number: int,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
) -> CommentListOut:
    items, total = await issue_service.list_comments(
        db, repository.id, number, page=page, per_page=per_page
    )
    out_items = [CommentOut.model_validate(c) for c in items]
    return CommentListOut(items=out_items, total=total)


@router.post(
    "/{owner}/{repo}/issues/{number}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to an issue",
)
async def create_comment(
    number: int,
    payload: CommentCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> CommentOut:
    comment = await issue_service.create_comment(
        db, repository.id, number, current_user, payload
    )
    return CommentOut.model_validate(comment)


@router.patch(
    "/{owner}/{repo}/issues/{number}/comments/{comment_id}",
    response_model=CommentOut,
    summary="Update a comment",
)
async def update_comment(
    number: int,
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> CommentOut:
    comment = await issue_service.update_comment(
        db, repository.id, number, comment_id, current_user, perm, payload
    )
    return CommentOut.model_validate(comment)


@router.delete(
    "/{owner}/{repo}/issues/{number}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete a comment",
)
async def delete_comment(
    number: int,
    comment_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> None:
    await issue_service.delete_comment(
        db, repository.id, number, comment_id, current_user, perm
    )


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/labels",
    response_model=list[LabelOut],
    summary="List repository labels",
)
async def list_labels(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> list[LabelOut]:
    labels = await issue_service.list_labels(db, repository.id)
    return [LabelOut.model_validate(lbl) for lbl in labels]


@router.post(
    "/{owner}/{repo}/labels",
    response_model=LabelOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a label",
)
async def create_label(
    payload: LabelCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.TRIAGE, allow_anonymous=False)
    ),
) -> LabelOut:
    label = await issue_service.create_label(db, repository.id, payload)
    return LabelOut.model_validate(label)


@router.patch(
    "/{owner}/{repo}/labels/{label_id}",
    response_model=LabelOut,
    summary="Update a label",
)
async def update_label(
    label_id: uuid.UUID,
    payload: LabelUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.TRIAGE, allow_anonymous=False)
    ),
) -> LabelOut:
    label = await issue_service.update_label(db, repository.id, label_id, payload)
    return LabelOut.model_validate(label)


@router.delete(
    "/{owner}/{repo}/labels/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete a label",
)
async def delete_label(
    label_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.TRIAGE, allow_anonymous=False)
    ),
) -> None:
    await issue_service.delete_label(db, repository.id, label_id)


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/milestones",
    response_model=MilestoneListOut,
    summary="List milestones",
)
async def list_milestones(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    state: MilestoneState = Query(MilestoneState.OPEN),
) -> MilestoneListOut:
    milestones = await issue_service.list_milestones(db, repository.id, state=state)
    items = [MilestoneOut.model_validate(ms) for ms in milestones]
    return MilestoneListOut(items=items, total=len(items))


@router.post(
    "/{owner}/{repo}/milestones",
    response_model=MilestoneOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a milestone",
)
async def create_milestone(
    payload: MilestoneCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.TRIAGE, allow_anonymous=False)
    ),
) -> MilestoneOut:
    milestone = await issue_service.create_milestone(db, repository.id, payload)
    return MilestoneOut.model_validate(milestone)


@router.patch(
    "/{owner}/{repo}/milestones/{milestone_id}",
    response_model=MilestoneOut,
    summary="Update a milestone",
)
async def update_milestone(
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.TRIAGE, allow_anonymous=False)
    ),
) -> MilestoneOut:
    milestone = await issue_service.update_milestone(db, repository.id, milestone_id, payload)
    return MilestoneOut.model_validate(milestone)


@router.delete(
    "/{owner}/{repo}/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete a milestone",
)
async def delete_milestone(
    milestone_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.TRIAGE, allow_anonymous=False)
    ),
) -> None:
    await issue_service.delete_milestone(db, repository.id, milestone_id)
