"""Explicit CI retries are bounded, auditable and never automatic.

These tests use no user credentials, Docker, network, or real repositories.
Repository ADMIN permission is enforced by FastAPI dependencies; the unit
tests call the handler with an already-authorized permission value.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1.ci import CIRetryRequest, request_ci_retry, list_ci_attempts
from app.models.enums import PermissionLevel


def failed_run(*, status="completed", conclusion="failure", attempts=1):
    return SimpleNamespace(
        id=uuid.uuid4(),
        repository_id=uuid.uuid4(),
        branch_name="qa",
        commit_sha="a" * 40,
        status=status, conclusion=conclusion,
        attempt_count=attempts,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        log_excerpt="Original failing assertion",
        runner_credential_id=uuid.uuid4(),
        lease_id=uuid.uuid4(),
        lease_expires_at=None,
        last_heartbeat_at=None,
    )


def database(*items):
    return SimpleNamespace(
        scalar=AsyncMock(side_effect=list(items)),
        commit=AsyncMock(), refresh=AsyncMock(),
    )


def approval():
    return CIRetryRequest(
        operator_confirmed_runner_stopped=True,
        reason="Operator checked host containers and confirmed shutdown",
    )


def test_explicit_cleanup_acknowledgment_and_reason_are_mandatory():
    with pytest.raises(ValidationError):
        CIRetryRequest(
            operator_confirmed_runner_stopped=False,
            reason="Operator inspected host, not yet stopped",
        )
    with pytest.raises(ValidationError):
        CIRetryRequest(
            operator_confirmed_runner_stopped=True,
            reason="retry",
        )


@pytest.mark.asyncio
async def test_retry_preserves_failed_attempt_and_resets_current_summary():
    run = failed_run()
    audit = SimpleNamespace(
        conclusion="failure", completed_at=datetime.now(timezone.utc),
        retry_requested_at=None, retry_reason=None,
    )
    db = database(run, audit)
    result = await request_ci_retry(
        run.id, approval(),
        repository=SimpleNamespace(id=run.repository_id, auto_ci_enabled=True),
        db=db, _perm=PermissionLevel.ADMIN,
    )
    assert result["status"] == "queued"
    assert result["attempt_count"] == 1
    assert result["trusted_for_deployment"] is False
    assert run.status == "queued"
    assert run.conclusion is None
    assert run.log_excerpt is None
    assert run.lease_id is None
    assert run.started_at is None
    assert run.completed_at is None
    assert audit.conclusion == "failure"
    assert audit.completed_at is not None
    assert audit.retry_reason == approval().reason
    assert audit.retry_requested_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("status,conclusion,attempts,enabled", [
    ("queued", None, 1, True),
    ("running", None, 1, True),
    ("completed", "success", 1, True),
    ("completed", "failure", 3, True),
    ("completed", "failure", 1, False),
])
async def test_retry_refuses_unsafe_or_unnecessary_transitions(
    status, conclusion, attempts, enabled,
):
    run = failed_run(status=status, conclusion=conclusion, attempts=attempts)
    db = database(run)
    with pytest.raises(HTTPException) as exc:
        await request_ci_retry(
            run.id, approval(),
            repository=SimpleNamespace(id=run.repository_id, auto_ci_enabled=enabled),
            db=db, _perm=PermissionLevel.ADMIN,
        )
    assert exc.value.status_code == 409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_retry_refuses_incomplete_or_missing_audit():
    run = failed_run()
    db = database(run, None)
    with pytest.raises(HTTPException) as exc:
        await request_ci_retry(
            run.id, approval(),
            repository=SimpleNamespace(id=run.repository_id, auto_ci_enabled=True),
            db=db, _perm=PermissionLevel.ADMIN,
        )
    assert exc.value.status_code == 409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_retry_does_not_accept_duplicate_operator_ack():
    run = failed_run()
    audit = SimpleNamespace(
        conclusion="failure", completed_at=datetime.now(timezone.utc),
        retry_requested_at=datetime.now(timezone.utc),
    )
    db = database(run, audit)
    with pytest.raises(HTTPException) as exc:
        await request_ci_retry(
            run.id, approval(),
            repository=SimpleNamespace(id=run.repository_id, auto_ci_enabled=True),
            db=db, _perm=PermissionLevel.ADMIN,
        )
    assert exc.value.status_code == 409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_attempt_history_is_read_only_and_does_not_expose_leases():
    run = failed_run()
    attempt = SimpleNamespace(
        attempt_number=1,
        started_at=run.started_at,
        completed_at=run.completed_at,
        conclusion="failure",
        end_reason="runner_reported",
        log_excerpt="1 failed",
        retry_requested_at=None,
        retry_reason=None,
        lease_id=uuid.uuid4(),
        runner_credential_id=uuid.uuid4(),
    )
    rows = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [attempt]))
    db = SimpleNamespace(
        scalar=AsyncMock(return_value=run),
        execute=AsyncMock(return_value=rows),
    )
    output = await list_ci_attempts(
        run.id,
        repository=SimpleNamespace(id=run.repository_id),
        db=db, _perm=PermissionLevel.READ,
    )
    assert output[0]["attempt_number"] == 1
    assert output[0]["conclusion"] == "failure"
    assert output[0]["trusted_for_deployment"] is False
    assert "lease_id" not in output[0]
    assert "runner_credential_id" not in output[0]
