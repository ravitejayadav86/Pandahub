from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.repository import RepoVisibility


class RepoCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_\-\.]+$")
    description: Optional[str] = Field(None, max_length=500)
    visibility: RepoVisibility = RepoVisibility.PUBLIC
    default_branch: str = Field("main", max_length=100)
    auto_init: bool = True  # create an initial commit if True


class RepoUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=500)
    visibility: Optional[RepoVisibility] = None
    default_branch: Optional[str] = Field(None, max_length=100)


class RepoRead(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    visibility: RepoVisibility
    default_branch: str
    star_count: int
    fork_count: int
    open_issues_count: int
    is_fork: bool
    owner_id: Optional[int]
    org_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    pushed_at: Optional[datetime]
    # Owner info
    owner_username: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Git tree/blob schemas ──────────────────────────────────────────────────────

class TreeEntry(BaseModel):
    name: str
    path: str
    type: str  # "blob" | "tree"
    size: Optional[int] = None
    sha: str


class CommitRead(BaseModel):
    sha: str
    message: str
    author_name: str
    author_email: str
    committed_at: datetime


class BranchRead(BaseModel):
    name: str
    sha: str  # tip commit sha


class BlobRead(BaseModel):
    path: str
    content: str  # base64-encoded for binary, utf-8 text otherwise
    encoding: str  # "utf-8" | "base64"
    size: int
    sha: str
