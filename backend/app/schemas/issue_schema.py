"""
Pydantic schemas for the Issues module (Module 9).

Naming convention mirrors the repo_schema pattern:
  *Create   — request body for creation
  *Update   — request body for partial update (all fields Optional)
  *Out      — response shape (model_validate from ORM object)
  *ListOut  — paginated collection wrapper

Design notes:
  - ``number`` on Issue is the per-repo sequential integer (#1, #2…), NOT the
    UUID.  All public URLs and API references use ``number`` (e.g. GET
    /repos/{owner}/{repo}/issues/42).  The UUID ``id`` is for internal joins.
  - Author / assignee shapes are deliberately thin (id + username + avatar)
    so issue list responses don't cause N+1 queries loading full User objects.
  - Label and Milestone shapes are embedded inline so a single issue response
    contains everything the UI needs without extra round-trips.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IssueState, MilestoneState


# ---------------------------------------------------------------------------
# Embedded / shared shapes
# ---------------------------------------------------------------------------

class UserBrief(BaseModel):
    """Minimal user representation embedded in issue responses."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    avatar_url: Optional[str] = None


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    description: Optional[str] = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: Optional[str] = None
    state: MilestoneState
    due_date: Optional[date] = None
    open_issues: int = 0
    closed_issues: int = 0


# ---------------------------------------------------------------------------
# Label CRUD
# ---------------------------------------------------------------------------

class LabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(..., pattern=r"^#[0-9a-fA-F]{6}$")
    description: Optional[str] = Field(None, max_length=255)


class LabelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    description: Optional[str] = Field(None, max_length=255)


# ---------------------------------------------------------------------------
# Milestone CRUD
# ---------------------------------------------------------------------------

class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    due_date: Optional[date] = None


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    due_date: Optional[date] = None
    state: Optional[MilestoneState] = None


class MilestoneListOut(BaseModel):
    items: list[MilestoneOut]
    total: int


# ---------------------------------------------------------------------------
# Issue CRUD
# ---------------------------------------------------------------------------

class IssueCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=20000)
    label_ids: list[uuid.UUID] = Field(default_factory=list)
    assignee_ids: list[uuid.UUID] = Field(default_factory=list)
    milestone_id: Optional[uuid.UUID] = None


class IssueUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=20000)
    state: Optional[IssueState] = None
    label_ids: Optional[list[uuid.UUID]] = None
    assignee_ids: Optional[list[uuid.UUID]] = None
    milestone_id: Optional[uuid.UUID] = None
    is_locked: Optional[bool] = None


class IssueOut(BaseModel):
    """Full issue representation — returned by create, get, and update."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    title: str
    description: Optional[str] = None
    state: IssueState
    is_locked: bool
    author: Optional[UserBrief] = None
    assignees: list[UserBrief] = Field(default_factory=list)
    labels: list[LabelOut] = Field(default_factory=list)
    milestone: Optional[MilestoneOut] = None
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None


class IssueListOut(BaseModel):
    """Paginated issue list."""
    items: list[IssueOut]
    total: int
    page: int
    per_page: int
    state: IssueState


# ---------------------------------------------------------------------------
# Issue Comment CRUD
# ---------------------------------------------------------------------------

class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)


class CommentUpdate(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    author: Optional[UserBrief] = None
    created_at: datetime
    updated_at: datetime


class CommentListOut(BaseModel):
    items: list[CommentOut]
    total: int


# ---------------------------------------------------------------------------
# State change convenience response
# ---------------------------------------------------------------------------

class IssueStateOut(BaseModel):
    """Returned by open/close endpoints."""
    id: uuid.UUID
    number: int
    state: IssueState
    closed_at: Optional[datetime] = None
