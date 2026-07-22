"""
git_engine.writer — Low-level bare-repository write helpers.

These functions are called by the post-receive hook (``git_tasks.py``)
after ``git http-backend`` has completed writing new objects into the bare
repo.  They are NOT called during the HTTP request handling itself — the
transport (``api/v1/git.py``) delegates all pack-protocol I/O to the
``git http-backend`` subprocess; this module only does bookkeeping AFTER
that completes.

All functions are **synchronous** (pygit2 is a sync C extension).  Callers
that are in an async context must wrap calls in ``run_in_executor``.

Design note: why separate from ``services/git_service.py``?
  - ``git_service.py`` is read-only and used directly by FastAPI route
    handlers (async, low-latency).
  - ``writer.py`` is write/mutation operations triggered by Celery workers
    (sync, can be slow, runs in background).  Keeping them separate makes
    the read/write boundary explicit and prevents accidental write calls
    from read paths.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pygit2

from app.core.logging import get_logger

logger = get_logger("app.git_engine.writer")


# ---------------------------------------------------------------------------
# Data classes (plain data — no SQLAlchemy, no FastAPI, no async)
# ---------------------------------------------------------------------------

@dataclass
class RefUpdate:
    """
    Represents a single ref change reported by git-receive-pack.

    Parsed from the post-receive hook stdin lines, which have the format::

        <old-sha> <new-sha> <refname>

    where old-sha is 40 zeros for a newly-created ref.
    """
    ref_name: str          # e.g. "refs/heads/main"
    old_sha: str           # 40-char hex, or "0" * 40 for new branches
    new_sha: str           # 40-char hex, or "0" * 40 for deleted branches

    @property
    def is_create(self) -> bool:
        return self.old_sha == "0" * 40

    @property
    def is_delete(self) -> bool:
        return self.new_sha == "0" * 40

    @property
    def is_branch(self) -> bool:
        return self.ref_name.startswith("refs/heads/")

    @property
    def is_tag(self) -> bool:
        return self.ref_name.startswith("refs/tags/")

    @property
    def branch_name(self) -> str:
        """Short branch name, e.g. 'main'.  Only valid when is_branch is True."""
        return self.ref_name.removeprefix("refs/heads/")


@dataclass
class BranchSyncResult:
    """Result of a branch-cache sync operation."""
    upserted: list[str] = field(default_factory=list)   # branch names updated/created
    deleted: list[str] = field(default_factory=list)    # branch names deleted
    errors: list[str] = field(default_factory=list)     # non-fatal errors


@dataclass
class CommitDetail:
    """Details about a commit SHA, used for branch-cache population."""
    sha: str
    short_sha: str
    message: str
    author_name: str
    author_email: str
    committed_at: datetime


# ---------------------------------------------------------------------------
# Ref-update parsing
# ---------------------------------------------------------------------------

def parse_receive_pack_output(output: str) -> list[RefUpdate]:
    """
    Parse the newline-delimited output lines from ``git-receive-pack`` to
    extract which refs changed.

    In the smart-HTTP protocol, post-receive information is embedded in
    the pack-protocol sideband messages.  We capture it from the subprocess
    stderr/stdout during the receive-pack POST handler and pass it here.

    Each line has the form::

        <old-sha> <new-sha> refs/heads/<branch>

    Lines that don't match this pattern (git progress/status messages) are
    silently skipped.

    Args:
        output: Raw text output captured from the git-receive-pack subprocess.

    Returns:
        List of ``RefUpdate`` objects, one per changed ref.
    """
    updates: list[RefUpdate] = []
    for line in output.splitlines():
        parts = line.strip().split()
        if len(parts) == 3 and len(parts[0]) == 40 and len(parts[1]) == 40:
            updates.append(RefUpdate(
                old_sha=parts[0],
                new_sha=parts[1],
                ref_name=parts[2],
            ))
    return updates


# ---------------------------------------------------------------------------
# Commit inspection
# ---------------------------------------------------------------------------

def get_commit_detail(disk_path: str, sha: str) -> Optional[CommitDetail]:
    """
    Open the bare repo at *disk_path* and return metadata for *sha*.

    Returns ``None`` if the SHA doesn't exist (e.g. a force-push race
    condition where the tip has already moved on).

    Args:
        disk_path: Absolute path to the bare git repository.
        sha:       40-char hex commit SHA.
    """
    try:
        repo = pygit2.Repository(disk_path)
        obj = repo.get(sha)
        if obj is None:
            return None

        # Peel tags to the underlying commit.
        if obj.type == pygit2.GIT_OBJ_TAG:
            obj = obj.peel(pygit2.GIT_OBJ_COMMIT)

        if obj.type != pygit2.GIT_OBJ_COMMIT:
            return None

        committed_at = datetime.fromtimestamp(
            obj.committer.time, tz=timezone.utc
        )
        return CommitDetail(
            sha=sha,
            short_sha=sha[:7],
            message=obj.message or "",
            author_name=obj.author.name,
            author_email=obj.author.email,
            committed_at=committed_at,
        )
    except pygit2.GitError as exc:
        logger.warning(
            "Failed to inspect commit",
            extra={"disk_path": disk_path, "sha": sha, "error": str(exc)},
        )
        return None


# ---------------------------------------------------------------------------
# Branch cache sync
# ---------------------------------------------------------------------------

def sync_branch_cache_from_refs(
    disk_path: str,
    updates: list[RefUpdate],
) -> BranchSyncResult:
    """
    Inspect *disk_path* for each branch-level ``RefUpdate`` and return the
    data needed to upsert/delete Branch rows in the database.

    This function does NOT touch the database — it only reads the git repo
    and returns a ``BranchSyncResult`` describing what the Celery task
    should write.  Keeping DB writes in the Celery task (async SQLAlchemy)
    and git reads here (sync pygit2) maintains a clean boundary.

    Args:
        disk_path: Absolute path to the bare git repository.
        updates:   List of ``RefUpdate`` objects parsed from receive-pack output.

    Returns:
        ``BranchSyncResult`` with lists of branch names to upsert/delete
        and any non-fatal errors.
    """
    result = BranchSyncResult()

    for update in updates:
        if not update.is_branch:
            continue  # tags and other refs don't map to Branch rows

        if update.is_delete:
            result.deleted.append(update.branch_name)
            continue

        # Upsert: read the new tip commit to populate last_commit_sha.
        detail = get_commit_detail(disk_path, update.new_sha)
        if detail is None:
            result.errors.append(
                f"Could not read commit {update.new_sha[:7]} for branch "
                f"'{update.branch_name}' — branch cache not updated."
            )
            continue

        result.upserted.append(update.branch_name)

    return result


# ---------------------------------------------------------------------------
# Repository size
# ---------------------------------------------------------------------------

def get_repo_size_kb(disk_path: str) -> int:
    """
    Return the on-disk size of the bare repository in kilobytes.

    Uses ``os.walk`` to accumulate file sizes — no subprocess needed and
    no shell injection risk.

    Args:
        disk_path: Absolute path to the bare git repository.

    Returns:
        Total size in KB (rounded up), or 0 if the path doesn't exist.
    """
    total_bytes = 0
    try:
        for dirpath, _dirnames, filenames in os.walk(disk_path):
            for filename in filenames:
                filepath = Path(dirpath) / filename
                try:
                    total_bytes += filepath.stat().st_size
                except OSError:
                    pass  # skip files that disappear during the walk (pack GC)
    except Exception as exc:
        logger.warning(
            "Failed to calculate repo size",
            extra={"disk_path": disk_path, "error": str(exc)},
        )
    return max(1, total_bytes // 1024)


# ---------------------------------------------------------------------------
# Default branch resolution
# ---------------------------------------------------------------------------

def get_default_branch(disk_path: str) -> Optional[str]:
    """
    Read the symbolic HEAD ref from the bare repo to determine the current
    default branch.

    Returns the short branch name (e.g. ``"main"``) or ``None`` if HEAD
    is detached or the repo is empty.
    """
    try:
        repo = pygit2.Repository(disk_path)
        ref = repo.head
        if ref.is_branch:
            return ref.shorthand
        return None
    except pygit2.GitError:
        return None
