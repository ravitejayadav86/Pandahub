"""
Backblaze B2 repository storage service.

Responsibilities
----------------
• Back up and restore bare git repositories as gzipped tarballs on B2.
• Provide presigned download URLs for clone/fetch operations that bypass
  the application server (direct client ? B2 transfer).
• Enforce the single-bucket, namespaced key layout:

      repos/{owner}/{repo_name}.tar.gz

  Owner and repo name are lowercased and slug-sanitised here so callers
  (repo_service.py, Celery tasks) never need to think about it.

Why a separate module from storage_service.py
----------------------------------------------
storage_service.py owns the MinIO buckets (avatars / LFS / artifacts).
Those are all *internal* objects managed exclusively by the application.
B2 is a *durable* offsite tier meant for cold-backup and eventual
direct-client delivery of large repo archives — different credentials,
different endpoint, different access pattern.  Keeping them separate
prevents credential coupling and makes it trivial to rotate one without
touching the other.

Thread safety
-------------
boto3 clients are not thread-safe when shared across threads.  This
module creates a new client per call via ``_b2_client()``.  The overhead
is negligible (connection pool is kept alive by urllib3) and avoids
subtle race conditions in the Celery worker pool.
"""
from __future__ import annotations

import io
import logging
import re
import tarfile
from pathlib import Path

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError
from fastapi import HTTPException, status

from app.core.config import get_settings

logger = logging.getLogger("app.services.repo_storage")

settings = get_settings()

# Pre-signed URL TTL for clone/fetch downloads (24 hours).
PRESIGNED_CLONE_URL_EXPIRY: int = 86_400

# Maximum size of a repo tarball we are willing to download from B2 into memory.
# Repositories larger than this should stream directly to disk (see restore_repo).
_MAX_IN_MEMORY_BYTES: int = 512 * 1024 * 1024  # 512 MB

_SLUG_RE = re.compile(r"[^a-z0-9._-]+")


# -----------------------------------------------------------------------------
# Internal helpers
# -----------------------------------------------------------------------------


def _b2_client():
    """Return a fresh boto3 S3 client pointed at Backblaze B2."""
    endpoint = settings.B2_ENDPOINT_URL
    # Ensure the endpoint has a scheme so boto3 can parse it correctly.
    if not endpoint.startswith(("http://", "https://")):
        endpoint = f"https://{endpoint}"

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.B2_KEY_ID,
        aws_secret_access_key=settings.B2_APPLICATION_KEY,
        region_name=settings.B2_REGION,
        config=BotoConfig(
            signature_version="s3v4",
            # B2 supports path-style only for older regions; virtual-hosted
            # style is preferred for S3-compatible requests.
            s3={"addressing_style": "path"},
        ),
    )


def _object_key(owner: str, repo_name: str) -> str:
    """
    Derive the deterministic B2 object key for a repository archive.

    Both segments are lowercased and stripped of characters outside
    ``[a-z0-9._-]`` so the key is safe in URLs and unambiguous across
    case-insensitive filesystems.

    Example:
        >>> _object_key("Alice", "My Awesome Repo!")
        'repos/alice/my-awesome-repo.tar.gz'
    """
    def _slug(s: str) -> str:
        return _SLUG_RE.sub("-", s.lower()).strip("-") or "unknown"

    return f"repos/{_slug(owner)}/{_slug(repo_name)}.tar.gz"


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------


def backup_repo(disk_path: str | Path, owner: str, repo_name: str) -> str:
    """
    Pack a bare git repository at *disk_path* and upload it to B2.

    The repository is packed as a gzipped tar archive in memory (streaming
    for repos that fit within ``_MAX_IN_MEMORY_BYTES``; caller should run
    this in a Celery task or executor for large repos).

    Args:
        disk_path:  Absolute path to the bare ``.git`` directory on disk.
        owner:      Repository owner (username or org slug).
        repo_name:  Repository name.

    Returns:
        The B2 object key that was written (useful for logging / DB records).

    Raises:
        HTTPException(500): on any B2 upload error.
    """
    disk_path = Path(disk_path)
    if not disk_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository path '{disk_path}' does not exist on disk.",
        )

    key = _object_key(owner, repo_name)
    logger.info("Backing up repo '%s/%s' -> B2 key '%s'", owner, repo_name, key)

    # Build the tarball in memory.
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(str(disk_path), arcname=repo_name)
    buf.seek(0)
    size = buf.getbuffer().nbytes

    client = _b2_client()
    try:
        client.put_object(
            Bucket=settings.B2_BUCKET_NAME,
            Key=key,
            Body=buf,
            ContentType="application/gzip",
            ContentLength=size,
            Metadata={
                "owner": owner,
                "repo": repo_name,
            },
        )
    except ClientError as exc:
        logger.error("B2 upload failed for '%s': %s", key, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to back up repository to B2: {exc}",
        )

    logger.info("Backup complete -- %d bytes -> '%s'", size, key)
    return key


def restore_repo(dest_path: str | Path, owner: str, repo_name: str) -> None:
    """
    Download a repository archive from B2 and extract it to *dest_path*.

    The target directory is created if it does not exist.  Existing
    contents are overwritten — callers should ensure *dest_path* is either
    empty or a disposable staging area before calling this.

    Args:
        dest_path:  Directory into which the archive will be extracted.
        owner:      Repository owner slug.
        repo_name:  Repository name slug.

    Raises:
        HTTPException(404): if the object does not exist on B2.
        HTTPException(500): on any download or extraction error.
    """
    dest_path = Path(dest_path)
    dest_path.mkdir(parents=True, exist_ok=True)

    key = _object_key(owner, repo_name)
    logger.info("Restoring repo '%s/%s' from B2 key '%s'", owner, repo_name, key)

    client = _b2_client()
    try:
        response = client.get_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No backup found for '{owner}/{repo_name}' on B2.",
            )
        logger.error("B2 download failed for '%s': %s", key, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download repository from B2: {exc}",
        )

    try:
        body = response["Body"]
        with tarfile.open(fileobj=body, mode="r:gz") as tar:
            tar.extractall(path=str(dest_path))
    except Exception as exc:
        logger.error("Failed to extract B2 archive for '%s/%s': %s", owner, repo_name, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract repository archive: {exc}",
        )

    logger.info("Restore complete -> '%s'", dest_path)


def repo_backup_exists(owner: str, repo_name: str) -> bool:
    """
    Return ``True`` if a backup archive exists on B2 for *owner/repo_name*.

    Uses a lightweight ``head_object`` call so no data is transferred.
    """
    key = _object_key(owner, repo_name)
    client = _b2_client()
    try:
        client.head_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
        return True
    except ClientError:
        return False


def backup_metadata(owner: str, repo_name: str) -> dict | None:
    """
    Return size and last-modified timestamp for the B2 backup object, or
    ``None`` if no backup exists.

    Return shape::

        {
            "key":           "repos/alice/myrepo.tar.gz",
            "size_bytes":    12345678,
            "last_modified": "2026-01-01T00:00:00+00:00",   # ISO-8601
        }
    """
    key = _object_key(owner, repo_name)
    client = _b2_client()
    try:
        head = client.head_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
        return {
            "key": key,
            "size_bytes": head["ContentLength"],
            "last_modified": head["LastModified"].isoformat(),
        }
    except ClientError:
        return None


def generate_clone_url(
    owner: str,
    repo_name: str,
    expiry: int = PRESIGNED_CLONE_URL_EXPIRY,
) -> str:
    """
    Generate a time-limited pre-signed GET URL for the repository archive.

    Useful for letting a client fetch the tarball directly from B2 without
    routing gigabytes through the application server.

    Args:
        owner:     Repository owner slug.
        repo_name: Repository name slug.
        expiry:    URL validity in seconds (default 24 hours).

    Returns:
        A pre-signed HTTPS URL valid for *expiry* seconds.

    Raises:
        HTTPException(404): if no backup archive exists.
        HTTPException(500): if the pre-signed URL cannot be generated.
    """
    key = _object_key(owner, repo_name)
    if not repo_backup_exists(owner, repo_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No backup archive found for '{owner}/{repo_name}' on B2.",
        )

    client = _b2_client()
    try:
        url: str = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.B2_BUCKET_NAME, "Key": key},
            ExpiresIn=expiry,
        )
        return url
    except ClientError as exc:
        logger.error("Failed to generate pre-signed URL for '%s': %s", key, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate clone URL: {exc}",
        )


def delete_backup(owner: str, repo_name: str) -> bool:
    """
    Delete the B2 backup archive for *owner/repo_name*.

    Returns:
        ``True`` if the object was deleted, ``False`` if it did not exist.

    Raises:
        HTTPException(500): on unexpected B2 errors.
    """
    key = _object_key(owner, repo_name)
    client = _b2_client()
    try:
        client.delete_object(Bucket=settings.B2_BUCKET_NAME, Key=key)
        logger.info("Deleted B2 backup '%s'", key)
        return True
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            return False
        logger.error("Failed to delete B2 object '%s': %s", key, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete repository backup: {exc}",
        )
