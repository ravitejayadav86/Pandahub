"""
Permission resolver — the single source of truth for "can user X access repo Y?".

Every module that gate-keeps an action (reading a file, pushing a commit,
merging a PR, deleting a repo) calls ``resolve_permission`` and then checks
the returned level against the minimum it requires.  Nothing else in the
codebase should contain permission-resolution logic.

Resolution chain (evaluated in order; highest resolved level wins):

    1. Owner check      — user IS the owner of the repo            → ADMIN
    2. Org-admin check  — user is an org OWNER/ADMIN of the owning
                          org                                       → ADMIN
    3. Collaborator     — RepositoryCollaborator row                → explicit level
    4. Team grant       — user ∈ Team that has a TeamRepository row → level from row
    5. Visibility       — PUBLIC repo  (any caller)                 → READ
                          INTERNAL repo (authenticated caller)      → READ
    6. No match                                                     → None

Why "highest wins" instead of "first match":
A user can simultaneously be a direct collaborator (WRITE) AND a team member
(READ); taking the first-match result would give different answers depending
on evaluation order, which is confusing.  Collecting all applicable grants
and returning the maximum is deterministic and mirrors what GitHub does.

Performance note:
This layer performs no caching.  A Redis-backed permission-cache middleware
will be added in a later module.  Until then, the queries are efficient:
all FKs are indexed, and the team-grant query is a two-join SELECT that
stays well under 1 ms on any reasonable dataset size.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PermissionLevel, OrganizationRole, RepositoryVisibility
from app.models.organization import OrganizationMember, TeamMember, TeamRepository
from app.models.repo import Repository, RepositoryCollaborator


# ---------------------------------------------------------------------------
# Ordering map — used for "highest wins" comparisons.
# ---------------------------------------------------------------------------
_LEVEL_RANK: dict[PermissionLevel, int] = {
    PermissionLevel.READ:     1,
    PermissionLevel.TRIAGE:   2,
    PermissionLevel.WRITE:    3,
    PermissionLevel.MAINTAIN: 4,
    PermissionLevel.ADMIN:    5,
}


def _max_level(
    a: Optional[PermissionLevel],
    b: Optional[PermissionLevel],
) -> Optional[PermissionLevel]:
    """Return the higher of two optional PermissionLevels (None = no access)."""
    if a is None:
        return b
    if b is None:
        return a
    return a if _LEVEL_RANK[a] >= _LEVEL_RANK[b] else b


def _meets_minimum(
    resolved: Optional[PermissionLevel],
    minimum: PermissionLevel,
) -> bool:
    """True iff *resolved* is at least *minimum*."""
    if resolved is None:
        return False
    return _LEVEL_RANK[resolved] >= _LEVEL_RANK[minimum]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def resolve_permission(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    repo: Repository,
) -> Optional[PermissionLevel]:
    """
    Return the effective ``PermissionLevel`` for *user_id* on *repo*, or
    ``None`` if the caller has no access at all.

    ``user_id=None`` represents an unauthenticated (anonymous) caller.
    Anonymous callers can only receive ``READ`` via step 5 (public repos).

    Args:
        db:      Active async SQLAlchemy session.
        user_id: UUID of the authenticated user, or ``None`` for anonymous.
        repo:    The ORM ``Repository`` object being accessed.

    Returns:
        The effective ``PermissionLevel``, or ``None`` for no access.
    """
    effective: Optional[PermissionLevel] = None

    # ------------------------------------------------------------------
    # Step 1: Direct ownership → immediate ADMIN, no further checks.
    # ------------------------------------------------------------------
    if user_id is not None and repo.owner_user_id == user_id:
        return PermissionLevel.ADMIN

    # ------------------------------------------------------------------
    # Step 2: Org-admin / org-owner → ADMIN on every repo in the org.
    # ------------------------------------------------------------------
    if user_id is not None and repo.owner_organization_id is not None:
        result = await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.organization_id == repo.owner_organization_id,
                OrganizationMember.user_id == user_id,
                OrganizationMember.role.in_(
                    [OrganizationRole.OWNER, OrganizationRole.ADMIN]
                ),
            )
        )
        if result.scalar_one_or_none() is not None:
            return PermissionLevel.ADMIN

    # ------------------------------------------------------------------
    # Step 3: Explicit RepositoryCollaborator grant.
    # ------------------------------------------------------------------
    if user_id is not None:
        result = await db.execute(
            select(RepositoryCollaborator.permission).where(
                RepositoryCollaborator.repository_id == repo.id,
                RepositoryCollaborator.user_id == user_id,
            )
        )
        collab_level: Optional[PermissionLevel] = result.scalar_one_or_none()
        effective = _max_level(effective, collab_level)

    # ------------------------------------------------------------------
    # Step 4: Team → TeamRepository grant.
    #
    # Query: user_id is in a TeamMember row for a Team that has a
    # TeamRepository row for this repo.  A user can be in multiple teams,
    # each with a different grant; we want the maximum.
    # ------------------------------------------------------------------
    if user_id is not None:
        team_grants = await db.execute(
            select(TeamRepository.permission).where(
                TeamRepository.repository_id == repo.id,
                TeamRepository.team_id.in_(
                    select(TeamMember.team_id).where(
                        TeamMember.user_id == user_id
                    )
                ),
            )
        )
        for row in team_grants.scalars().all():
            effective = _max_level(effective, row)

    # If we already have something from steps 3–4, return it — it will
    # always be >= READ, so the visibility fallback can't improve it.
    if effective is not None:
        return effective

    # ------------------------------------------------------------------
    # Step 5: Visibility-based fallback (read-only, no write ever).
    # ------------------------------------------------------------------
    if repo.visibility == RepositoryVisibility.PUBLIC:
        return PermissionLevel.READ

    if repo.visibility == RepositoryVisibility.INTERNAL and user_id is not None:
        # "Internal" = visible to all authenticated users (like GitHub internal)
        return PermissionLevel.READ

    # ------------------------------------------------------------------
    # Step 6: No access.
    # ------------------------------------------------------------------
    return None


async def assert_permission(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    repo: Repository,
    minimum: PermissionLevel,
) -> PermissionLevel:
    """
    Resolve permission and raise ``PermissionDeniedError`` if the resolved
    level is below *minimum*.

    Returns the resolved level so callers can branch on it without a
    second call.

    Raises:
        app.core.exceptions.PermissionDeniedError: if access is insufficient.
        app.core.exceptions.UnauthorizedError: if user is anonymous and the
            repo is not public (they need to log in first).
    """
    # Import here to avoid a circular dependency at module load time.
    from app.core.exceptions import PermissionDeniedError, UnauthorizedError

    resolved = await resolve_permission(db, user_id, repo)

    if not _meets_minimum(resolved, minimum):
        if user_id is None:
            raise UnauthorizedError(
                "Authentication required to access this repository."
            )
        raise PermissionDeniedError(
            f"You do not have '{minimum.value}' permission on "
            f"'{repo.name}'."
        )

    return resolved  # type: ignore[return-value]  # always non-None when _meets_minimum is True
