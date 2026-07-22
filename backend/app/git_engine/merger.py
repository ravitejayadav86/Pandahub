"""
git_engine.merger — Pull Request merge engine.

Implements the low-level pygit2 operations for checking mergeability,
generating diffs, and performing a 3-way merge commit.

All functions are synchronous (pygit2 is a sync C extension).  Callers
must wrap them in ``run_in_executor`` from an async context.

Cross-fork PRs:
  If `source_disk_path` != `target_disk_path`, the source repo is added
  as a temporary remote, fetched into the target repo, and then merged.
"""
import uuid
# pyrefly: ignore [missing-import]
import pygit2
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

from app.core.exceptions import ConflictError, AppError
from app.core.logging import get_logger

logger = get_logger("app.git_engine.merger")


def _get_branch_commit(repo: pygit2.Repository, branch_name: str) -> pygit2.Commit:
    """Resolve a local branch name to its tip commit."""
    ref = repo.lookup_branch(branch_name)
    if not ref:
        raise AppError(f"Branch '{branch_name}' not found.")
    return ref.peel(pygit2.GIT_OBJ_COMMIT)


def _fetch_from_fork(
    target_repo: pygit2.Repository,
    source_disk_path: str,
    source_branch: str,
) -> pygit2.Commit:
    """
    Fetch the source branch from a fork (local disk path) into the target repo.
    Returns the tip commit of the fetched branch.
    """
    remote_name = f"tmp_fork_{uuid.uuid4().hex[:8]}"
    try:
        remote = target_repo.remotes.create(remote_name, source_disk_path)
        # Fetch the specific branch into FETCH_HEAD
        remote.fetch([f"refs/heads/{source_branch}"])
        fetch_head = target_repo.lookup_reference("FETCH_HEAD")
        return fetch_head.peel(pygit2.GIT_OBJ_COMMIT)
    finally:
        # Clean up the temporary remote
        if remote_name in [r.name for r in target_repo.remotes]:
            target_repo.remotes.delete(remote_name)


def check_mergeability(
    target_disk_path: str,
    source_disk_path: str,
    target_branch: str,
    source_branch: str,
) -> bool:
    """
    Check if `source_branch` can be merged into `target_branch` without conflicts.
    
    Returns:
        True if mergeable, False if there are conflicts.
    """
    target_repo = pygit2.Repository(target_disk_path)
    
    target_commit = _get_branch_commit(target_repo, target_branch)
    
    if target_disk_path == source_disk_path:
        source_commit = _get_branch_commit(target_repo, source_branch)
    else:
        source_commit = _fetch_from_fork(target_repo, source_disk_path, source_branch)
        
    # Perform a dry-run merge (creates an index in memory, doesn't touch working tree)
    # Since these are bare repos, pygit2 creates an in-memory index.
    index = target_repo.merge_commits(target_commit, source_commit)
    return not index.conflicts


def get_pr_diff(
    target_disk_path: str,
    source_disk_path: str,
    target_branch: str,
    source_branch: str,
) -> str:
    """
    Generate a diff between the target branch and the source branch.
    Uses merge-base to generate the diff from where the branch diverged,
    matching GitHub's PR diff behavior.
    """
    target_repo = pygit2.Repository(target_disk_path)
    
    target_commit = _get_branch_commit(target_repo, target_branch)
    
    if target_disk_path == source_disk_path:
        source_commit = _get_branch_commit(target_repo, source_branch)
    else:
        source_commit = _fetch_from_fork(target_repo, source_disk_path, source_branch)
        
    merge_base_oid = target_repo.merge_base(target_commit.id, source_commit.id)
    if not merge_base_oid:
        # No common ancestor, diff against empty tree or target commit
        diff = target_repo.diff(target_commit.tree, source_commit.tree)
    else:
        merge_base_commit = target_repo.get(merge_base_oid)
        diff = target_repo.diff(merge_base_commit.tree, source_commit.tree)
        
    return diff.patch or ""


def merge_commit(
    target_disk_path: str,
    source_disk_path: str,
    target_branch: str,
    source_branch: str,
    committer_name: str,
    committer_email: str,
    commit_message: str,
) -> str:
    """
    Perform a 3-way merge commit.
    
    Args:
        target_disk_path: Path to the target (bare) repository.
        source_disk_path: Path to the source (bare) repository.
        target_branch: Branch to merge into.
        source_branch: Branch to merge from.
        committer_name: Name of the user performing the merge.
        committer_email: Email of the user performing the merge.
        commit_message: The merge commit message.
        
    Returns:
        The new commit SHA string.
        
    Raises:
        ConflictError: If the merge results in conflicts.
    """
    target_repo = pygit2.Repository(target_disk_path)
    
    target_ref = target_repo.lookup_branch(target_branch)
    if not target_ref:
        raise AppError(f"Target branch '{target_branch}' not found.")
        
    target_commit = target_ref.peel(pygit2.GIT_OBJ_COMMIT)
    
    if target_disk_path == source_disk_path:
        source_commit = _get_branch_commit(target_repo, source_branch)
    else:
        source_commit = _fetch_from_fork(target_repo, source_disk_path, source_branch)
        
    # Check if already up-to-date (fast-forward possible, but we enforce merge commits)
    # Perform the merge in memory
    index = target_repo.merge_commits(target_commit, source_commit)
    
    if index.conflicts:
        raise ConflictError("Automatic merge failed due to conflicts. Resolve manually.")
        
    # Write the resulting tree
    tree_oid = index.write_tree(target_repo)
    
    # Create the merge commit
    now = datetime.now(timezone.utc)
    # pygit2 signature requires a timestamp and offset. We use current time in UTC.
    signature = pygit2.Signature(
        name=committer_name,
        email=committer_email,
        time=int(now.timestamp()),
        offset=0,
    )
    
    new_commit_oid = target_repo.create_commit(
        target_ref.name,  # Update the target branch ref directly
        signature,        # Author (who wrote the code - for a merge commit, usually the person merging)
        signature,        # Committer (who applied the merge)
        commit_message,
        tree_oid,
        [target_commit.id, source_commit.id] # Parents: target first, then source
    )
    
    return str(new_commit_oid)
