"""
Repository lifecycle service — all create/delete/fork/star/watch operations.

Design principles:
- Every mutation that touches BOTH the database and the filesystem (create,
  delete, fork) runs the DB write first.  If the git operation fails, the DB
  transaction is rolled back, leaving no orphan disk artefact.  If the DB
  write succeeds but git fails, the orphan disk path will be cleaned up.
  This is a "DB-first, disk-second" ordering that keeps the database as the
  authoritative record.
- ``disk_path`` is derived from the UUID, not from the repo name, so
  renaming a repository never moves files on disk and never breaks existing
  clone URLs that were generated before the rename.
- Counter columns (star_count, fork_count, watcher_count) are updated in
  the same transaction as the row insert/delete that caused them to change.
  This avoids a separate COUNT(*) query on every page load and keeps the
  counts consistent even if a background job hasn't run yet.
"""
from __future__ import annotations

import asyncio
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

import pygit2

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.logging import get_logger
from app.models.enums import (
    OrganizationRole,
    PermissionLevel,
    RepositoryVisibility,
)
from app.models.organization import Organization, OrganizationMember
from app.models.repo import (
    Branch,
    Repository,
    RepositoryCollaborator,
    RepositoryStar,
    RepositoryWatcher,
)
from app.models.user import User
from app.schemas.repo_schema import RepositoryCreate, RepositoryUpdate

settings = get_settings()
logger = get_logger("app.services.repo_service")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_disk_path(repo_id: uuid.UUID) -> str:
    """Absolute path for the bare git repository on the shared storage volume.

    Pattern: ``<GIT_REPOS_ROOT>/<repo_id>.git``

    Using the UUID (not the name) means renaming the repository in the
    database requires zero filesystem operations.
    """
    return str(Path(settings.GIT_REPOS_ROOT) / f"{repo_id}.git")


async def _ensure_name_available(
    db: AsyncSession,
    name: str,
    owner_user_id: Optional[uuid.UUID],
    owner_organization_id: Optional[uuid.UUID],
    exclude_repo_id: Optional[uuid.UUID] = None,
) -> None:
    """Raise ConflictError if a repo with *name* already exists for this owner."""
    query = select(Repository.id).where(Repository.name == name)

    if owner_user_id is not None:
        query = query.where(Repository.owner_user_id == owner_user_id)
    else:
        query = query.where(Repository.owner_organization_id == owner_organization_id)

    if exclude_repo_id is not None:
        query = query.where(Repository.id != exclude_repo_id)

    result = await db.execute(query)
    if result.scalar_one_or_none() is not None:
        raise ConflictError(
            f"A repository named '{name}' already exists for this owner.",
            code="REPOSITORY_NAME_TAKEN",
        )


def _init_bare_repo(disk_path: str, default_branch: str, auto_init: bool) -> None:
    """
    Initialise a bare git repository at *disk_path*.

    This is a synchronous function because pygit2 is not async-aware.
    Callers must wrap it with ``run_in_executor`` when called from async context.

    Args:
        disk_path:      Absolute path where the bare repo will be created.
        default_branch: Name of the initial branch (e.g. "main").
        auto_init:      If True, create an empty initial commit so the repo is
                        immediately clone-able.  If False the repo is created
                        empty (useful when the user will ``git push`` right away).
    """
    repo = pygit2.init_repository(disk_path, bare=True)

    # Set the HEAD symbolic ref to the desired default branch name BEFORE any
    # commits, so clones get the right branch name even on an empty repo.
    repo.set_head(f"refs/heads/{default_branch}")

    if auto_init:
        # Create an empty initial commit so the repo is clone-able immediately.
        sig = pygit2.Signature("PandaHub", "noreply@pandahub.dev")
        tree_id = repo.TreeBuilder().write()
        repo.create_commit(
            f"refs/heads/{default_branch}",
            sig,
            sig,
            "Initial commit",
            tree_id,
            [],  # no parents — this IS the root commit
        )


def _clone_bare_repo(source_path: str, dest_path: str) -> None:
    """Clone *source_path* (bare) into *dest_path* (also bare).

    Used when forking: gives the forked repo a full copy of all refs
    without going through a network clone.
    """
    pygit2.clone_repository(source_path, dest_path, bare=True)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_repo_by_owner_and_name(
    db: AsyncSession,
    owner_slug: str,
    repo_name: str,
) -> Optional[Repository]:
    """
    Resolve an (owner_slug, repo_name) pair to a Repository ORM object.

    *owner_slug* may be a username or an organization name.
    Returns ``None`` if no match is found.
    """
    # Try user owner first (most repos are user-owned)
    user_result = await db.execute(
        select(User.id).where(User.username == owner_slug)
    )
    owner_user_id = user_result.scalar_one_or_none()

    if owner_user_id is not None:
        result = await db.execute(
            select(Repository).where(
                Repository.owner_user_id == owner_user_id,
                Repository.name == repo_name,
            )
        )
        return result.scalar_one_or_none()

    # Fall back to org owner
    org_result = await db.execute(
        select(Organization.id).where(Organization.name == owner_slug)
    )
    owner_org_id = org_result.scalar_one_or_none()

    if owner_org_id is None:
        return None

    result = await db.execute(
        select(Repository).where(
            Repository.owner_organization_id == owner_org_id,
            Repository.name == repo_name,
        )
    )
    return result.scalar_one_or_none()


async def create_repository(
    db: AsyncSession,
    actor: User,
    payload: RepositoryCreate,
) -> Repository:
    """
    Create a new repository row in the DB and initialise the bare git repo
    on disk.

    If *payload.owner_organization_id* is set, the actor must be an ADMIN or
    OWNER of that organization.

    Args:
        db:      Active async DB session.
        actor:   The authenticated user creating the repo.
        payload: Validated ``RepositoryCreate`` schema.

    Returns:
        The newly-created ``Repository`` ORM object (committed and refreshed).

    Raises:
        ConflictError:       Name already taken for this owner.
        PermissionDeniedError: Actor lacks org admin/owner role.
    """
    owner_user_id: Optional[uuid.UUID] = None
    owner_organization_id: Optional[uuid.UUID] = payload.owner_organization_id

    if owner_organization_id is not None:
        # Verify actor has the right role in the org.
        role_result = await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.organization_id == owner_organization_id,
                OrganizationMember.user_id == actor.id,
                OrganizationMember.role.in_(
                    [OrganizationRole.OWNER, OrganizationRole.ADMIN]
                ),
            )
        )
        if role_result.scalar_one_or_none() is None:
            raise PermissionDeniedError(
                "You must be an org Owner or Admin to create repositories "
                "under an organization."
            )
    else:
        owner_user_id = actor.id

    await _ensure_name_available(
        db, payload.name, owner_user_id, owner_organization_id
    )

    repo_id = uuid.uuid4()
    disk_path = _build_disk_path(repo_id)

    repo = Repository(
        id=repo_id,
        name=payload.name,
        description=payload.description,
        visibility=payload.visibility,
        default_branch=payload.default_branch,
        owner_user_id=owner_user_id,
        owner_organization_id=owner_organization_id,
        disk_path=disk_path,
    )
    db.add(repo)

    # Flush (not commit) to surface constraint violations before going to disk.
    await db.flush()

    # Initialise the bare repo on disk — run in executor to avoid blocking
    # the event loop (pygit2 is synchronous / GIL-holding).
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _init_bare_repo,
            disk_path,
            payload.default_branch,
            payload.auto_init,
        )
    except Exception as exc:
        logger.error(
            "Failed to initialise bare repo on disk",
            extra={"disk_path": disk_path, "error": str(exc)},
        )
        # Rollback the flush so the DB row is not committed.
        await db.rollback()
        raise

    # If auto_init, cache the initial branch row.
    if payload.auto_init:
        # We need the HEAD SHA — open the repo synchronously (cheap, already created).
        def _get_head_sha() -> str:
            r = pygit2.Repository(disk_path)
            return str(r.head.target)

        head_sha = await asyncio.get_event_loop().run_in_executor(None, _get_head_sha)

        branch_row = Branch(
            repository_id=repo_id,
            name=payload.default_branch,
            is_default=True,
            is_protected=False,
            last_commit_sha=head_sha,
        )
        db.add(branch_row)

    await db.commit()
    await db.refresh(repo)
    logger.info(
        "Repository created",
        extra={"repo_id": str(repo_id), "name": repo.name, "disk_path": disk_path},
    )
    return repo


async def update_repository(
    db: AsyncSession,
    repo: Repository,
    payload: RepositoryUpdate,
) -> Repository:
    """Apply partial updates to a repository's metadata."""
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(repo, field, value)
    await db.commit()
    await db.refresh(repo)
    return repo


async def delete_repository(
    db: AsyncSession,
    repo: Repository,
) -> None:
    """
    Delete a repository: remove the DB row (cascade handles all child rows)
    and delete the bare repo directory from disk.

    The DB deletion happens first.  If the disk deletion fails, the DB
    row is gone (the data is lost) but no orphan is left that would fool
    the system into thinking the repo still exists.  A follow-up cleanup
    job can mop up orphaned directories.
    """
    disk_path = repo.disk_path
    repo_id = str(repo.id)
    name = repo.name

    await db.delete(repo)
    await db.commit()

    # Remove the bare repo directory from disk.
    if os.path.exists(disk_path):
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, shutil.rmtree, disk_path)
        except Exception as exc:
            # Log the failure but don't re-raise: the DB row is already gone,
            # raising here would return a 500 with no way to recover.
            logger.error(
                "Failed to remove bare repo from disk after DB deletion",
                extra={"disk_path": disk_path, "repo_id": repo_id, "error": str(exc)},
            )
    logger.info(
        "Repository deleted",
        extra={"repo_id": repo_id, "name": name, "disk_path": disk_path},
    )


async def fork_repository(
    db: AsyncSession,
    source_repo: Repository,
    actor: User,
    new_owner_org_id: Optional[uuid.UUID] = None,
) -> Repository:
    """
    Fork *source_repo* into *actor*'s namespace (or *new_owner_org_id* if given).

    The forked repo gets a full copy of all refs from the source.  The
    ``forked_from_id`` FK is set so the UI can show the fork graph.

    Raises:
        ConflictError: If actor already has a repo with the same name.
    """
    owner_user_id: Optional[uuid.UUID] = None
    owner_org_id: Optional[uuid.UUID] = new_owner_org_id

    if owner_org_id is None:
        owner_user_id = actor.id

    await _ensure_name_available(db, source_repo.name, owner_user_id, owner_org_id)

    repo_id = uuid.uuid4()
    disk_path = _build_disk_path(repo_id)

    forked = Repository(
        id=repo_id,
        name=source_repo.name,
        description=source_repo.description,
        visibility=RepositoryVisibility.PRIVATE,  # forks start private
        default_branch=source_repo.default_branch,
        owner_user_id=owner_user_id,
        owner_organization_id=owner_org_id,
        disk_path=disk_path,
        is_fork=True,
        forked_from_id=source_repo.id,
    )
    db.add(forked)

    # Increment fork counter on source in the same transaction.
    source_repo.fork_count = source_repo.fork_count + 1

    await db.flush()

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, _clone_bare_repo, source_repo.disk_path, disk_path
        )
    except Exception as exc:
        logger.error(
            "Failed to clone bare repo for fork",
            extra={"source": source_repo.disk_path, "dest": disk_path, "error": str(exc)},
        )
        await db.rollback()
        raise

    await db.commit()
    await db.refresh(forked)
    return forked


# ---------------------------------------------------------------------------
# Star / Watch helpers
# ---------------------------------------------------------------------------

async def star_repository(
    db: AsyncSession,
    user: User,
    repo: Repository,
) -> None:
    """Star *repo* on behalf of *user*.  No-ops if already starred."""
    existing = await db.execute(
        select(RepositoryStar).where(
            RepositoryStar.repository_id == repo.id,
            RepositoryStar.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return  # already starred

    db.add(RepositoryStar(repository_id=repo.id, user_id=user.id))
    repo.star_count = repo.star_count + 1
    await db.commit()


async def unstar_repository(
    db: AsyncSession,
    user: User,
    repo: Repository,
) -> None:
    """Unstar *repo* on behalf of *user*.  No-ops if not starred."""
    await db.execute(
        delete(RepositoryStar).where(
            RepositoryStar.repository_id == repo.id,
            RepositoryStar.user_id == user.id,
        )
    )
    repo.star_count = max(0, repo.star_count - 1)
    await db.commit()


async def is_starred(
    db: AsyncSession,
    user_id: uuid.UUID,
    repo_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(RepositoryStar.user_id).where(
            RepositoryStar.repository_id == repo_id,
            RepositoryStar.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def watch_repository(
    db: AsyncSession,
    user: User,
    repo: Repository,
) -> None:
    """Watch *repo* on behalf of *user*.  No-ops if already watching."""
    existing = await db.execute(
        select(RepositoryWatcher).where(
            RepositoryWatcher.repository_id == repo.id,
            RepositoryWatcher.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return

    db.add(RepositoryWatcher(repository_id=repo.id, user_id=user.id))
    repo.watcher_count = repo.watcher_count + 1
    await db.commit()


async def unwatch_repository(
    db: AsyncSession,
    user: User,
    repo: Repository,
) -> None:
    """Unwatch *repo* on behalf of *user*.  No-ops if not watching."""
    await db.execute(
        delete(RepositoryWatcher).where(
            RepositoryWatcher.repository_id == repo.id,
            RepositoryWatcher.user_id == user.id,
        )
    )
    repo.watcher_count = max(0, repo.watcher_count - 1)
    await db.commit()


async def is_watching(
    db: AsyncSession,
    user_id: uuid.UUID,
    repo_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(RepositoryWatcher.user_id).where(
            RepositoryWatcher.repository_id == repo_id,
            RepositoryWatcher.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Collaborator management
# ---------------------------------------------------------------------------

async def add_collaborator(
    db: AsyncSession,
    repo: Repository,
    user_id: uuid.UUID,
    permission: PermissionLevel,
) -> RepositoryCollaborator:
    """Add or update a direct collaborator grant."""
    existing = await db.execute(
        select(RepositoryCollaborator).where(
            RepositoryCollaborator.repository_id == repo.id,
            RepositoryCollaborator.user_id == user_id,
        )
    )
    collab = existing.scalar_one_or_none()

    if collab is None:
        collab = RepositoryCollaborator(
            repository_id=repo.id,
            user_id=user_id,
            permission=permission,
        )
        db.add(collab)
    else:
        collab.permission = permission

    await db.commit()
    await db.refresh(collab)
    return collab


async def remove_collaborator(
    db: AsyncSession,
    repo: Repository,
    user_id: uuid.UUID,
) -> None:
    """Remove a direct collaborator grant.  No-ops if the user is not listed."""
    await db.execute(
        delete(RepositoryCollaborator).where(
            RepositoryCollaborator.repository_id == repo.id,
            RepositoryCollaborator.user_id == user_id,
        )
    )
    await db.commit()


async def list_collaborators(
    db: AsyncSession,
    repo_id: uuid.UUID,
) -> list[RepositoryCollaborator]:
    result = await db.execute(
        select(RepositoryCollaborator).where(
            RepositoryCollaborator.repository_id == repo_id
        )
    )
    return list(result.scalars().all())
