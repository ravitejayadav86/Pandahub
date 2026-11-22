"""Repository-scoped runner tokens, atomic job leases and result fencing.

No live credentials, network, Git hosting, or Docker are used in these tests.
The PostgreSQL integration suite separately checks the migration schema.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException
import pytest

from app.api.v1.ci_runner import (
    LEASE_DURATION,
    RunnerConclusion,
    RunnerLeaseProof,
    RunnerRegistration,
    _lease_valid,
    create_runner_credential,
    runner_claim_next,
    runner_heartbeat,
    runner_complete,
)
from app.services.ci_runner_auth import (
    authenticate_runner, mint_runner_token, parse_runner_token,
)


def credential(token: str, ident: uuid.UUID, repo_id: uuid.UUID):
    return SimpleNamespace(
        id=ident, repository_id=repo_id,
        token_sha256=hashlib.sha256(token.encode()).hexdigest(),
        revoked_at=None, last_used_at=None,
    )


def database(*answers):
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=list(answers)),
        commit=AsyncMock(),
        refresh=AsyncMock(),
        add=lambda row: None,
    )
    return db


def queued_job(repo_id: uuid.UUID):
    return SimpleNamespace(
        id=uuid.uuid4(), repository_id=repo_id,
        branch_name="qa", commit_sha="a" * 40,
        status="queued", attempt_count=0, started_at=None,
        runner_credential_id=None, lease_id=None,
        lease_expires_at=None, last_heartbeat_at=None,
    )


def test_credential_randomness_storage_and_token_shape():
    first_id, first_token, first_hash = mint_runner_token()
    second_id, second_token, _ = mint_runner_token()
    assert first_id != second_id
    assert first_token != second_token
    assert parse_runner_token(first_token) == first_id
    assert first_hash == hashlib.sha256(first_token.encode()).hexdigest()
    assert first_hash != first_token
    assert parse_runner_token("bad") is None
    assert parse_runner_token("phci_" + first_id.hex + "_invalid") is None


@pytest.mark.asyncio
async def test_invalid_runner_secret_rejected_before_database_access():
    db = database()
    with pytest.raises(HTTPException) as error:
        await authenticate_runner(db, uuid.uuid4(), "invalid")
    assert error.value.status_code == 401
    db.scalar.assert_not_awaited()


@pytest.mark.asyncio
async def test_rejected_mismatched_digest_never_changes_last_used():
    repo = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    record = credential(token + "different", ident, repo)
    db = database(record)
    with pytest.raises(HTTPException) as error:
        await authenticate_runner(db, repo, token)
    assert error.value.status_code == 401
    assert record.last_used_at is None


@pytest.mark.asyncio
async def test_admin_provisions_hashed_runner_secret_only():
    repo_id = uuid.uuid4()
    db = database(0)
    saved = []
    db.add = saved.append
    response = await create_runner_credential(
        RunnerRegistration(name="Local QA"),
        repository=SimpleNamespace(id=repo_id), db=db, _perm=None,
    )
    assert response["token"].startswith("phci_")
    assert saved[0].token_sha256 == hashlib.sha256(
        response["token"].encode()
    ).hexdigest()
    assert response["token"] not in str(saved[0].__dict__)
    assert saved[0].repository_id == repo_id
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_credential_cannot_claim_if_ci_disabled():
    repo_id = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    db = database(credential(token, ident, repo_id))
    with pytest.raises(HTTPException) as error:
        await runner_claim_next(
            repository=SimpleNamespace(id=repo_id, auto_ci_enabled=False),
            db=db, token=token,
        )
    assert error.value.status_code == 409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_single_claim_assigns_scoped_identity_and_finite_lease():
    repo_id = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    job = queued_job(repo_id)
    db = database(credential(token, ident, repo_id), job)
    claimed = await runner_claim_next(
        repository=SimpleNamespace(id=repo_id, auto_ci_enabled=True),
        db=db, token=token,
    )
    assert job.status == "running"
    assert job.runner_credential_id == ident
    assert job.lease_id == uuid.UUID(claimed["lease_id"])
    assert job.lease_expires_at - job.started_at == LEASE_DURATION
    assert claimed["trusted_for_deployment"] is False
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_no_queued_jobs_returns_204_and_no_fake_run():
    repo_id = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    db = database(credential(token, ident, repo_id), None)
    response = await runner_claim_next(
        repository=SimpleNamespace(id=repo_id, auto_ci_enabled=True),
        db=db, token=token,
    )
    assert response.status_code == 204
    db.commit.assert_awaited_once()


def test_expired_wrong_runner_or_wrong_lease_is_denied():
    now = datetime.now(timezone.utc)
    repo_id = uuid.uuid4()
    runner_id = uuid.uuid4()
    run = queued_job(repo_id)
    run.status = "running"
    run.started_at = now - timedelta(minutes=1)
    run.runner_credential_id = runner_id
    run.lease_id = uuid.uuid4()
    run.lease_expires_at = now + timedelta(minutes=1)
    assert _lease_valid(run, runner_id, run.lease_id, now)
    assert not _lease_valid(run, uuid.uuid4(), run.lease_id, now)
    assert not _lease_valid(run, runner_id, uuid.uuid4(), now)
    assert not _lease_valid(run, runner_id, run.lease_id, now + timedelta(minutes=2))
    run.status = "completed"
    assert not _lease_valid(run, runner_id, run.lease_id, now)
    run.status = "running"
    assert not _lease_valid(
        run, runner_id, run.lease_id, now + timedelta(minutes=11)
    )


@pytest.mark.asyncio
async def test_heartbeat_extends_only_current_lease():
    repo_id = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    job = queued_job(repo_id)
    job.status = "running"
    job.started_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    job.runner_credential_id = ident
    job.lease_id = uuid.uuid4()
    job.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=20)
    db = database(credential(token, ident, repo_id), job)
    result = await runner_heartbeat(
        job.id, RunnerLeaseProof(lease_id=job.lease_id),
        repository=SimpleNamespace(id=repo_id), db=db, token=token,
    )
    assert result["status"] == "running"
    assert job.lease_expires_at > datetime.now(timezone.utc) + timedelta(minutes=2)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_late_result_cannot_replace_expired_lease_with_success():
    repo_id = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    job = queued_job(repo_id)
    job.status = "running"
    job.started_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    job.runner_credential_id = ident
    job.lease_id = uuid.uuid4()
    job.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db = database(credential(token, ident, repo_id), job)
    with pytest.raises(HTTPException) as exc:
        await runner_complete(
            job.id, RunnerConclusion(
                lease_id=job.lease_id, conclusion="success", log_excerpt="fake"
            ), repository=SimpleNamespace(id=repo_id), db=db, token=token,
        )
    assert exc.value.status_code == 409
    db.commit.assert_not_awaited()
    assert job.status == "running"


@pytest.mark.asyncio
async def test_valid_completion_preserves_advisory_status_and_burns_lease():
    repo_id = uuid.uuid4()
    ident, token, _ = mint_runner_token()
    job = queued_job(repo_id)
    job.status = "running"
    job.started_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    job.runner_credential_id = ident
    job.lease_id = uuid.uuid4()
    job.lease_expires_at = datetime.now(timezone.utc) + timedelta(minutes=2)
    audited = SimpleNamespace(
        run_id=job.id, attempt_number=1, lease_id=job.lease_id,
        completed_at=None, conclusion=None, log_excerpt=None, end_reason=None,
    )
    job.attempt_count = 1
    db = database(credential(token, ident, repo_id), job, audited)
    response = await runner_complete(
        job.id, RunnerConclusion(
            lease_id=job.lease_id, conclusion="failure", log_excerpt="1 failed"
        ), repository=SimpleNamespace(id=repo_id), db=db, token=token,
    )
    assert response["conclusion"] == "failure"
    assert response["trusted_for_deployment"] is False
    assert job.lease_expires_at is None
    assert job.status == "completed"
    assert audited.conclusion == "failure"
    assert audited.end_reason == "runner_reported"
    db.commit.assert_awaited_once()
