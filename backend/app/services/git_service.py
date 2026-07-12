"""
Git service: read commits, branches, file trees, and blob content from bare repos.
"""
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pygit2
from fastapi import HTTPException, status

from app.models.repository import Repository
from app.schemas.repository import BlobRead, BranchRead, CommitRead, TreeEntry


def _open_repo(repo: Repository) -> pygit2.Repository:
    path = Path(repo.disk_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository storage not found on disk",
        )
    return pygit2.Repository(str(path))


def _resolve_ref(git_repo: pygit2.Repository, ref: str) -> pygit2.Commit:
    """Resolve a branch name, tag, or SHA to a Commit object."""
    try:
        obj = git_repo.revparse_single(ref)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ref '{ref}' not found")

    if isinstance(obj, pygit2.Tag):
        obj = obj.peel(pygit2.Commit)
    if not isinstance(obj, pygit2.Commit):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ref does not point to a commit")
    return obj


def get_branches(repo: Repository) -> list[BranchRead]:
    git_repo = _open_repo(repo)
    branches: list[BranchRead] = []
    for name in git_repo.branches.local:
        branch = git_repo.branches[name]
        branches.append(BranchRead(name=name, sha=str(branch.peel(pygit2.Commit).id)))
    return branches


def get_commits(repo: Repository, ref: str, limit: int = 30) -> list[CommitRead]:
    git_repo = _open_repo(repo)
    try:
        commit = _resolve_ref(git_repo, ref)
    except HTTPException:
        return []

    commits: list[CommitRead] = []
    for c in git_repo.walk(commit.id, pygit2.GIT_SORT_TIME):
        committed_at = datetime.fromtimestamp(c.commit_time, tz=timezone.utc)
        commits.append(
            CommitRead(
                sha=str(c.id),
                message=c.message.strip(),
                author_name=c.author.name,
                author_email=c.author.email,
                committed_at=committed_at,
            )
        )
        if len(commits) >= limit:
            break
    return commits


def get_tree(repo: Repository, ref: str, path: str = "") -> list[TreeEntry]:
    git_repo = _open_repo(repo)
    try:
        commit = _resolve_ref(git_repo, ref)
    except HTTPException:
        return []

    tree = commit.peel(pygit2.Tree)

    if path:
        # Traverse into subdirectory
        try:
            entry = tree[path]
            if entry.type_str == "tree":
                tree = git_repo.get(entry.id)
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is not a directory")
        except KeyError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Path '{path}' not found")

    entries: list[TreeEntry] = []
    for entry in tree:
        entry_path = f"{path}/{entry.name}".lstrip("/") if path else entry.name
        size = None
        if entry.type_str == "blob":
            obj = git_repo.get(entry.id)
            size = obj.size if obj else None
        entries.append(
            TreeEntry(
                name=entry.name,
                path=entry_path,
                type="tree" if entry.type_str == "tree" else "blob",
                size=size,
                sha=str(entry.id),
            )
        )
    # Sort: trees (dirs) first, then blobs, both alphabetically
    entries.sort(key=lambda e: (0 if e.type == "tree" else 1, e.name.lower()))
    return entries


def get_blob(repo: Repository, ref: str, path: str) -> BlobRead:
    git_repo = _open_repo(repo)
    commit = _resolve_ref(git_repo, ref)
    tree = commit.peel(pygit2.Tree)

    try:
        entry = tree[path]
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File '{path}' not found")

    if entry.type_str != "blob":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is a directory")

    blob: pygit2.Blob = git_repo.get(entry.id)
    raw = blob.data

    try:
        content = raw.decode("utf-8")
        encoding = "utf-8"
    except UnicodeDecodeError:
        content = base64.b64encode(raw).decode("ascii")
        encoding = "base64"

    return BlobRead(
        path=path,
        content=content,
        encoding=encoding,
        size=blob.size,
        sha=str(blob.id),
    )
