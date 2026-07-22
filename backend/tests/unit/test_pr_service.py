"""
Unit tests for the PR service (app/services/pr_service.py).
"""
import uuid
from datetime import datetime, timezone
import sys
from unittest.mock import AsyncMock, MagicMock, patch

# Mock pygit2 BEFORE importing any module that depends on it (like merger.py)
sys.modules["pygit2"] = MagicMock()

import pytest
from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, AppError
from app.models.enums import PullRequestState, PermissionLevel
from app.models.pull_request import PullRequest
from app.models.repo import Repository
from app.models.user import User
from app.schemas.pr_schema import PullRequestCreate, PullRequestUpdate
from app.services.pr_service import (
    create_pull_request,
    update_pull_request,
    merge_pull_request,
)


def _make_user(is_active: bool = True) -> User:
    user = User()
    user.id = uuid.uuid4()
    user.username = "testuser"
    user.is_active = is_active
    return user


def _make_repo() -> Repository:
    repo = Repository()
    repo.id = uuid.uuid4()
    repo.name = "testrepo"
    repo.disk_path = "/tmp/test.git"
    return repo


def _db_mock_sequence(*values) -> AsyncMock:
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
    return db


@pytest.mark.asyncio
async def test_create_pull_request_already_exists():
    repo = _make_repo()
    author = _make_user()
    payload = PullRequestCreate(
        title="Test PR",
        source_branch="feature",
        target_branch="main",
    )
    
    existing_pr = PullRequest()
    db = _db_mock_sequence(existing_pr)
    
    with pytest.raises(ConflictError, match="open Pull Request already exists"):
        await create_pull_request(db, repo, author, payload)


@pytest.mark.asyncio
async def test_create_pull_request_success():
    repo = _make_repo()
    author = _make_user()
    payload = PullRequestCreate(
        title="Test PR",
        source_branch="feature",
        target_branch="main",
    )
    
    pr_mock = PullRequest(
        id=uuid.uuid4(),
        repository_id=repo.id,
        number=1,
        title="Test PR",
        state=PullRequestState.OPEN,
    )

    # 1: existing PR check (returns None)
    # 2: max number check (returns None -> number 1)
    # 3: get PR after create (returns pr_mock)
    db = _db_mock_sequence(None, None, pr_mock)
    
    result = await create_pull_request(db, repo, author, payload)
    
    assert result == pr_mock
    db.add.assert_called_once()
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_update_pull_request_state_permission_denied():
    repo_id = uuid.uuid4()
    author = _make_user()
    other_user = _make_user()
    
    pr_mock = PullRequest(
        id=uuid.uuid4(),
        repository_id=repo_id,
        number=1,
        author_id=author.id,
        state=PullRequestState.OPEN,
    )
    
    payload = PullRequestUpdate(state=PullRequestState.CLOSED)
    db = _db_mock_sequence(pr_mock)
    
    with pytest.raises(PermissionDeniedError, match="Only the author or a triager can change PR state"):
        await update_pull_request(db, repo_id, 1, payload, other_user, PermissionLevel.READ)


@pytest.mark.asyncio
@patch("app.services.pr_service.merge_commit")
@patch("asyncio.get_running_loop")
async def test_merge_pull_request_success(mock_get_loop, mock_merge_commit):
    repo = _make_repo()
    actor = _make_user()
    
    pr_mock = PullRequest(
        id=uuid.uuid4(),
        repository_id=repo.id,
        number=1,
        author_id=actor.id,
        source_branch="feature",
        target_branch="main",
        source_repository_id=repo.id,
        state=PullRequestState.OPEN,
    )
    
    db = _db_mock_sequence(pr_mock)
    
    mock_loop = MagicMock()
    mock_get_loop.return_value = mock_loop
    mock_loop.run_in_executor = AsyncMock(return_value="new_commit_sha")
    
    result = await merge_pull_request(db, repo, 1, actor, PermissionLevel.WRITE)
    
    assert result.state == PullRequestState.MERGED
    assert result.merge_commit_sha == "new_commit_sha"
    assert result.merged_by_id == actor.id
    db.commit.assert_called_once()
    mock_loop.run_in_executor.assert_called_once()


@pytest.mark.asyncio
async def test_merge_pull_request_permission_denied():
    repo = _make_repo()
    actor = _make_user()
    db = _db_mock_sequence()
    
    with pytest.raises(PermissionDeniedError, match="Write access is required"):
        await merge_pull_request(db, repo, 1, actor, PermissionLevel.TRIAGE)
