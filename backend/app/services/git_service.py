"""
Git browsing service — pygit2 wrapper for all read-only git operations.

All pygit2 calls are synchronous and GIL-holding (libgit2 releases the
GIL inconsistently), so every public function runs its inner work via
``asyncio.get_event_loop().run_in_executor(None, ...)`` to avoid blocking
the FastAPI/uvicorn event loop.

Supported operations (all read-only — writes belong to the smart-HTTP
transport in Module 8):
  - list_branches   : branch names + metadata from the live repo
  - get_tree        : one directory level at a ref + path
  - get_blob        : raw file bytes + mime-type detection
  - get_commits     : paginated commit log for a ref
  - get_readme      : locate and return README content as raw Markdown

Error model:
  Any pygit2.GitError is caught and re-raised as a domain-level
  ``NotFoundError`` or ``AppError`` so callers don't need to import pygit2.
"""
from __future__ import annotations

import asyncio
import base64
import mimetypes
from datetime import datetime, timezone
from typing import Optional

import pygit2

from app.core.exceptions import AppError, NotFoundError
from app.core.logging import get_logger
from app.schemas.repo_schema import (
    BlobOut,
    BranchInfo,
    CommitAuthorInfo,
    CommitInfo,
    ReadmeOut,
    TreeEntryOut,
    TreeOut,
)

logger = get_logger("app.services.git_service")

# File names (in priority order) that are considered README candidates.
_README_CANDIDATES = [
    "README.md",
    "readme.md",
    "README.markdown",
    "README.rst",
    "README.txt",
    "README",
]

# git tree entry file modes → human-readable type
_MODE_TYPE: dict[int, str] = {
    0o040000: "tree",   # directory
    0o100644: "blob",   # regular file
    0o100755: "blob",   # executable file
    0o120000: "blob",   # symlink (treat as blob)
    0o160000: "tree",   # git submodule (commit object)
}


# ---------------------------------------------------------------------------
# Internal synchronous helpers (run in executor)
# ---------------------------------------------------------------------------

def _open_repo(disk_path: str) -> pygit2.Repository:
    """Open a bare or non-bare repository, raising NotFoundError on failure."""
    try:
        return pygit2.Repository(disk_path)
    except pygit2.GitError as exc:
        raise NotFoundError(f"Git repository not found at '{disk_path}': {exc}")


def _resolve_ref(repo: pygit2.Repository, ref: str) -> pygit2.Commit:
    """
    Resolve *ref* (branch name, tag name, or full SHA) to a ``Commit`` object.

    Raises:
        NotFoundError: if the ref can't be resolved.
    """
    try:
        # Try as a branch first (most common case).
        try:
            branch = repo.branches.get(ref)
            if branch is not None:
                return repo.get(branch.target)
        except pygit2.GitError:
            pass

        # Try as a direct object lookup (full SHA or abbreviated SHA).
        obj = repo.revparse_single(ref)
        # Tags may point to tag objects; peel to the commit.
        if obj.type == pygit2.GIT_OBJ_TAG:
            obj = obj.peel(pygit2.GIT_OBJ_COMMIT)
        if obj.type != pygit2.GIT_OBJ_COMMIT:
            raise NotFoundError(f"Ref '{ref}' does not point to a commit.")
        return obj
    except pygit2.GitError as exc:
        raise NotFoundError(f"Ref '{ref}' not found: {exc}")


def _sig_to_author(sig: pygit2.Signature) -> CommitAuthorInfo:
    ts = datetime.fromtimestamp(sig.time, tz=timezone.utc)
    return CommitAuthorInfo(name=sig.name, email=sig.email, when=ts)


def _detect_mime(path: str, data: bytes) -> str:
    """
    Best-effort MIME type detection.

    Tries the file extension first (fast); falls back to checking whether
    the first 8 KB is valid UTF-8 to distinguish text from binary.
    """
    mime, _ = mimetypes.guess_type(path)
    if mime:
        return mime
    try:
        data[:8192].decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return "application/octet-stream"


# ---------------------------------------------------------------------------
# Synchronous worker functions (called via run_in_executor)
# ---------------------------------------------------------------------------

def _list_branches_sync(disk_path: str) -> list[BranchInfo]:
    repo = _open_repo(disk_path)
    if repo.is_empty:
        return []

    try:
        default_ref = repo.head.shorthand
    except pygit2.GitError:
        default_ref = "main"

    result: list[BranchInfo] = []
    for branch_name in repo.branches.local:
        branch = repo.branches.get(branch_name)
        if branch is None:
            continue
        try:
            target_commit = repo.get(branch.target)
        except Exception:
            target_commit = None

        result.append(
            BranchInfo(
                name=branch_name,
                last_commit_sha=str(branch.target) if target_commit else None,
                is_default=(branch_name == default_ref),
                is_protected=False,  # protection rules stored in DB, not git
                last_pushed_at=None,  # populated by push hook in Module 8
            )
        )
    return result


def _get_tree_sync(disk_path: str, ref: str, path: str) -> TreeOut:
    repo = _open_repo(disk_path)
    if repo.is_empty:
        return TreeOut(ref=ref, path=path, entries=[])

    commit = _resolve_ref(repo, ref)
    tree = commit.tree

    # Navigate to the sub-path (empty path = repo root).
    if path:
        parts = path.strip("/").split("/")
        for part in parts:
            try:
                entry = tree[part]
            except KeyError:
                raise NotFoundError(f"Path '{path}' not found at ref '{ref}'.")
            if entry.type_str != "tree":
                raise AppError(f"Path '{path}' is a file, not a directory.")
            tree = repo.get(entry.id)

    entries: list[TreeEntryOut] = []
    for entry in tree:
        entry_type = _MODE_TYPE.get(entry.filemode, "blob")
        size: Optional[int] = None
        if entry_type == "blob":
            try:
                blob = repo.get(entry.id)
                size = blob.size
            except Exception:
                pass

        full_path = f"{path}/{entry.name}".lstrip("/") if path else entry.name
        entries.append(
            TreeEntryOut(
                name=entry.name,
                type=entry_type,  # type: ignore[arg-type]
                path=full_path,
                sha=str(entry.id),
                size=size,
                mode=oct(entry.filemode),
            )
        )

    # Sort: directories first, then files, both alphabetically.
    entries.sort(key=lambda e: (0 if e.type == "tree" else 1, e.name.lower()))
    return TreeOut(ref=ref, path=path, entries=entries)


def _get_blob_sync(disk_path: str, ref: str, path: str) -> BlobOut:
    repo = _open_repo(disk_path)
    if repo.is_empty:
        raise NotFoundError(f"Repository is empty — ref '{ref}' does not exist.")

    commit = _resolve_ref(repo, ref)
    tree = commit.tree

    # Navigate to the containing directory.
    parts = path.strip("/").split("/")
    filename = parts[-1]
    for part in parts[:-1]:
        try:
            entry = tree[part]
        except KeyError:
            raise NotFoundError(f"Path '{path}' not found at ref '{ref}'.")
        if entry.type_str != "tree":
            raise NotFoundError(f"Path component '{part}' is not a directory.")
        tree = repo.get(entry.id)

    # Get the final entry.
    try:
        entry = tree[filename]
    except KeyError:
        raise NotFoundError(f"File '{path}' not found at ref '{ref}'.")

    if entry.type_str != "blob":
        raise AppError(f"'{path}' is a directory, not a file.")

    blob = repo.get(entry.id)
    raw: bytes = blob.data
    mime = _detect_mime(filename, raw)

    return BlobOut(
        ref=ref,
        path=path,
        sha=str(entry.id),
        size=blob.size,
        encoding="base64",
        content=base64.b64encode(raw).decode("ascii"),
        mime_type=mime,
    )


def _get_commits_sync(
    disk_path: str,
    ref: str,
    page: int,
    per_page: int,
) -> tuple[list[CommitInfo], int]:
    """Returns (items, total_count)."""
    repo = _open_repo(disk_path)
    if repo.is_empty:
        return [], 0

    commit = _resolve_ref(repo, ref)

    # Walk the commit graph from HEAD.
    walker = repo.walk(commit.id, pygit2.GIT_SORT_TIME)
    all_commits = list(walker)
    total = len(all_commits)

    skip = (page - 1) * per_page
    page_commits = all_commits[skip : skip + per_page]

    items: list[CommitInfo] = []
    for c in page_commits:
        sha_str = str(c.id)
        message = c.message or ""
        summary = message.split("\n", 1)[0].strip()
        items.append(
            CommitInfo(
                sha=sha_str,
                short_sha=sha_str[:7],
                message=message,
                summary=summary,
                author=_sig_to_author(c.author),
                committer=_sig_to_author(c.committer),
                parent_shas=[str(p.id) for p in c.parents],
            )
        )
    return items, total


def _get_readme_sync(disk_path: str, ref: str) -> Optional[ReadmeOut]:
    repo = _open_repo(disk_path)
    if repo.is_empty:
        return None

    commit = _resolve_ref(repo, ref)
    tree = commit.tree

    for candidate in _README_CANDIDATES:
        try:
            entry = tree[candidate]
        except KeyError:
            continue
        if entry.type_str != "blob":
            continue
        blob = repo.get(entry.id)
        try:
            content = blob.data.decode("utf-8")
        except UnicodeDecodeError:
            continue  # not text — try next candidate
        return ReadmeOut(ref=ref, path=candidate, content=content, encoding="utf-8")

    return None  # no README found


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def list_branches(disk_path: str) -> list[BranchInfo]:
    """Return all local branches from the bare git repository."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _list_branches_sync, disk_path)


async def get_tree(disk_path: str, ref: str, path: str = "") -> TreeOut:
    """
    Return one level of the directory tree at *path* for the given *ref*.

    Args:
        disk_path: Absolute path to the bare git repository.
        ref:       Branch name, tag, or commit SHA.
        path:      Repo-relative path to a directory.  Empty string = root.

    Raises:
        NotFoundError: if the ref or path does not exist.
        AppError:      if the path points to a file, not a directory.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_tree_sync, disk_path, ref, path)


async def get_blob(disk_path: str, ref: str, path: str) -> BlobOut:
    """
    Return the raw content of a single file at *path* + *ref*.

    Content is base64-encoded in the response so binary files are safe.

    Raises:
        NotFoundError: if the ref or path does not exist.
        AppError:      if the path points to a directory, not a file.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_blob_sync, disk_path, ref, path)


async def get_commits(
    disk_path: str,
    ref: str,
    page: int = 1,
    per_page: int = 30,
) -> tuple[list[CommitInfo], int]:
    """
    Return a paginated commit log for *ref*.

    Returns:
        A ``(items, total)`` tuple.  ``total`` is the full count before
        pagination so the client can render page numbers.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _get_commits_sync, disk_path, ref, page, per_page
    )


async def get_readme(disk_path: str, ref: str) -> Optional[ReadmeOut]:
    """
    Locate and return the README at *ref*.

    Searches for ``README.md``, ``readme.md``, ``README.rst``, etc. in
    priority order.  Returns ``None`` if no README-like file is found.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_readme_sync, disk_path, ref)
