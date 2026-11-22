"""Real PostgreSQL + Git + durable commit-insights pipeline integration tests.

Only run when PANDAHUB_RUN_DB_INTEGRATION_TESTS=1. CI supplies an ephemeral
PostgreSQL database and applies Alembic first. External AI and Redis calls are
intercepted: this verifies orchestration and persistence, not model accuracy,
Git smart-HTTP, or a production worker deployment.
"""
from __future__ import annotations

import os
import subprocess
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


pytestmark = pytest.mark.skipif(
    os.getenv("PANDAHUB_RUN_DB_INTEGRATION_TESTS") != "1",
    reason="Requires ephemeral CI PostgreSQL and successful Alembic migrations",
)


@pytest.fixture(scope="module")
def test_engine():
    from app.core.config import get_settings

    url = get_settings().DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    )
    parsed = make_url(url)
    if not parsed.database or not parsed.database.endswith("_test"):
        pytest.fail("Refusing integration writes outside a *_test database")
    engine = create_engine(url, pool_pre_ping=True)
    try:
        yield engine
    finally:
        engine.dispose()


def _git(*args: str, cwd: Path) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True,
        text=True, timeout=20,
    )
    return proc.stdout.strip()


def test_alembic_migrated_postgres_schema(test_engine):
    tables = set(inspect(test_engine).get_table_names())
    assert {"users", "repositories", "branches", "commit_ai_analyses",
            "ci_runs", "ci_run_attempts", "ci_runner_credentials", "code_analysis_reports", "code_analysis_feedback"} <= tables
    columns = {col["name"] for col in inspect(test_engine).get_columns("repositories")}
    assert "auto_ai_analysis_enabled" in columns
    assert "auto_ci_enabled" in columns
    with test_engine.connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "0009_ci_attempt_audit"
        assert db.scalar(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'commit_ai_analyses' AND column_name = 'suggestions'"
        )) == "jsonb"


def test_real_git_push_event_to_persisted_ai_next_steps(test_engine, tmp_path):
    """Actual Git refs + PostgreSQL records + Celery task with stubbed provider.

    The queue and HTTP provider are mocked, but the committed Git diff,
    branch update parsing, SQL writes and actual task logic are not.
    """
    from app.git_engine.push_events import snapshot_refs, changed_ref_lines
    from app.git_engine.writer import parse_receive_pack_output
    from app.models.user import User
    from app.models.repo import Repository
    from app.models.commit_ai_analysis import CommitAIAnalysis
    from app.models.ci_run import CIRun
    from app.services.ci_queue import queue_ci_runs
    from app.worker.tasks.git_tasks import _queue_opted_in_commit_analyses, _get_sync_session
    from app.worker.tasks.commit_ai_tasks import analyze_commit_task

    work, bare = tmp_path / "work", tmp_path / "hosted.git"
    _git("init", "-q", "-b", "main", str(work), cwd=tmp_path)
    _git("init", "--bare", "-q", str(bare), cwd=tmp_path)
    _git("config", "user.name", "PandaHub CI", cwd=work)
    _git("config", "user.email", "ci@example.invalid", cwd=work)
    (work / "app.py").write_text("def authenticate(value):\n    return value\n")
    _git("add", ".", cwd=work)
    _git("commit", "-qm", "Add starter feature", cwd=work)
    _git("push", "-q", str(bare), "HEAD:refs/heads/main", cwd=work)

    before = snapshot_refs(str(bare))
    (work / "app.py").write_text(
        "def authenticate(value):\n    if not value:\n        raise ValueError('missing')\n    return value\n"
    )
    _git("commit", "-qam", "Validate authentication input", cwd=work)
    _git("push", "-q", str(bare), "HEAD:refs/heads/main", cwd=work)
    after = snapshot_refs(str(bare))
    updates = parse_receive_pack_output(changed_ref_lines(before, after))
    assert len(updates) == 1
    assert updates[0].new_sha == _git("rev-parse", "HEAD", cwd=work)
    assert updates[0].old_sha != updates[0].new_sha

    ident = uuid.uuid4().hex[:16]
    user_id = None
    with Session(test_engine) as db:
        user = User(username=f"ci{ident}", email=f"ci-{ident}@example.invalid")
        db.add(user)
        db.flush()
        user_id = user.id
        repo = Repository(
            owner_user_id=user.id, name=f"ci-git-{ident}",
            disk_path=str(bare), default_branch="main",
            auto_ai_analysis_enabled=False,
        )
        db.add(repo)
        db.commit()
        repo_id = repo.id

    try:
        # Native CI creates only a durable queue record; never runs repo code.
        assert queue_ci_runs(repo_id, updates, _get_sync_session) == 0
        with Session(test_engine) as db:
            repository = db.get(Repository, repo_id)
            repository.auto_ci_enabled = True
            db.commit()
        assert queue_ci_runs(repo_id, updates, _get_sync_session) == 1
        assert queue_ci_runs(repo_id, updates, _get_sync_session) == 0
        with Session(test_engine) as db:
            ci_record = db.scalar(select(CIRun).where(CIRun.repository_id == repo_id))
            assert ci_record is not None
            assert ci_record.status == "queued"
            assert ci_record.conclusion is None
            assert ci_record.commit_sha == updates[0].new_sha

        with patch(
            "app.worker.tasks.commit_ai_tasks.analyze_commit_task.apply_async"
        ) as submit:
            assert _queue_opted_in_commit_analyses(repo_id, updates) == 0
            submit.assert_not_called()

            with Session(test_engine) as db:
                repository = db.get(Repository, repo_id)
                assert repository is not None
                assert not repository.auto_ai_analysis_enabled
                repository.auto_ai_analysis_enabled = True
                db.commit()

            assert _queue_opted_in_commit_analyses(repo_id, updates) == 1
            submit.assert_called_once()

            # Retry of the same Git ref update must not charge for a second review.
            assert _queue_opted_in_commit_analyses(repo_id, updates) == 0
            assert submit.call_count == 1
            submitted_id = submit.call_args.kwargs["args"][0]
            assert submit.call_args.kwargs["queue"] == "ai_ops"

        with Session(test_engine) as db:
            queued = db.scalar(select(CommitAIAnalysis).where(
                CommitAIAnalysis.repository_id == repo_id
            ))
            assert queued is not None
            assert str(queued.id) == submitted_id
            assert queued.status == "queued"
            assert queued.base_sha == updates[0].old_sha
            assert queued.commit_sha == updates[0].new_sha

        provider = SimpleNamespace(
            k_samples=1,
            model_used="CI_HTTP_PROVIDER_STUB",
            summary="Inspected actual authentication code change.",
            suggestions=[{
                "file": "app.py",
                "severity": "high",
                "comment": "Add a test that rejects empty authentication inputs.",
            }],
        )
        with patch(
            "app.worker.tasks.commit_ai_tasks.route_and_review",
            new=AsyncMock(return_value=provider),
        ) as reviewer:
            task_result = analyze_commit_task(submitted_id)

        assert task_result["status"] == "completed"
        reviewer.assert_awaited_once()
        diff_sent_to_provider = reviewer.await_args.args[0]
        assert "raise ValueError('missing')" in diff_sent_to_provider

        with Session(test_engine) as db:
            saved = db.get(CommitAIAnalysis, uuid.UUID(submitted_id))
            assert saved is not None
            assert saved.status == "completed"
            assert saved.commit_sha == updates[0].new_sha
            assert saved.suggestions == provider.suggestions
            assert len(saved.next_steps) == 1
            assert saved.next_steps[0]["file"] == "app.py"
            assert saved.next_steps[0]["verified"] is False
    finally:
        if user_id:
            with Session(test_engine) as db:
                user = db.get(User, user_id)
                if user is not None:
                    db.delete(user)
                    db.commit()
