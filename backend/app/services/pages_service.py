"""
PandaHub Pages service — static-site publishing from git repositories.

Flow overview:
  1. User POSTs to /{owner}/{repo}/pages → enable_pages() creates/updates
     the RepositoryPages row and enqueues the initial build task.
  2. The Celery task (app.worker.tasks.pages_tasks.build_pages_task) runs in
     the git_ops queue: it opens the bare repo with pygit2, walks the source
     branch:folder tree, uploads every file to MinIO under
     pages/{owner}/{repo}/{sha}/, then marks the row status="active".
  3. GET /api/v1/pages/{owner}/{repo}/{path} → serve_pages_file() streams
     the file from MinIO back to the caller with a correct Content-Type.

Key design decisions:
  - Objects are keyed by SHA so every build is immutable and the previous
    version is still available while the new build runs.  The serving
    endpoint always reads from the key stored in published_sha.
  - Serving is done synchronously (boto3 get_object) because the MinIO
    endpoint is on the same private network, so latency is negligible.
    Moving to presigned-URL redirects is a straightforward future upgrade.
  - The service never touches the git working tree (no git clone).  pygit2
    reads directly from the bare repo, so there's no disk space needed for
    a checkout.
"""
from __future__ import annotations

import mimetypes
import uuid
from pathlib import PurePosixPath
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.pages import RepositoryPages
from app.models.repo import Repository

settings = get_settings()
logger = get_logger("app.services.pages_service")

# Ensure mimetypes DB is loaded once at import time
mimetypes.init()


# ---------------------------------------------------------------------------
# Internal MinIO helper
# ---------------------------------------------------------------------------

def _s3():
    """Return a synchronous boto3 S3 client pointing at MinIO."""
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


# ---------------------------------------------------------------------------
# Object-key helpers
# ---------------------------------------------------------------------------

def _pages_prefix(owner: str, repo_name: str, sha: str) -> str:
    """MinIO key prefix for a specific build: pages/{owner}/{repo}/{sha}/"""
    return f"pages/{owner}/{repo_name}/{sha}/"


def _pages_key(owner: str, repo_name: str, sha: str, file_path: str) -> str:
    """Full MinIO key for a single file inside a Pages build."""
    # Strip leading slash so key never starts with //
    clean_path = file_path.lstrip("/")
    return f"{_pages_prefix(owner, repo_name, sha)}{clean_path}"


# ---------------------------------------------------------------------------
# Async service calls (called from API endpoints)
# ---------------------------------------------------------------------------

async def get_pages(db: AsyncSession, repo_id: uuid.UUID) -> Optional[RepositoryPages]:
    """Return the RepositoryPages row for a repository, or None if not enabled."""
    result = await db.execute(
        select(RepositoryPages).where(RepositoryPages.repository_id == repo_id)
    )
    return result.scalar_one_or_none()


async def enable_pages(
    db: AsyncSession,
    repository: Repository,
    owner_username: str,
    source_branch: str = "main",
    source_folder: str = "/",
) -> RepositoryPages:
    """
    Enable (or update) Pages for a repository.

    If a Pages row already exists it is updated in-place; otherwise a new one
    is created.  Either way the build task is enqueued so the site is
    available as soon as possible.
    """
    existing = await get_pages(db, repository.id)

    if existing:
        # Update source config and reset build state
        existing.source_branch = source_branch
        existing.source_folder = source_folder
        existing.enabled = True
        existing.status = "pending"
        pages = existing
    else:
        pages = RepositoryPages(
            repository_id=repository.id,
            enabled=True,
            source_branch=source_branch,
            source_folder=source_folder,
            status="pending",
        )
        db.add(pages)

    await db.commit()
    await db.refresh(pages)

    # Enqueue the initial build (non-blocking)
    _enqueue_build(str(repository.id), owner_username, repository.name)

    return pages


async def update_pages(
    db: AsyncSession,
    repository: Repository,
    owner_username: str,
    source_branch: Optional[str] = None,
    source_folder: Optional[str] = None,
) -> RepositoryPages:
    """Update Pages source branch/folder and trigger a rebuild."""
    pages = await get_pages(db, repository.id)
    if pages is None:
        raise NotFoundError("Pages is not enabled for this repository.")

    if source_branch is not None:
        pages.source_branch = source_branch
    if source_folder is not None:
        pages.source_folder = source_folder
    pages.status = "pending"

    await db.commit()
    await db.refresh(pages)

    _enqueue_build(str(repository.id), owner_username, repository.name)
    return pages


async def disable_pages(db: AsyncSession, repository: Repository, owner_username: str) -> None:
    """Disable Pages and delete all published artifacts from MinIO."""
    pages = await get_pages(db, repository.id)
    if pages is None:
        return  # already disabled — idempotent

    # Delete published artifacts from MinIO (best-effort; errors are logged)
    if pages.published_sha:
        try:
            _delete_build_artifacts(owner_username, repository.name, pages.published_sha)
        except Exception as exc:
            logger.warning(
                "Failed to delete Pages artifacts from MinIO",
                extra={
                    "repo_id": str(repository.id),
                    "sha": pages.published_sha,
                    "error": str(exc),
                },
            )

    await db.delete(pages)
    await db.commit()


async def trigger_rebuild(
    db: AsyncSession,
    repository: Repository,
    owner_username: str,
) -> RepositoryPages:
    """Manually trigger a Pages rebuild without changing the source config."""
    pages = await get_pages(db, repository.id)
    if pages is None:
        raise NotFoundError("Pages is not enabled for this repository.")

    pages.status = "pending"
    await db.commit()
    await db.refresh(pages)

    _enqueue_build(str(repository.id), owner_username, repository.name)
    return pages


# ---------------------------------------------------------------------------
# Serving
# ---------------------------------------------------------------------------

async def serve_pages_file(
    owner: str,
    repo_name: str,
    file_path: str,
    published_sha: str,
) -> tuple[bytes, str]:
    """
    Retrieve a single file from the active Pages build.

    Returns:
        (file_bytes, content_type)

    Raises:
        NotFoundError if the file doesn't exist in the active build.
    """
    from botocore.exceptions import ClientError

    # Normalise path: "" or "/" → "index.html"
    clean = file_path.strip("/") or "index.html"
    # If the caller requests a "directory" (no extension), try index.html
    if "." not in PurePosixPath(clean).name:
        clean = f"{clean}/index.html".lstrip("/")

    key = _pages_key(owner, repo_name, published_sha, clean)

    try:
        client = _s3()
        response = client.get_object(Bucket=settings.MINIO_BUCKET_PAGES, Key=key)
        body = response["Body"].read()
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code in ("NoSuchKey", "404"):
            # Try bare index.html fallback for SPA routing
            if not clean.endswith("index.html"):
                fallback_key = _pages_key(owner, repo_name, published_sha, "index.html")
                try:
                    resp2 = _s3().get_object(
                        Bucket=settings.MINIO_BUCKET_PAGES, Key=fallback_key
                    )
                    body = resp2["Body"].read()
                    clean = "index.html"
                except ClientError:
                    raise NotFoundError(f"File '{file_path}' not found in Pages build.")
            else:
                raise NotFoundError(f"File '{file_path}' not found in Pages build.")
        else:
            raise

    content_type = _guess_mime(clean)
    return body, content_type


# ---------------------------------------------------------------------------
# Synchronous helpers (called from Celery tasks & internal utilities)
# ---------------------------------------------------------------------------

def _guess_mime(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    return mime or "application/octet-stream"


def _enqueue_build(repo_id: str, owner_username: str, repo_name: str) -> None:
    """Fire the build Celery task non-fatally."""
    try:
        from app.worker.tasks.pages_tasks import build_pages_task  # noqa: PLC0415
        build_pages_task.delay(repo_id, owner_username, repo_name)
    except Exception as exc:
        logger.error(
            "Failed to enqueue Pages build task",
            extra={"repo_id": repo_id, "error": str(exc)},
        )


def _delete_build_artifacts(owner: str, repo_name: str, sha: str) -> None:
    """Delete all MinIO objects under the pages/{owner}/{repo}/{sha}/ prefix."""
    client = _s3()
    bucket = settings.MINIO_BUCKET_PAGES
    prefix = _pages_prefix(owner, repo_name, sha)

    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if objects:
            client.delete_objects(Bucket=bucket, Delete={"Objects": objects})
