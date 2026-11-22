"""CI queue tests: no source execution in the Git post-receive worker."""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.ci_queue import queue_ci_runs


VALID_SHA = "a" * 40


def _update(sha=VALID_SHA, branch="qa", *, is_delete=False, is_branch=True):
    return SimpleNamespace(
        new_sha=sha, branch_name=branch,
        is_delete=is_delete, is_branch=is_branch,
    )


def _session_factory(*answers):
    db = MagicMock()
    db.__enter__.return_value = db
    db.scalar.side_effect = list(answers)
    return db, lambda: db


def test_disabled_repository_creates_no_jobs():
    db, factory = _session_factory(SimpleNamespace(auto_ci_enabled=False))
    assert queue_ci_runs(uuid.uuid4(), [_update()], factory) == 0
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_enabled_repository_queues_one_durable_record():
    db, factory = _session_factory(
        SimpleNamespace(auto_ci_enabled=True), uuid.uuid4(),
    )
    assert queue_ci_runs(uuid.uuid4(), [_update()], factory) == 1
    assert db.scalar.call_count == 2
    statement = db.scalar.call_args.args[0]
    assert "ON CONFLICT DO NOTHING" in str(statement)
    assert "ci_runs" in str(statement)
    db.add.assert_not_called()
    db.commit.assert_called_once()


def test_same_commit_branch_is_idempotent():
    db, factory = _session_factory(
        SimpleNamespace(auto_ci_enabled=True), None,
    )
    assert queue_ci_runs(uuid.uuid4(), [_update()], factory) == 0
    db.add.assert_not_called()
    db.commit.assert_called_once()


def test_deleted_tags_invalid_shas_and_no_updates_are_ignored():
    db, factory = _session_factory()
    updates = [
        _update(is_delete=True), _update(is_branch=False),
        _update(sha="invalid"),
    ]
    assert queue_ci_runs(uuid.uuid4(), updates, factory) == 0
    db.scalar.assert_not_called()
    assert queue_ci_runs(uuid.uuid4(), [], factory) == 0


def test_ci_results_are_explicitly_untrusted():
    from app.api.v1.ci import _view, CIResult
    import pytest
    from pydantic import ValidationError
    job = SimpleNamespace(
        id=uuid.uuid4(), branch_name="qa", commit_sha=VALID_SHA,
        status="completed", conclusion="success", log_excerpt="1 test passed",
        created_at=None, started_at=None, completed_at=None,
    )
    record = _view(job)
    assert record["trusted_for_deployment"] is False
    assert record["attestation"] == "repository_admin_reported"
    with pytest.raises(ValidationError):
        CIResult(conclusion="deployed")
