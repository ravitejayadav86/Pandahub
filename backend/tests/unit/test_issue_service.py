"""
Unit tests for the issue service (app/services/issue_service.py).

Testing the core business logic of the issue service using mocked DB sessions.
Specifically focusing on:
1. Sequential number assignment (FOR UPDATE locking)
2. Issue creation with relationships (labels, assignees)
3. State transitions (open/close)
4. Locking permissions (TRIAGE required)
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.enums import IssueState, PermissionLevel
from app.models.issue import Issue, IssueAssignee, IssueLabel
from app.models.user import User
from app.schemas.issue_schema import IssueCreate, IssueUpdate
from app.services.issue_service import (
    _assign_next_number,
    create_issue,
    update_issue,
    close_issue,
    reopen_issue,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(is_active: bool = True) -> User:
    user = User()
    user.id = uuid.uuid4()
    user.username = "testuser"
    user.is_active = is_active
    return user

def _db_mock_sequence(*values) -> AsyncMock:
    """Mock a DB session where scalar_one_or_none() or scalar() returns items in sequence."""
    results = []
    for v in values:
        r = MagicMock()
        r.scalar.return_value = v
        r.scalar_one_or_none.return_value = v
        r.scalars.return_value.all.return_value = v if isinstance(v, list) else [v]
        results.append(r)
    
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=results)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return db

# ---------------------------------------------------------------------------
# Number assignment
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_assign_next_number_first_issue():
    repo_id = uuid.uuid4()
    db = _db_mock_sequence(None)  # max(number) is None
    number = await _assign_next_number(db, repo_id)
    assert number == 1

@pytest.mark.asyncio
async def test_assign_next_number_existing_issues():
    repo_id = uuid.uuid4()
    db = _db_mock_sequence(42)  # max(number) is 42
    number = await _assign_next_number(db, repo_id)
    assert number == 43

# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_issue():
    repo_id = uuid.uuid4()
    author = _make_user()
    
    payload = IssueCreate(
        title="Test issue",
        description="A bug",
    )
    
    issue_mock = Issue(
        id=uuid.uuid4(),
        repository_id=repo_id,
        number=1,
        title="Test issue",
        description="A bug",
        state=IssueState.OPEN,
        is_locked=False,
    )

    # 1: assign_next_number (max returns None)
    # 2: _get_issue_or_404 (returns issue_mock)
    db = _db_mock_sequence(None, issue_mock)
    
    result = await create_issue(db, repo_id, author, payload)
    
    assert result == issue_mock
    assert db.add.call_count == 1  # only Issue added, no labels/assignees
    db.commit.assert_called_once()

# ---------------------------------------------------------------------------
# Update & State transitions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_issue_lock_denied_for_read():
    repo_id = uuid.uuid4()
    author = _make_user()
    
    issue_mock = Issue(
        id=uuid.uuid4(),
        repository_id=repo_id,
        number=1,
        author_id=author.id,
        state=IssueState.OPEN,
        is_locked=False,
    )

    payload = IssueUpdate(is_locked=True)
    db = _db_mock_sequence(issue_mock)
    
    with pytest.raises(PermissionDeniedError, match="Only triagers can lock/unlock issues"):
        await update_issue(db, repo_id, 1, payload, author, PermissionLevel.READ)

@pytest.mark.asyncio
async def test_update_issue_state_by_author():
    repo_id = uuid.uuid4()
    author = _make_user()
    
    issue_mock = Issue(
        id=uuid.uuid4(),
        repository_id=repo_id,
        number=1,
        author_id=author.id,
        state=IssueState.OPEN,
        is_locked=False,
    )

    payload = IssueUpdate(state=IssueState.CLOSED)
    
    # 1: _get_issue_or_404 (before update)
    # 2: _get_issue_or_404 (after update)
    db = _db_mock_sequence(issue_mock, issue_mock)
    
    # Read permission is enough for the author to close their own issue
    result = await update_issue(db, repo_id, 1, payload, author, PermissionLevel.READ)
    
    assert issue_mock.state == IssueState.CLOSED
    assert issue_mock.closed_at is not None
    db.commit.assert_called_once()

@pytest.mark.asyncio
async def test_update_issue_state_by_triager():
    repo_id = uuid.uuid4()
    author = _make_user()
    other_user = _make_user()
    
    issue_mock = Issue(
        id=uuid.uuid4(),
        repository_id=repo_id,
        number=1,
        author_id=author.id,
        state=IssueState.OPEN,
        is_locked=False,
    )

    payload = IssueUpdate(state=IssueState.CLOSED)
    
    # 1: _get_issue_or_404 (before update)
    # 2: _get_issue_or_404 (after update)
    db = _db_mock_sequence(issue_mock, issue_mock)
    
    # Triager can close someone else's issue
    result = await update_issue(db, repo_id, 1, payload, other_user, PermissionLevel.TRIAGE)
    
    assert issue_mock.state == IssueState.CLOSED
    assert issue_mock.closed_at is not None

@pytest.mark.asyncio
async def test_update_issue_state_denied():
    repo_id = uuid.uuid4()
    author = _make_user()
    other_user = _make_user()
    
    issue_mock = Issue(
        id=uuid.uuid4(),
        repository_id=repo_id,
        number=1,
        author_id=author.id,
        state=IssueState.OPEN,
        is_locked=False,
    )

    payload = IssueUpdate(state=IssueState.CLOSED)
    db = _db_mock_sequence(issue_mock)
    
    with pytest.raises(PermissionDeniedError, match="Only the author or a triager can change issue state"):
        await update_issue(db, repo_id, 1, payload, other_user, PermissionLevel.READ)

