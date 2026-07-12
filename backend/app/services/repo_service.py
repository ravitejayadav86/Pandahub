"""
Repository service: create/delete repos on disk using pygit2.
"""
import os
import shutil
from pathlib import Path

import pygit2
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.repository import Repository
from app.models.user import User
from app.schemas.repository import RepoCreate


def _repo_disk_path(owner_username: str, repo_name: str) -> Path:
    """Resolve the absolute path where the bare git repo lives."""
    return Path(settings.GIT_REPOS_ROOT) / owner_username / f"{repo_name}.git"


async def create_repository(
    db: AsyncSession,
    owner: User,
    data: RepoCreate,
) -> Repository:
    """Create DB record + initialise bare git repo on disk."""
    # Check name uniqueness for this owner
    existing = await db.execute(
        select(Repository).where(
            Repository.owner_id == owner.id,
            Repository.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository '{data.name}' already exists for user '{owner.username}'",
        )

    disk_path = _repo_disk_path(owner.username, data.name)
    slug = f"{owner.username}/{data.name}"

    # Create bare git repo
    disk_path.parent.mkdir(parents=True, exist_ok=True)
    bare_repo = pygit2.init_repository(str(disk_path), bare=True)

    if data.auto_init:
        _auto_init_repo(bare_repo, data.default_branch)

    repo = Repository(
        owner_id=owner.id,
        name=data.name,
        slug=slug,
        description=data.description,
        visibility=data.visibility,
        default_branch=data.default_branch,
        disk_path=str(disk_path),
    )
    db.add(repo)
    await db.flush()
    return repo


def _auto_init_repo(bare_repo: pygit2.Repository, default_branch: str = "main") -> None:
    """Create an initial empty commit so the repo has a valid HEAD."""
    try:
        sig = pygit2.Signature("PandaHub", "noreply@pandahub.dev")
        empty_tree = bare_repo.TreeBuilder().write()

        readme_blob = bare_repo.create_blob(b"# My Repository\n\nWelcome to PandaHub!\n")
        tb = bare_repo.TreeBuilder()
        tb.insert("README.md", readme_blob, pygit2.GIT_FILEMODE_BLOB)
        tree_oid = tb.write()

        bare_repo.create_commit(
            f"refs/heads/{default_branch}",
            sig,
            sig,
            "Initial commit",
            tree_oid,
            [],
        )
        # Set HEAD
        bare_repo.set_head(f"refs/heads/{default_branch}")
    except Exception:
        # Non-fatal: repo is still valid, just empty
        pass


async def delete_repository(db: AsyncSession, repo: Repository) -> None:
    """Delete the DB record and the bare git repo from disk."""
    disk_path = Path(repo.disk_path)
    await db.delete(repo)
    await db.flush()
    if disk_path.exists():
        shutil.rmtree(disk_path, ignore_errors=True)


async def get_repo_by_slug(db: AsyncSession, owner_username: str, repo_name: str) -> Repository:
    slug = f"{owner_username}/{repo_name}"
    result = await db.execute(select(Repository).where(Repository.slug == slug))
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo
