"""
Git browsing service — pygit2 wrapper for all read-only git operations.

All pygit2 calls are synchronous, so public async functions execute the
synchronous work in a thread executor to avoid blocking FastAPI.

Supported operations:
  - list_branches
  - get_tree
  - get_blob
  - get_commits
  - get_readme

Important behavior:
  - Empty repositories are handled safely.
  - Missing branches/tags/commits return NotFoundError instead of an
    unhandled pygit2 KeyError / GitError.
  - The UI can therefore distinguish "repository is empty" or "ref not found"
    from a genuine server error.
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

_README_CANDIDATES = [
    "README.md",
    "readme.md",
    "README.markdown",
    "README.rst",
    "README.txt",
    "README",
]

_MODE_TYPE: dict[int, str] = {
    0o040000: "tree",
    0o100644: "blob",
    0o100755: "blob",
    0o120000: "blob",
    0o160000: "tree",
}


# ---------------------------------------------------------------------------
# Repository / ref helpers
# ---------------------------------------------------------------------------

def _open_repo(disk_path: str) -> pygit2.Repository:
    """Open a Git repository."""
    try:
        return pygit2.Repository(disk_path)
    except (pygit2.GitError, KeyError, ValueError, OSError) as exc:
        raise NotFoundError(
            f"Git repository not found at '{disk_path}'."
        ) from exc


def _resolve_ref(repo: pygit2.Repository, ref: str) -> pygit2.Commit:
    """
    Resolve a branch, tag, full SHA, or abbreviated SHA to a commit.

    Missing refs are converted to NotFoundError instead of leaking pygit2's
    KeyError/GitError to FastAPI.
    """
    if not ref or not ref.strip():
        raise NotFoundError("A Git reference is required.")

    ref = ref.strip()

    # 1. Try a local branch.
    try:
        branch = repo.branches.local.get(ref)
        if branch is not None:
            try:
                obj = repo.get(branch.target)
            except (KeyError, pygit2.GitError, ValueError) as exc:
                raise NotFoundError(
                    f"Branch '{ref}' does not point to a valid commit."
                ) from exc

            if obj is None:
                raise NotFoundError(
                    f"Branch '{ref}' does not point to a valid commit."
                )

            if obj.type == pygit2.GIT_OBJECT_COMMIT:
                return obj

            try:
                peeled = obj.peel(pygit2.GIT_OBJECT_COMMIT)
                return peeled
            except (KeyError, pygit2.GitError, ValueError) as exc:
                raise NotFoundError(
                    f"Branch '{ref}' does not point to a commit."
                ) from exc

    except (KeyError, pygit2.GitError, ValueError):
        pass

    # 2. Try refs/heads/<name> explicitly.
    try:
        full_ref = f"refs/heads/{ref}"
        reference = repo.references.get(full_ref)
        if reference is not None:
            try:
                obj = repo.get(reference.target)
            except (KeyError, pygit2.GitError, ValueError) as exc:
                raise NotFoundError(
                    f"Reference '{ref}' does not point to a valid commit."
                ) from exc

            if obj is not None and obj.type == pygit2.GIT_OBJECT_COMMIT:
                return obj

            if obj is not None:
                try:
                    return obj.peel(pygit2.GIT_OBJECT_COMMIT)
                except (KeyError, pygit2.GitError, ValueError) as exc:
                    raise NotFoundError(
                        f"Reference '{ref}' does not point to a commit."
                    ) from exc

    except (KeyError, pygit2.GitError, ValueError):
        pass

    # 3. Try tags / SHA / generic revparse.
    try:
        obj = repo.revparse_single(ref)
    except (KeyError, pygit2.GitError, ValueError):
        raise NotFoundError(
            f"Ref '{ref}' not found in this repository."
        ) from None

    if obj is None:
        raise NotFoundError(
            f"Ref '{ref}' not found in this repository."
        )

    if obj.type == pygit2.GIT_OBJECT_COMMIT:
        return obj

    if obj.type == pygit2.GIT_OBJECT_TAG:
        try:
            peeled = obj.peel(pygit2.GIT_OBJECT_COMMIT)
        except (KeyError, pygit2.GitError, ValueError) as exc:
            raise NotFoundError(
                f"Ref '{ref}' does not point to a commit."
            ) from exc

        return peeled

    try:
        peeled = obj.peel(pygit2.GIT_OBJECT_COMMIT)
        return peeled
    except (KeyError, pygit2.GitError, ValueError) as exc:
        raise NotFoundError(
            f"Ref '{ref}' does not point to a commit."
        ) from exc


def _sig_to_author(sig: pygit2.Signature) -> CommitAuthorInfo:
    ts = datetime.fromtimestamp(sig.time, tz=timezone.utc)
    return CommitAuthorInfo(
        name=sig.name,
        email=sig.email,
        when=ts,
    )


def _detect_mime(path: str, data: bytes) -> str:
    mime, _ = mimetypes.guess_type(path)

    if mime:
        return mime

    try:
        data[:8192].decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return "application/octet-stream"


# ---------------------------------------------------------------------------
# Branches
# ---------------------------------------------------------------------------

def _list_branches_sync(disk_path: str) -> list[BranchInfo]:
    repo = _open_repo(disk_path)

    # Empty repository = no branches yet.
    if repo.is_empty:
        return []

    try:
        default_ref = repo.head.shorthand
    except (KeyError, pygit2.GitError, ValueError):
        default_ref = "main"

    result: list[BranchInfo] = []

    for branch_name in repo.branches.local:
        try:
            branch = repo.branches.local.get(branch_name)
        except (KeyError, pygit2.GitError, ValueError):
            continue

        if branch is None:
            continue

        target_sha: Optional[str] = None

        try:
            target = repo.get(branch.target)
            if target is not None:
                target_sha = str(branch.target)
        except (KeyError, pygit2.GitError, ValueError):
            target_sha = None

        result.append(
            BranchInfo(
                name=branch_name,
                last_commit_sha=target_sha,
                is_default=(branch_name == default_ref),
                is_protected=False,
                last_pushed_at=None,
            )
        )

    result.sort(key=lambda item: item.name.lower())
    return result


# ---------------------------------------------------------------------------
# Tree
# ---------------------------------------------------------------------------

def _get_tree_sync(
    disk_path: str,
    ref: str,
    path: str,
) -> TreeOut:
    repo = _open_repo(disk_path)

    # Empty repository has no commit/tree to browse.
    if repo.is_empty:
        raise NotFoundError(
            f"Repository is empty — ref '{ref}' does not exist."
        )

    commit = _resolve_ref(repo, ref)
    tree = commit.tree

    normalized_path = path.strip("/")

    if normalized_path:
        for part in normalized_path.split("/"):
            try:
                entry = tree[part]
            except (KeyError, pygit2.GitError) as exc:
                raise NotFoundError(
                    f"Path '{path}' not found at ref '{ref}'."
                ) from exc

            if entry.type_str != "tree":
                raise AppError(
                    f"Path '{path}' is a file, not a directory."
                )

            try:
                tree = repo.get(entry.id)
            except (KeyError, pygit2.GitError, ValueError) as exc:
                raise NotFoundError(
                    f"Path '{path}' could not be loaded."
                ) from exc

    entries: list[TreeEntryOut] = []

    for entry in tree:
        entry_type = _MODE_TYPE.get(entry.filemode, "blob")
        size: Optional[int] = None

        if entry_type == "blob":
            try:
                blob = repo.get(entry.id)
                size = blob.size
            except (KeyError, pygit2.GitError, ValueError):
                size = None

        full_path = (
            f"{normalized_path}/{entry.name}".lstrip("/")
            if normalized_path
            else entry.name
        )

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

    entries.sort(
        key=lambda item: (
            0 if item.type == "tree" else 1,
            item.name.lower(),
        )
    )

    return TreeOut(
        ref=ref,
        path=normalized_path,
        entries=entries,
    )


# ---------------------------------------------------------------------------
# Blob
# ---------------------------------------------------------------------------

def _get_blob_sync(
    disk_path: str,
    ref: str,
    path: str,
) -> BlobOut:
    repo = _open_repo(disk_path)

    if repo.is_empty:
        raise NotFoundError(
            f"Repository is empty — ref '{ref}' does not exist."
        )

    if not path.strip("/"):
        raise AppError("A file path is required.")

    commit = _resolve_ref(repo, ref)
    tree = commit.tree

    parts = path.strip("/").split("/")
    filename = parts[-1]

    for part in parts[:-1]:
        try:
            entry = tree[part]
        except (KeyError, pygit2.GitError) as exc:
            raise NotFoundError(
                f"Path '{path}' not found at ref '{ref}'."
            ) from exc

        if entry.type_str != "tree":
            raise NotFoundError(
                f"Path component '{part}' is not a directory."
            )

        try:
            tree = repo.get(entry.id)
        except (KeyError, pygit2.GitError, ValueError) as exc:
            raise NotFoundError(
                f"Path '{path}' could not be loaded."
            ) from exc

    try:
        entry = tree[filename]
    except (KeyError, pygit2.GitError) as exc:
        raise NotFoundError(
            f"File '{path}' not found at ref '{ref}'."
        ) from exc

    if entry.type_str != "blob":
        raise AppError(
            f"'{path}' is a directory, not a file."
        )

    try:
        blob = repo.get(entry.id)
    except (KeyError, pygit2.GitError, ValueError) as exc:
        raise NotFoundError(
            f"File '{path}' could not be loaded."
        ) from exc

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


# ---------------------------------------------------------------------------
# Commits
# ---------------------------------------------------------------------------

def _get_commits_sync(
    disk_path: str,
    ref: str,
    page: int,
    per_page: int,
) -> tuple[list[CommitInfo], int]:
    if page < 1:
        page = 1

    if per_page < 1:
        per_page = 30

    repo = _open_repo(disk_path)

    if repo.is_empty:
        return [], 0

    commit = _resolve_ref(repo, ref)

    try:
        walker = repo.walk(commit.id, pygit2.GIT_SORT_TIME)
        all_commits = list(walker)
    except (KeyError, pygit2.GitError, ValueError) as exc:
        raise NotFoundError(
            f"Unable to read commit history for ref '{ref}'."
        ) from exc

    total = len(all_commits)

    skip = (page - 1) * per_page
    page_commits = all_commits[skip : skip + per_page]

    items: list[CommitInfo] = []

    for commit_obj in page_commits:
        sha_str = str(commit_obj.id)
        message = commit_obj.message or ""
        summary = message.split("\n", 1)[0].strip()

        items.append(
            CommitInfo(
                sha=sha_str,
                short_sha=sha_str[:7],
                message=message,
                summary=summary,
                author=_sig_to_author(commit_obj.author),
                committer=_sig_to_author(commit_obj.committer),
                parent_shas=[
                    str(parent.id)
                    for parent in commit_obj.parents
                ],
            )
        )

    return items, total


# ---------------------------------------------------------------------------
# README
# ---------------------------------------------------------------------------

def _get_readme_sync(
    disk_path: str,
    ref: str,
) -> Optional[ReadmeOut]:
    repo = _open_repo(disk_path)

    if repo.is_empty:
        return None

    commit = _resolve_ref(repo, ref)
    tree = commit.tree

    for candidate in _README_CANDIDATES:
        try:
            entry = tree[candidate]
        except (KeyError, pygit2.GitError):
            continue

        if entry.type_str != "blob":
            continue

        try:
            blob = repo.get(entry.id)
        except (KeyError, pygit2.GitError, ValueError):
            continue

        try:
            content = blob.data.decode("utf-8")
        except UnicodeDecodeError:
            continue

        return ReadmeOut(
            ref=ref,
            path=candidate,
            content=content,
            encoding="utf-8",
        )

    return None


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def list_branches(
    disk_path: str,
) -> list[BranchInfo]:
    """Return all local branches from the live Git repository."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        _list_branches_sync,
        disk_path,
    )


async def get_tree(
    disk_path: str,
    ref: str,
    path: str = "",
) -> TreeOut:
    """
    Return one directory level from a Git ref.

    Empty repositories and missing refs are reported as NotFoundError instead
    of becoming unhandled 500 responses.
    """
    loop = asyncio.get_running_loop()

    return await loop.run_in_executor(
        None,
        _get_tree_sync,
        disk_path,
        ref,
        path,
    )


async def get_blob(
    disk_path: str,
    ref: str,
    path: str,
) -> BlobOut:
    """Return a base64-encoded file from a Git ref."""
    loop = asyncio.get_running_loop()

    return await loop.run_in_executor(
        None,
        _get_blob_sync,
        disk_path,
        ref,
        path,
    )


async def get_commits(
    disk_path: str,
    ref: str,
    page: int = 1,
    per_page: int = 30,
) -> tuple[list[CommitInfo], int]:
    """Return paginated commit history."""
    loop = asyncio.get_running_loop()

    return await loop.run_in_executor(
        None,
        _get_commits_sync,
        disk_path,
        ref,
        page,
        per_page,
    )


async def get_readme(
    disk_path: str,
    ref: str,
) -> Optional[ReadmeOut]:
    """Return the README at a Git ref, if one exists."""
    loop = asyncio.get_running_loop()

    return await loop.run_in_executor(
        None,
        _get_readme_sync,
        disk_path,
        ref,
    )