"""
Pydantic schemas for Pull Requests (Module 10).

Design notes:
  - Like issues, ``number`` is the sequential identifier used in URLs.
  - Review states and Pull Request states map directly to enums.
  - Returns minimal representations of users (UserBrief) to avoid N+1 queries.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PullRequestState, ReviewState
from app.schemas.issue_schema import UserBrief


# ---------------------------------------------------------------------------
# Pull Request Base / Create / Update
# ---------------------------------------------------------------------------

class PullRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=20000)
    source_branch: str = Field(..., max_length=255)
    target_branch: str = Field(..., max_length=255)
    # If None, implies same-repository (internal branch-to-branch PR)
    source_repository_id: Optional[uuid.UUID] = None
    is_draft: bool = False


class PullRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=20000)
    state: Optional[PullRequestState] = None
    is_draft: Optional[bool] = None


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class PullRequestOut(BaseModel):
    """Full PR representation."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repository_id: uuid.UUID
    number: int
    title: str
    description: Optional[str] = None
    state: PullRequestState
    author: Optional[UserBrief] = None

    source_branch: str
    target_branch: str
    source_repository_id: uuid.UUID

    is_draft: bool
    merged_at: Optional[datetime] = None
    merged_by_id: Optional[uuid.UUID] = None
    merge_commit_sha: Optional[str] = None
    closed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    # These fields can be populated dynamically if needed by the UI
    is_mergeable: Optional[bool] = None


class PullRequestListOut(BaseModel):
    """Paginated PR list."""
    items: list[PullRequestOut]
    total: int
    page: int
    per_page: int
    state: PullRequestState


# ---------------------------------------------------------------------------
# Reviews and Comments
# ---------------------------------------------------------------------------

class PRReviewCreate(BaseModel):
    state: ReviewState
    body: Optional[str] = Field(None, max_length=10000)


class PRReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reviewer: Optional[UserBrief] = None
    state: ReviewState
    body: Optional[str] = None
    created_at: datetime


class PRReviewCommentCreate(BaseModel):
    """Inline comment anchored to a file and line."""
    file_path: str = Field(..., max_length=1000)
    line_number: int
    body: str = Field(..., max_length=10000)


class PRReviewCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author: Optional[UserBrief] = None
    file_path: str
    line_number: int
    body: str
    created_at: datetime


class PRCommentCreate(BaseModel):
    """General conversation comment."""
    body: str = Field(..., max_length=20000)


class PRCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author: Optional[UserBrief] = None
    body: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# AI Review Cache Schema
# ---------------------------------------------------------------------------

class AIReviewResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    summary: str
    suggestions: dict
    model_used: str
    created_at: datetime
