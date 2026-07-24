"""
Pydantic I/O schemas for the Repository Engine (Module 7).

Separation principle: ORM models own DB persistence; schemas own the API
contract.  Keeping them separate means the DB shape can evolve (adding an
internal column) without accidentally changing what the API exposes, and
vice-versa.

``model_config = ConfigDict(from_attributes=True)`` is set on every response
schema so ``model.model_validate(orm_obj)`` works without explicit field
mapping — SQLAlchemy mapped_column attributes satisfy Pydantic's attribute
protocol.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PermissionLevel, RepositoryVisibility


# ---------------------------------------------------------------------------
# Repository CRUD schemas
# ---------------------------------------------------------------------------

class RepositoryCreate(BaseModel):
    """Payload for ``POST /repos``."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z0-9_.-]+$",
        description=(
            "Repository name.  Only letters, digits, hyphens, underscores, "
            "and dots are allowed."
        ),
    )
    description: Optional[str] = Field(None, max_length=1000)
    visibility: RepositoryVisibility = RepositoryVisibility.PRIVATE
    default_branch: str = Field("main", max_length=255)

    # If true, the service initialises the bare repo with an empty initial
    # commit (making it clone-able immediately, matching the "init with README"
    # checkbox in the frontend's new-repo form).
    auto_init: bool = False

    # When set, the repo is created under the specified org instead of the
    # authenticated user.  The caller must have org ADMIN or OWNER role.
    owner_organization_id: Optional[uuid.UUID] = None


class RepositoryUpdate(BaseModel):
    """Payload for ``PATCH /{owner}/{repo}``."""

    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[RepositoryVisibility] = None
    default_branch: Optional[str] = Field(None, max_length=255)
    is_archived: Optional[bool] = None
    is_template: Optional[bool] = None


class RepositoryOut(BaseModel):
    """Full repository representation returned by most repo endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str]
    visibility: RepositoryVisibility
    default_branch: str
    is_fork: bool
    forked_from_id: Optional[uuid.UUID]
    is_archived: bool
    is_template: bool
    disk_path: str
    size_kb: int
    star_count: int
    fork_count: int
    watcher_count: int
    pushed_at: Optional[datetime]
    owner_user_id: Optional[uuid.UUID]
    owner_organization_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    # Not a DB column — populated by the explore endpoint for display purposes
    owner_username: Optional[str] = None


class RepositoryListOut(BaseModel):
    """Paginated list wrapper returned by list-style endpoints."""

    items: list[RepositoryOut]
    total: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# Branch schemas
# ---------------------------------------------------------------------------

class BranchInfo(BaseModel):
    """A single branch entry in the branch list."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    last_commit_sha: Optional[str]
    is_default: bool
    is_protected: bool
    last_pushed_at: Optional[datetime]


class BranchListOut(BaseModel):
    items: list[BranchInfo]
    total: int


# ---------------------------------------------------------------------------
# Git tree / blob schemas
# ---------------------------------------------------------------------------

class TreeEntryOut(BaseModel):
    """
    One entry in a directory listing.

    ``type`` is ``"blob"`` for files and ``"tree"`` for sub-directories,
    mirroring the git object model and the GitHub REST API shape.
    """

    name: str
    type: Literal["blob", "tree"]
    path: str            # relative to repo root, e.g. "src/utils/helpers.py"
    sha: str             # 40-char hex SHA of the git object
    size: Optional[int]  # bytes; None for trees (git doesn't store dir sizes)
    mode: str            # git file mode, e.g. "100644", "040000"


class TreeOut(BaseModel):
    """Directory listing at a ref + path."""

    ref: str
    path: str  # "" means repo root
    entries: list[TreeEntryOut]


class BlobOut(BaseModel):
    """
    Raw file content.

    Content is base64-encoded so the JSON envelope is always valid UTF-8
    even for binary files (images, compiled artifacts, etc.).  The client
    decodes using the ``encoding`` field.
    """

    ref: str
    path: str
    sha: str
    size: int
    encoding: Literal["base64"] = "base64"
    content: str          # base64-encoded bytes
    mime_type: str        # best-guess, e.g. "text/plain", "image/png"


# ---------------------------------------------------------------------------
# Commit history schemas
# ---------------------------------------------------------------------------

class CommitAuthorInfo(BaseModel):
    name: str
    email: str
    when: datetime


class CommitInfo(BaseModel):
    """One entry in the commit log."""

    sha: str
    short_sha: str        # first 7 chars
    message: str
    summary: str          # first line of the commit message
    author: CommitAuthorInfo
    committer: CommitAuthorInfo
    parent_shas: list[str]


class CommitListOut(BaseModel):
    """Paginated commit history."""

    ref: str
    items: list[CommitInfo]
    total: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# README schema
# ---------------------------------------------------------------------------

class ReadmeOut(BaseModel):
    """
    README file content returned as raw Markdown.

    The frontend is responsible for rendering and sanitising the Markdown —
    this keeps XSS concerns entirely on the client and avoids a hard
    dependency on a server-side renderer.
    """

    ref: str
    path: str             # e.g. "README.md"
    content: str          # raw Markdown text (UTF-8)
    encoding: Literal["utf-8"] = "utf-8"


# ---------------------------------------------------------------------------
# Star / Watch response schemas
# ---------------------------------------------------------------------------

class StarStatusOut(BaseModel):
    starred: bool
    star_count: int


class WatchStatusOut(BaseModel):
    watching: bool
    watcher_count: int


# ---------------------------------------------------------------------------
# Collaborator schemas
# ---------------------------------------------------------------------------

class CollaboratorAdd(BaseModel):
    user_id: uuid.UUID
    permission: PermissionLevel = PermissionLevel.READ


class CollaboratorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repository_id: uuid.UUID
    user_id: uuid.UUID
    permission: PermissionLevel
