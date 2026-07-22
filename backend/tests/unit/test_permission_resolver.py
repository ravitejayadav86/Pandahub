"""
Unit tests for the permission resolver.

These tests use ``AsyncMock`` and ``MagicMock`` to stub the database
session — no real Postgres is needed.  The resolver's logic is pure
conditional SQL + comparison; mocking the DB lets us verify every branch
of the decision tree without any infrastructure.

Test matrix:
  1.  User-owned repo, caller IS the owner                → ADMIN
  2.  Org-owned repo, caller is org OWNER                 → ADMIN
  3.  Org-owned repo, caller is org ADMIN                 → ADMIN
  4.  Org-owned repo, caller is org MEMBER                → continues chain
  5.  Direct collaborator (WRITE)                         → WRITE
  6.  Team grant (READ) + direct collab (WRITE)           → WRITE (highest)
  7.  Team grant only (MAINTAIN)                          → MAINTAIN
  8.  Public repo, anonymous caller                       → READ
  9.  Public repo, authenticated caller with no grants    → READ
  10. INTERNAL repo, authenticated caller, no grants      → READ
  11. INTERNAL repo, anonymous caller                     → None
  12. Private repo, anonymous caller                      → None
  13. Private repo, authenticated caller, no grants       → None
  14. _meets_minimum: WRITE ≥ READ → True
  15. _meets_minimum: READ ≥ WRITE → False
  16. _meets_minimum: None ≥ READ  → False
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import (
    OrganizationRole,
    PermissionLevel,
    RepositoryVisibility,
)
from app.permissions.resolver import _meets_minimum, resolve_permission


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo(
    *,
    owner_user_id: uuid.UUID | None = None,
    owner_organization_id: uuid.UUID | None = None,
    visibility: RepositoryVisibility = RepositoryVisibility.PRIVATE,
) -> MagicMock:
    """Build a minimal mock Repository object."""
    repo = MagicMock()
    repo.id = uuid.uuid4()
    repo.name = "test-repo"
    repo.owner_user_id = owner_user_id
    repo.owner_organization_id = owner_organization_id
    repo.visibility = visibility
    return repo


def _scalar_none() -> AsyncMock:
    """Mock for a DB result that returns None (no matching row)."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    execute = AsyncMock(return_value=result)
    return execute


def _scalar_value(value) -> AsyncMock:
    """Mock for a DB result that returns *value*."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    execute = AsyncMock(return_value=result)
    return execute


def _scalars_all(values: list) -> AsyncMock:
    """Mock for a DB result where ``.scalars().all()`` returns *values*."""
    scalars_result = MagicMock()
    scalars_result.all.return_value = values
    result = MagicMock()
    result.scalars.return_value = scalars_result
    execute = AsyncMock(return_value=result)
    return execute


def _make_db(*side_effects) -> AsyncMock:
    """
    Return an AsyncMock db session whose ``execute`` call cycles through
    *side_effects* in order.  Each side_effect is the return value of a
    single ``await db.execute(...)`` call.
    """
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=list(side_effects))
    return db


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_owner_of_user_repo_gets_admin():
    """Step 1: user owns the repo → immediate ADMIN, no DB queries needed."""
    user_id = uuid.uuid4()
    repo = _make_repo(owner_user_id=user_id)
    db = AsyncMock()  # execute should never be called

    result = await resolve_permission(db, user_id, repo)

    assert result == PermissionLevel.ADMIN
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_org_owner_gets_admin():
    """Step 2: caller is org OWNER → ADMIN even without explicit collab row."""
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    repo = _make_repo(owner_organization_id=org_id)

    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = OrganizationRole.OWNER
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    result = await resolve_permission(db, user_id, repo)

    assert result == PermissionLevel.ADMIN
    # Only one DB call — step 2 org membership query.
    assert db.execute.call_count == 1


@pytest.mark.asyncio
async def test_org_admin_gets_admin():
    """Step 2: org ADMIN also gets repo ADMIN."""
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    repo = _make_repo(owner_organization_id=org_id)

    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = OrganizationRole.ADMIN
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)

    result = await resolve_permission(db, user_id, repo)
    assert result == PermissionLevel.ADMIN


@pytest.mark.asyncio
async def test_org_member_falls_through_to_collab_check():
    """
    Org MEMBER does NOT get automatic admin; resolution continues to step 3.
    If no collab row and no team grant, a private repo → None.
    """
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    repo = _make_repo(owner_organization_id=org_id, visibility=RepositoryVisibility.PRIVATE)

    # Step 2: org membership query → None (user is not OWNER/ADMIN — the WHERE
    # clause filters to only OWNER/ADMIN roles, so no row is returned).
    step2_result = MagicMock()
    step2_result.scalar_one_or_none.return_value = None

    # Step 3: collaborator query → None
    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = None

    # Step 4: team grant query → empty list
    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = []
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step2_result, step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result is None


@pytest.mark.asyncio
async def test_direct_collaborator_write():
    """Step 3: explicit RepositoryCollaborator row → returns that level."""
    user_id = uuid.uuid4()
    repo = _make_repo(owner_user_id=uuid.uuid4())  # different user owns it

    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = PermissionLevel.WRITE

    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = []
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result == PermissionLevel.WRITE


@pytest.mark.asyncio
async def test_highest_wins_collab_write_team_read():
    """
    Step 3+4: collab=WRITE, team=READ → WRITE (highest wins).
    """
    user_id = uuid.uuid4()
    repo = _make_repo(owner_user_id=uuid.uuid4())

    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = PermissionLevel.WRITE

    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = [PermissionLevel.READ]
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result == PermissionLevel.WRITE


@pytest.mark.asyncio
async def test_team_grant_only():
    """Step 4: team grant only → resolves to team level."""
    user_id = uuid.uuid4()
    repo = _make_repo(owner_user_id=uuid.uuid4())

    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = None  # no collab row

    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = [PermissionLevel.MAINTAIN]
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result == PermissionLevel.MAINTAIN


@pytest.mark.asyncio
async def test_public_repo_anonymous():
    """Step 5: public repo + anonymous caller → READ."""
    repo = _make_repo(visibility=RepositoryVisibility.PUBLIC)
    db = AsyncMock()
    db.execute = AsyncMock()  # should never be called for anonymous + public

    result = await resolve_permission(db, None, repo)

    assert result == PermissionLevel.READ
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_public_repo_authenticated_no_grants():
    """Step 5 fallback: authenticated user with no grants on a public repo → READ."""
    user_id = uuid.uuid4()
    repo = _make_repo(
        owner_user_id=uuid.uuid4(),
        visibility=RepositoryVisibility.PUBLIC,
    )

    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = None

    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = []
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result == PermissionLevel.READ


@pytest.mark.asyncio
async def test_internal_repo_authenticated_no_grants():
    """Step 5: INTERNAL repo + authenticated caller → READ."""
    user_id = uuid.uuid4()
    repo = _make_repo(
        owner_user_id=uuid.uuid4(),
        visibility=RepositoryVisibility.INTERNAL,
    )

    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = None

    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = []
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result == PermissionLevel.READ


@pytest.mark.asyncio
async def test_internal_repo_anonymous():
    """Step 5+6: INTERNAL repo + anonymous caller → None."""
    repo = _make_repo(visibility=RepositoryVisibility.INTERNAL)
    db = AsyncMock()
    db.execute = AsyncMock()

    result = await resolve_permission(db, None, repo)

    assert result is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_private_repo_anonymous():
    """Step 6: private repo + anonymous caller → None, no DB calls."""
    repo = _make_repo(visibility=RepositoryVisibility.PRIVATE)
    db = AsyncMock()
    db.execute = AsyncMock()

    result = await resolve_permission(db, None, repo)

    assert result is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_private_repo_no_grants():
    """Step 6: private repo, authenticated user with no grants → None."""
    user_id = uuid.uuid4()
    repo = _make_repo(
        owner_user_id=uuid.uuid4(),
        visibility=RepositoryVisibility.PRIVATE,
    )

    step3_result = MagicMock()
    step3_result.scalar_one_or_none.return_value = None

    step4_result = MagicMock()
    step4_scalars = MagicMock()
    step4_scalars.all.return_value = []
    step4_result.scalars.return_value = step4_scalars

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[step3_result, step4_result])

    result = await resolve_permission(db, user_id, repo)
    assert result is None


# ---------------------------------------------------------------------------
# _meets_minimum helper
# ---------------------------------------------------------------------------

def test_meets_minimum_write_ge_read():
    assert _meets_minimum(PermissionLevel.WRITE, PermissionLevel.READ) is True


def test_meets_minimum_read_lt_write():
    assert _meets_minimum(PermissionLevel.READ, PermissionLevel.WRITE) is False


def test_meets_minimum_same_level():
    assert _meets_minimum(PermissionLevel.ADMIN, PermissionLevel.ADMIN) is True


def test_meets_minimum_none():
    assert _meets_minimum(None, PermissionLevel.READ) is False


def test_meets_minimum_all_levels_ordered():
    """ADMIN > MAINTAIN > WRITE > TRIAGE > READ."""
    ordered = [
        PermissionLevel.READ,
        PermissionLevel.TRIAGE,
        PermissionLevel.WRITE,
        PermissionLevel.MAINTAIN,
        PermissionLevel.ADMIN,
    ]
    for i, level in enumerate(ordered):
        for j, minimum in enumerate(ordered):
            expected = i >= j
            assert _meets_minimum(level, minimum) == expected, (
                f"_meets_minimum({level}, {minimum}) should be {expected}"
            )
