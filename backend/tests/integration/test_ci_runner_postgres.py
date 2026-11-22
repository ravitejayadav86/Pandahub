"""Actual PostgreSQL regression for native CI runner token isolation and leases.

Never runs outside an explicitly configured *_test database; no Docker,
network Git clones, AI providers, or real repo data are involved.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

pytestmark = pytest.mark.skipif(
    os.getenv("PANDAHUB_RUN_DB_INTEGRATION_TESTS") != "1",
    reason="Requires isolated migrated PostgreSQL *_test database",
)


@pytest.mark.asyncio
async def test_real_postgres_runner_scope_and_lease_lifecycle():
    from app.api.v1.ci_runner import (
        RunnerConclusion, RunnerLeaseProof,
        revoke_runner_credential, runner_claim_next,
        runner_complete, runner_heartbeat,
    )
    from app.core.config import get_settings
    from app.models.ci_run import CIRun
    from app.models.ci_run_attempt import CIRunAttempt
    from app.api.v1.ci import CIRetryRequest, request_ci_retry
    from app.models.ci_runner_credential import CIRunnerCredential
    from app.models.repo import Repository
    from app.models.user import User
    from app.services.ci_runner_auth import authenticate_runner, mint_runner_token

    db_url = get_settings().DATABASE_URL
    if not (make_url(db_url).database or "").endswith("_test"):
        pytest.fail("Refusing CI runner integration test outside *_test database")
    engine = create_async_engine(db_url, pool_pre_ping=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    owner_id = None
    runner_id, raw_token, hashed = mint_runner_token()
    unique = uuid.uuid4().hex[:12]

    try:
        async with sessions() as db:
            user = User(username=f"phci{unique}", email=f"phci{unique}@example.invalid")
            db.add(user)
            await db.flush()
            owner_id = user.id

            repo = Repository(
                owner_user_id=user.id, name=f"qa-ci-{unique}",
                disk_path=f"/tmp/qa-ci-{unique}.git",
                default_branch="main",
                auto_ci_enabled=True, auto_ai_analysis_enabled=False,
            )
            other_repo = Repository(
                owner_user_id=user.id, name=f"qa-other-{unique}",
                disk_path=f"/tmp/qa-other-{unique}.git",
                default_branch="main",
                auto_ci_enabled=True, auto_ai_analysis_enabled=False,
            )
            db.add_all([repo, other_repo])
            await db.flush()
            repo_id, other_id = repo.id, other_repo.id

            db.add(CIRunnerCredential(
                id=runner_id, repository_id=repo_id,
                name="Ephemeral Postgres QA", token_sha256=hashed,
            ))
            job = CIRun(
                repository_id=repo_id, branch_name="qa",
                commit_sha="e" * 40, status="queued",
            )
            db.add(job)
            await db.commit()
            job_id = job.id

        async with sessions() as db:
            # One repo's token must NOT authenticate against another repo's UUID.
            with pytest.raises(HTTPException) as exc:
                await authenticate_runner(db, other_id, raw_token)
            assert exc.value.status_code == 401
            await db.rollback()

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            claimed = await runner_claim_next(
                repository=repo, db=db, token=raw_token,
            )
            assert uuid.UUID(claimed["id"]) == job_id
            assert uuid.UUID(claimed["lease_id"])
            assert claimed["trusted_for_deployment"] is False

            # A second attempt cannot create a duplicate job or steal a lease.
            none_left = await runner_claim_next(
                repository=repo, db=db, token=raw_token,
            )
            assert none_left.status_code == 204

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            hb = await runner_heartbeat(
                job_id, RunnerLeaseProof(lease_id=uuid.UUID(claimed["lease_id"])),
                repository=repo, db=db, token=raw_token,
            )
            assert hb["status"] == "running"

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            result = await runner_complete(
                job_id, RunnerConclusion(
                    lease_id=uuid.UUID(claimed["lease_id"]),
                    conclusion="failure",
                    log_excerpt="1 test failed (synthetic)",
                ),
                repository=repo, db=db, token=raw_token,
            )
            assert result["conclusion"] == "failure"
            assert result["trusted_for_deployment"] is False

        async with sessions() as db:
            record = await db.scalar(select(CIRun).where(CIRun.id == job_id))
            assert record.status == "completed"
            assert record.conclusion == "failure"
            assert record.lease_expires_at is None
            assert record.runner_credential_id == runner_id
            cred = await db.get(CIRunnerCredential, runner_id)
            assert cred.token_sha256 == hashed
            assert cred.token_sha256 != raw_token
            assert cred.last_used_at is not None

        # Operator-inspected manual retry creates a new claim/lease on the
        # SAME branch/SHA, without erasing the failed first attempt.
        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            retried = await request_ci_retry(
                job_id,
                CIRetryRequest(
                    operator_confirmed_runner_stopped=True,
                    reason="Synthetic QA confirmed old Docker process exited",
                ),
                repository=repo, db=db, _perm=None,
            )
            assert retried["status"] == "queued"
            assert retried["attempt_count"] == 1

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            claimed_again = await runner_claim_next(
                repository=repo, db=db, token=raw_token,
            )
            assert uuid.UUID(claimed_again["id"]) == job_id
            assert claimed_again["attempt_number"] == 2
            assert claimed_again["lease_id"] != claimed["lease_id"]

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            # A *late* response from attempt 1 must fail, even though the
            # runner identity and commit SHA are unchanged.
            with pytest.raises(HTTPException) as late:
                await runner_complete(
                    job_id, RunnerConclusion(
                        lease_id=uuid.UUID(claimed["lease_id"]),
                        conclusion="success",
                        log_excerpt="FAKE OLD LEASE SUCCESS",
                    ),
                    repository=repo, db=db, token=raw_token,
                )
            assert late.value.status_code == 409
            await db.rollback()

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            completed = await runner_complete(
                job_id, RunnerConclusion(
                    lease_id=uuid.UUID(claimed_again["lease_id"]),
                    conclusion="success",
                    log_excerpt="Synthetic repeat passed",
                ),
                repository=repo, db=db, token=raw_token,
            )
            assert completed["conclusion"] == "success"
            assert completed["attempt_number"] == 2

        async with sessions() as db:
            persisted = await db.get(CIRun, job_id)
            assert persisted.attempt_count == 2
            assert persisted.conclusion == "success"
            previous = (await db.scalars(select(CIRunAttempt).where(
                CIRunAttempt.run_id == job_id,
            ).order_by(CIRunAttempt.attempt_number))).all()
            assert len(previous) == 2
            assert [v.conclusion for v in previous] == ["failure", "success"]
            assert previous[0].log_excerpt == "1 test failed (synthetic)"
            assert previous[0].retry_requested_at is not None
            assert previous[0].retry_reason is not None
            assert previous[1].lease_id != previous[0].lease_id
            assert previous[1].end_reason == "runner_reported"

        async with sessions() as db:
            repo = await db.get(Repository, repo_id)
            await revoke_runner_credential(
                runner_id, repository=repo, db=db, _perm=None,
            )
        async with sessions() as db:
            with pytest.raises(HTTPException) as exc:
                await authenticate_runner(db, repo_id, raw_token)
            assert exc.value.status_code == 401
            await db.rollback()

    finally:
        if owner_id:
            async with sessions() as db:
                user = await db.get(User, owner_id)
                if user is not None:
                    await db.delete(user)
                    await db.commit()
        await engine.dispose()
