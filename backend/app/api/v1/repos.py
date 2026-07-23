"""
Repository Engine REST router — Module 7.

Route layout mirrors GitHub's API structure:
  POST   /repos                              create
  GET    /{owner}/{repo}                     metadata
  PATCH  /{owner}/{repo}                     update metadata
  DELETE /{owner}/{repo}                     delete
  GET    /{owner}/{repo}/branches            branch list (DB-cached)
  GET    /{owner}/{repo}/git/tree/{ref}      root tree
  GET    /{owner}/{repo}/git/tree/{ref}/{path}  subtree
  GET    /{owner}/{repo}/git/blob/{ref}/{path}  raw file content
  GET    /{owner}/{repo}/git/commits/{ref}   commit history (paginated)
  GET    /{owner}/{repo}/git/readme/{ref}    README content (raw Markdown)
  POST   /{owner}/{repo}/star               star
  DELETE /{owner}/{repo}/star               unstar
  POST   /{owner}/{repo}/fork               fork
  POST   /{owner}/{repo}/collaborators      add collaborator
  DELETE /{owner}/{repo}/collaborators/{uid}  remove collaborator
  GET    /{owner}/{repo}/collaborators      list collaborators

Design note on path structure:
  The ``/git/`` prefix on browsing routes makes it unambiguous that these
  endpoints go to pygit2, not the relational DB.  It also avoids conflicts
  with future repo-level resource paths (e.g. ``/issues``, ``/pulls``) that
  would otherwise clash with ref names if we used ``/{ref}`` at the top level.

Permission model:
  - All browsing routes accept anonymous callers (public repos).
  - Mutations (create, delete, update, star, fork, collaborators) require
    an authenticated user.
  - The ``require_repo_permission(min_level, allow_anonymous)`` dependency
    factory from ``api/dependencies.py`` handles the access check uniformly.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_active_user,
    get_current_verified_user,
    get_optional_current_user,
    get_repository,
    require_repo_permission,
)
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.enums import PermissionLevel
from app.models.repo import Repository
from app.models.user import User
from app.schemas.repo_schema import (
    BlobOut,
    BranchListOut,
    CollaboratorAdd,
    CollaboratorOut,
    CommitListOut,
    ReadmeOut,
    RepositoryCreate,
    RepositoryOut,
    RepositoryUpdate,
    StarStatusOut,
    TreeOut,
)
from app.services import git_service, repo_service

router = APIRouter(tags=["repositories"])


# ---------------------------------------------------------------------------
# Repository CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/repos",
    response_model=RepositoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a repository",
)
async def create_repository(
    payload: RepositoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> RepositoryOut:
    """
    Create a new repository owned by the authenticated user (or a specified
    organization if ``owner_organization_id`` is provided).
    """
    repo = await repo_service.create_repository(db, current_user, payload)
    return RepositoryOut.model_validate(repo)


@router.get(
    "/{owner}/{repo}",
    response_model=RepositoryOut,
    summary="Get repository metadata",
)
async def get_repository_metadata(
    repository: Repository = Depends(get_repository),
    user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> RepositoryOut:
    return RepositoryOut.model_validate(repository)


@router.patch(
    "/{owner}/{repo}",
    response_model=RepositoryOut,
    summary="Update repository metadata",
)
async def update_repository(
    payload: RepositoryUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> RepositoryOut:
    updated = await repo_service.update_repository(db, repository, payload)
    return RepositoryOut.model_validate(updated)


@router.delete(
    "/{owner}/{repo}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a repository",
)
async def delete_repository(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> None:
    await repo_service.delete_repository(db, repository)


# ---------------------------------------------------------------------------
# Branch list (DB-cached — fast, no pygit2 call)
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/branches",
    response_model=BranchListOut,
    summary="List branches (DB-cached)",
)
async def list_branches_cached(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> BranchListOut:
    """
    Return branches from the DB cache.  This is fast and suitable for
    rendering a branch selector dropdown.

    The git_engine (Module 8) keeps this cache in sync on every push.
    Use the ``/git/branches`` endpoint (below) if you need live data
    directly from pygit2.
    """
    branches = repository.branches  # loaded via relationship
    from app.schemas.repo_schema import BranchInfo
    items = [BranchInfo.model_validate(b) for b in branches]
    return BranchListOut(items=items, total=len(items))


@router.get(
    "/{owner}/{repo}/git/branches",
    response_model=BranchListOut,
    summary="List branches (live from git)",
)
async def list_branches_live(
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> BranchListOut:
    """Return branches directly from pygit2 (bypasses DB cache)."""
    items = await git_service.list_branches(repository.disk_path)
    return BranchListOut(items=items, total=len(items))


# ---------------------------------------------------------------------------
# Git tree browsing
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/git/tree/{ref}",
    response_model=TreeOut,
    summary="List root directory tree at ref",
)
async def get_root_tree(
    ref: str,
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> TreeOut:
    return await git_service.get_tree(repository.disk_path, ref, path="")


@router.get(
    "/{owner}/{repo}/git/tree/{ref}/{path:path}",
    response_model=TreeOut,
    summary="List directory tree at ref + path",
)
async def get_subtree(
    ref: str,
    path: str,
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> TreeOut:
    return await git_service.get_tree(repository.disk_path, ref, path=path)


# ---------------------------------------------------------------------------
# Blob (file content)
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/git/blob/{ref}/{path:path}",
    response_model=BlobOut,
    summary="Get file content (base64-encoded)",
)
async def get_blob(
    ref: str,
    path: str,
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> BlobOut:
    """
    Return the content of a file at *path* and *ref*.

    Content is base64-encoded in the ``content`` field.  The ``mime_type``
    field gives a best-effort MIME type (e.g. ``text/plain``,
    ``image/png``).  Clients should decode the content before display.
    """
    return await git_service.get_blob(repository.disk_path, ref, path)


# ---------------------------------------------------------------------------
# Commit history
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/git/commits/{ref}",
    response_model=CommitListOut,
    summary="Get paginated commit history",
)
async def get_commits(
    ref: str,
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 30,
) -> CommitListOut:
    items, total = await git_service.get_commits(
        repository.disk_path, ref, page=page, per_page=per_page
    )
    return CommitListOut(ref=ref, items=items, total=total, page=page, per_page=per_page)


# ---------------------------------------------------------------------------
# README
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/git/readme/{ref}",
    response_model=ReadmeOut,
    summary="Get README content (raw Markdown)",
)
async def get_readme(
    ref: str,
    repository: Repository = Depends(get_repository),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> ReadmeOut:
    """
    Locate and return the README at *ref* as raw Markdown (UTF-8).

    Searches for ``README.md``, ``readme.md``, ``README.rst``, ``README``
    in that order.  Returns 404 if no README-like file is found.
    """
    readme = await git_service.get_readme(repository.disk_path, ref)
    if readme is None:
        raise NotFoundError("No README file found in this repository.")
    return readme


# ---------------------------------------------------------------------------
# Star / Unstar
# ---------------------------------------------------------------------------

@router.post(
    "/{owner}/{repo}/star",
    response_model=StarStatusOut,
    summary="Star a repository",
)
async def star_repo(
    repository: Repository = Depends(get_repository),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> StarStatusOut:
    await repo_service.star_repository(db, current_user, repository)
    await db.refresh(repository)
    return StarStatusOut(starred=True, star_count=repository.star_count)


@router.delete(
    "/{owner}/{repo}/star",
    response_model=StarStatusOut,
    summary="Unstar a repository",
)
async def unstar_repo(
    repository: Repository = Depends(get_repository),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> StarStatusOut:
    await repo_service.unstar_repository(db, current_user, repository)
    await db.refresh(repository)
    return StarStatusOut(starred=False, star_count=repository.star_count)


# ---------------------------------------------------------------------------
# Fork
# ---------------------------------------------------------------------------

@router.post(
    "/{owner}/{repo}/fork",
    response_model=RepositoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Fork a repository",
)
async def fork_repo(
    repository: Repository = Depends(get_repository),
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
    owner_organization_id: Optional[uuid.UUID] = None,
) -> RepositoryOut:
    """
    Fork the repository into the authenticated user's namespace
    (or an org they admin, via ``owner_organization_id`` query param).
    """
    forked = await repo_service.fork_repository(
        db,
        source_repo=repository,
        actor=current_user,
        new_owner_org_id=owner_organization_id,
    )
    return RepositoryOut.model_validate(forked)


# ---------------------------------------------------------------------------
# Collaborators
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/collaborators",
    response_model=list[CollaboratorOut],
    summary="List repository collaborators",
)
async def list_collaborators(
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.MAINTAIN, allow_anonymous=False)
    ),
) -> list[CollaboratorOut]:
    collaborators = await repo_service.list_collaborators(db, repository.id)
    return [CollaboratorOut.model_validate(c) for c in collaborators]


@router.post(
    "/{owner}/{repo}/collaborators",
    response_model=CollaboratorOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add or update a collaborator",
)
async def add_collaborator(
    payload: CollaboratorAdd,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> CollaboratorOut:
    collab = await repo_service.add_collaborator(
        db, repository, payload.user_id, payload.permission
    )
    return CollaboratorOut.model_validate(collab)


@router.delete(
    "/{owner}/{repo}/collaborators/{collaborator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a collaborator",
)
async def remove_collaborator(
    collaborator_id: uuid.UUID,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> None:
    await repo_service.remove_collaborator(db, repository, collaborator_id)
