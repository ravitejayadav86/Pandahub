"""Native CI operator timeout: fail closed, never forge deployment success."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException
from app.api.v1.ci import (
    CIResult,
    ci_run_is_stale,
    complete_ci_run,
    mark_stale_ci_run_timed_out,
)
from app.models.enums import PermissionLevel
import pytest


def make_run(age_minutes: float, status="running"):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid.uuid4(),
        repository_id=uuid.uuid4(),
        branch_name="qa",
        commit_sha="a" * 40,
        status=status,
        conclusion=None,
        log_excerpt=None,
        started_at=now - timedelta(minutes=age_minutes),
        completed_at=None,
        created_at=now - timedelta(minutes=age_minutes),
    )


def make_db(run):
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=run),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    return db


def test_stale_run_requires_real_aware_start_time():
    now = datetime.now(timezone.utc)
    assert ci_run_is_stale("running", now - timedelta(minutes=11), now)
    assert not ci_run_is_stale("running", now - timedelta(minutes=1), now)
    assert not ci_run_is_stale("queued", now - timedelta(minutes=30), now)
    assert not ci_run_is_stale("completed", now - timedelta(minutes=30), now)
    assert not ci_run_is_stale("running", None, now)
    assert not ci_run_is_stale("running", now.replace(tzinfo=None), now)
    assert not ci_run_is_stale(
        "running", now - timedelta(minutes=20), now,
        now + timedelta(minutes=1),
    )
    assert ci_run_is_stale(
        "running", now - timedelta(minutes=20), now,
        now - timedelta(seconds=1),
    )


@pytest.mark.asyncio
async def test_admin_can_mark_only_stale_running_job_as_unverified_timeout():
    run = make_run(12)
    db = make_db(run)
    response = await mark_stale_ci_run_timed_out(
        run.id, repository=SimpleNamespace(id=run.repository_id),
        db=db, _perm=PermissionLevel.ADMIN,
    )
    assert response["status"] == "completed"
    assert response["conclusion"] == "timed_out"
    assert response["attestation"] == "repository_admin_reported"
    assert response["trusted_for_deployment"] is False
    assert "not" in response["log_excerpt"].lower()
    assert "Docker" in response["log_excerpt"]
    assert run.completed_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "age,status",
    [(1, "running"), (100, "queued"), (100, "completed")],
)
async def test_admin_cannot_timeout_recent_queued_or_completed_jobs(age, status):
    run = make_run(age, status=status)
    db = make_db(run)
    with pytest.raises(HTTPException) as exc:
        await mark_stale_ci_run_timed_out(
            run.id, repository=SimpleNamespace(id=run.repository_id),
            db=db, _perm=PermissionLevel.ADMIN,
        )
    assert exc.value.status_code == 409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_job_cannot_be_marked_timed_out():
    db = make_db(None)
    with pytest.raises(HTTPException) as exc:
        await mark_stale_ci_run_timed_out(
            uuid.uuid4(), repository=SimpleNamespace(id=uuid.uuid4()),
            db=db, _perm=PermissionLevel.ADMIN,
        )
    assert exc.value.status_code == 404
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_completed_timeout_cannot_be_overwritten_with_success():
    run = make_run(20, status="completed")
    run.conclusion = "timed_out"
    db = make_db(run)
    with pytest.raises(HTTPException) as exc:
        await complete_ci_run(
            run.id, payload=CIResult(conclusion="success", log_excerpt="fake"),
            repository=SimpleNamespace(id=run.repository_id),
            db=db, _perm=PermissionLevel.ADMIN,
        )
    assert exc.value.status_code == 410
    assert run.conclusion == "timed_out"
    db.commit.assert_not_awaited()
