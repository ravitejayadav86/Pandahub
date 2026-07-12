from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.issue import IssueState, IssuePriority


class IssueCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    body: Optional[str] = None
    priority: Optional[IssuePriority] = None
    assignee_id: Optional[int] = None


class IssueUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    body: Optional[str] = None
    state: Optional[IssueState] = None
    priority: Optional[IssuePriority] = None
    assignee_id: Optional[int] = None


class IssueRead(BaseModel):
    id: int
    number: int
    title: str
    body: Optional[str]
    state: IssueState
    priority: Optional[IssuePriority]
    repository_id: int
    author_id: int
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]
    comment_count: int = 0

    model_config = {"from_attributes": True}


class IssueCommentCreate(BaseModel):
    body: str = Field(..., min_length=1)


class IssueCommentRead(BaseModel):
    id: int
    issue_id: int
    author_id: int
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
