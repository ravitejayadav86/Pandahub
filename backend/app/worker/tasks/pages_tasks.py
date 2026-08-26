"""
Celery tasks for PandaHub Pages — static-site build pipeline.

This task is enqueued:
  - When Pages is first enabled on a repository
  - When the user changes the source branch or folder
  - On every push to the Pages source branch (fired from git_tasks.post_receive_hook)
  - Manually via POST /{owner}/{repo}/pages/rebuild

Task responsibilities:
  1. Open the bare git repository with pygit2 (sync, no checkout needed)
  2. Resolve the source branch ref to a commit SHA
  3. Walk the tree at source_branch:source_folder
  4. Upload every file blob to MinIO under pages/{owner}/{repo}/{sha}/
  5. Update RepositoryPages.status, published_sha, published_at in the DB

Uses the same synchronous SQLAlchemy session pattern as git_tasks.py
(Celery workers have no asyncio event loop).
"""
from __future__ import annotations

import mimetypes
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import get_logger
from app.worker.celery_app import celery_app

settings = get_settings()
logger = get_logger("app.worker.tasks.pages_tasks")

mimetypes.init()

# ---------------------------------------------------------------------------
# Sync DB session (same pattern as git_tasks.py)
# ---------------------------------------------------------------------------

_sync_engine = None
_sync_session_factory = None


def _get_sync_session():
    global _sync_engine, _sync_session_factory
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    if _sync_engine is None:
        sync_url = (
            settings.DATABASE_URL
            .replace("postgresql+asyncpg://", "postgresql+psycopg://")
            .replace("postgresql://", "postgresql+psycopg://")
        )
        _sync_engine = create_engine(sync_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
        _sync_session_factory = sessionmaker(bind=_sync_engine, expire_on_commit=False)

    return _sync_session_factory()


# ---------------------------------------------------------------------------
# MinIO helper
# ---------------------------------------------------------------------------

def _s3_client():
    import boto3
    from botocore.client import Config as BotoConfig

    scheme = "https" if settings.MINIO_USE_SSL else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ROOT_USER,
        aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _guess_mime(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


# ---------------------------------------------------------------------------
# Main task
# ---------------------------------------------------------------------------

@celery_app.task(
    name="app.worker.tasks.pages_tasks.build_pages_task",
    queue="git_ops",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def build_pages_task(repo_id: str, owner_username: str, repo_name: str) -> dict:
    """
    Build a PandaHub Pages site from a bare git repository.

    Args:
        repo_id:        UUID string of the repository.
        owner_username: Username (or org slug) of the repo owner (used for MinIO key prefix).
        repo_name:      Repository name (used for MinIO key prefix).

    Returns:
        A summary dict with build results.
    """
    logger.info(
        "pages build started",
        extra={"repo_id": repo_id, "owner": owner_username, "repo": repo_name},
    )

    repo_uuid = uuid.UUID(repo_id)
    summary: dict = {
        "repo_id": repo_id,
        "owner": owner_username,
        "repo": repo_name,
        "files_uploaded": 0,
        "status": "failed",
        "sha": None,
        "error": None,
    }

    session = _get_sync_session()
    try:
        from sqlalchemy import select  # noqa: PLC0415
        from app.models.pages import RepositoryPages  # noqa: PLC0415
        from app.models.repo import Repository  # noqa: PLC0415

        # ------------------------------------------------------------------
        # 1. Load the Pages config row
        # ------------------------------------------------------------------
        pages = session.execute(
            select(RepositoryPages).where(RepositoryPages.repository_id == repo_uuid)
        ).scalar_one_or_none()

        if pages is None or not pages.enabled:
            logger.info("pages build skipped — Pages not enabled", extra={"repo_id": repo_id})
            return summary

        # Mark as building
        pages.status = "building"
        session.commit()

        repo_row = session.execute(
            select(Repository).where(Repository.id == repo_uuid)
        ).scalar_one_or_none()

        if repo_row is None:
            raise RuntimeError(f"Repository {repo_id} not found in DB")

        disk_path = repo_row.disk_path

        # ------------------------------------------------------------------
        # 2. Open bare repo with pygit2
        # ------------------------------------------------------------------
        try:
            import pygit2  # noqa: PLC0415
        except ImportError:
            raise RuntimeError("pygit2 is not installed — cannot build Pages")

        if not Path(disk_path).exists():
            raise RuntimeError(
                f"Bare repo not found at {disk_path} — may be restoring from backup"
            )

        try:
            bare_repo = pygit2.Repository(disk_path)
        except Exception as exc:
            raise RuntimeError(f"Failed to open bare repo: {exc}") from exc

        # ------------------------------------------------------------------
        # 3. Resolve source branch → commit → tree
        # ------------------------------------------------------------------
        source_branch = pages.source_branch
        try:
            ref = bare_repo.lookup_branch(source_branch)
            if ref is None:
                # Try as a tag or full ref
                ref = bare_repo.references.get(f"refs/heads/{source_branch}")
            if ref is None:
                raise RuntimeError(
                    f"Branch '{source_branch}' not found in repository"
                )
            commit = bare_repo.get(ref.target)
            if commit is None:
                raise RuntimeError(f"Could not resolve commit for branch '{source_branch}'")
        except Exception as exc:
            raise RuntimeError(f"Failed to resolve branch '{source_branch}': {exc}") from exc

        commit_sha = str(commit.id)
        summary["sha"] = commit_sha

        # Resolve tree (root or sub-folder)
        source_folder = pages.source_folder.strip("/")
        root_tree = commit.peel(pygit2.Tree)

        if source_folder:
            try:
                entry = root_tree[source_folder]
                folder_tree = bare_repo.get(entry.id)
                if not isinstance(folder_tree, pygit2.Tree):
                    raise RuntimeError(f"'{source_folder}' is not a directory")
            except KeyError:
                raise RuntimeError(
                    f"Source folder '{source_folder}' not found in branch '{source_branch}'"
                )
        else:
            folder_tree = root_tree

        # ------------------------------------------------------------------
        # 4. Walk tree and upload files to MinIO
        # ------------------------------------------------------------------
        client = _s3_client()
        bucket = settings.MINIO_BUCKET_PAGES
        prefix = f"pages/{owner_username}/{repo_name}/{commit_sha}/"

        files_uploaded = 0

        def _walk_tree(tree: pygit2.Tree, path_prefix: str) -> None:
            nonlocal files_uploaded
            for entry in tree:
                entry_path = f"{path_prefix}{entry.name}"
                obj = bare_repo.get(entry.id)

                if isinstance(obj, pygit2.Tree):
                    # Recurse into sub-directory
                    _walk_tree(obj, f"{entry_path}/")
                elif isinstance(obj, pygit2.Blob):
                    # Upload file blob
                    key = f"{prefix}{entry_path}"
                    content_type = _guess_mime(entry.name)
                    try:
                        client.put_object(
                            Bucket=bucket,
                            Key=key,
                            Body=BytesIO(obj.data),
                            ContentType=content_type,
                            ContentLength=obj.size,
                        )
                        files_uploaded += 1
                        if files_uploaded % 50 == 0:
                            logger.info(
                                "pages build progress",
                                extra={
                                    "repo_id": repo_id,
                                    "files_uploaded": files_uploaded,
                                },
                            )
                    except Exception as upload_exc:
                        logger.warning(
                            "pages build: file upload failed",
                            extra={"key": key, "error": str(upload_exc)},
                        )

        _walk_tree(folder_tree, "")

        summary["files_uploaded"] = files_uploaded

        # ------------------------------------------------------------------
        # 5. Update Pages row to "active"
        # ------------------------------------------------------------------
        pages.status = "active"
        pages.published_sha = commit_sha
        pages.published_at = datetime.now(timezone.utc)
        session.commit()

        summary["status"] = "active"

        logger.info(
            "pages build completed",
            extra={
                "repo_id": repo_id,
                "sha": commit_sha,
                "files_uploaded": files_uploaded,
            },
        )

    except Exception as exc:
        logger.exception(
            "pages build failed",
            extra={"repo_id": repo_id, "error": str(exc)},
        )
        summary["error"] = str(exc)

        # Mark as failed in DB (best-effort)
        try:
            from sqlalchemy import select as _select  # noqa: PLC0415
            from app.models.pages import RepositoryPages as _RP  # noqa: PLC0415

            pages_row = session.execute(
                _select(_RP).where(_RP.repository_id == repo_uuid)
            ).scalar_one_or_none()
            if pages_row:
                pages_row.status = "failed"
                session.commit()
        except Exception:
            pass  # Don't mask the original exception

        # Re-raise so Celery retries on transient failures
        raise

    finally:
        session.close()

    return summary
