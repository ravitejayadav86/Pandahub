from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.repository import (
    BlobRead,
    BranchRead,
    CommitRead,
    RepoCreate,
    RepoRead,
    RepoUpdate,
    TreeEntry,
)
from app.services import git_service, repo_service

router = APIRouter(prefix="/repos", tags=["repositories"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=RepoRead, status_code=status.HTTP_201_CREATED)
async def create_repo(data: RepoCreate, current_user: CurrentUser, db: DbDep):
    """Create a new repository for the authenticated user."""
    repo = await repo_service.create_repository(db, current_user, data)
    repo.owner_username = current_user.username
    return repo


@router.get("/{owner}/{repo_name}", response_model=RepoRead)
async def get_repo(owner: str, repo_name: str, db: DbDep):
    """Get repository metadata."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    from sqlalchemy import select
    from app.models.user import User as UserModel

    result = await db.execute(select(UserModel).where(UserModel.id == repo.owner_id))
    owner_user = result.scalar_one_or_none()
    repo.owner_username = owner_user.username if owner_user else None
    return repo


@router.patch("/{owner}/{repo_name}", response_model=RepoRead)
async def update_repo(
    owner: str, repo_name: str, data: RepoUpdate, current_user: CurrentUser, db: DbDep
):
    """Update repository metadata (owner only)."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    if repo.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(repo, field, value)
    db.add(repo)
    repo.owner_username = current_user.username
    return repo


@router.delete("/{owner}/{repo_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repo(owner: str, repo_name: str, current_user: CurrentUser, db: DbDep):
    """Delete a repository (owner only). IRREVERSIBLE."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    if repo.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner")
    await repo_service.delete_repository(db, repo)


@router.get("/{owner}/{repo_name}/branches", response_model=list[BranchRead])
async def list_branches(owner: str, repo_name: str, db: DbDep):
    """List all branches in the repository."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    return git_service.get_branches(repo)


@router.get("/{owner}/{repo_name}/commits/{ref:path}", response_model=list[CommitRead])
async def list_commits(owner: str, repo_name: str, ref: str, db: DbDep, limit: int = 30):
    """List commits on a branch/tag/SHA."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    return git_service.get_commits(repo, ref, limit=limit)


@router.get("/{owner}/{repo_name}/tree/{ref}", response_model=list[TreeEntry])
async def get_tree_root(owner: str, repo_name: str, ref: str, db: DbDep):
    """List files/folders at the repo root for the given ref."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    return git_service.get_tree(repo, ref, path="")


@router.get("/{owner}/{repo_name}/tree/{ref}/{path:path}", response_model=list[TreeEntry])
async def get_tree_path(owner: str, repo_name: str, ref: str, path: str, db: DbDep):
    """List files/folders at a specific path for the given ref."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    return git_service.get_tree(repo, ref, path=path)


@router.get("/{owner}/{repo_name}/blob/{ref}/{path:path}", response_model=BlobRead)
async def get_blob(owner: str, repo_name: str, ref: str, path: str, db: DbDep):
    """Read a file's content at the given ref."""
    repo = await repo_service.get_repo_by_slug(db, owner, repo_name)
    return git_service.get_blob(repo, ref, path)
