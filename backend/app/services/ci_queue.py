"""Queue a bounded CI record for each accepted branch-tip update.

The existing Git post-receive task invokes this on the git_ops worker.
It NEVER runs repository code or starts Docker. The runner is independent.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.ci_run import CIRun
from app.models.repo import Repository


def queue_ci_runs(repo_uuid: uuid.UUID, updates: list, session_factory) -> int:
    """Create idempotent jobs for opted-in repositories, returning new count."""
    tips = {
        item.branch_name: item.new_sha
        for item in updates
        if item.is_branch and not item.is_delete
        and len(item.new_sha) == 40
        and all(c in "0123456789abcdef" for c in item.new_sha)
    }
    if not tips:
        return 0

    new_count = 0
    with session_factory() as db:
        repo = db.scalar(select(Repository).where(Repository.id == repo_uuid))
        if repo is None or not repo.auto_ci_enabled:
            return 0
        for branch_name, sha in tips.items():
            # ON CONFLICT is atomic even if two post-receive workers race.
            statement = pg_insert(CIRun).values(
                repository_id=repo_uuid,
                branch_name=branch_name,
                commit_sha=sha,
                status="queued",
            ).on_conflict_do_nothing(
                constraint="uq_ci_run_repo_branch_sha",
            ).returning(CIRun.id)
            if db.scalar(statement) is not None:
                new_count += 1
        db.commit()
    return new_count
