"""
Object storage service (MinIO, S3-compatible via boto3).

Avatars specifically: validated for size/type here at the service layer
(not just trusted from client-provided Content-Type, which is trivially
spoofable) before ever reaching storage. Filenames are re-generated as
`{user_id}/{uuid}.{ext}` server-side -- never derived from the
client-supplied filename, which prevents path traversal and collisions.

LFS objects are stored by their content-addressable SHA256 OID, matching
the Git LFS pointer format. This allows deduplication: two repositories
pushing the same large binary only store one copy.

Artifacts (CI outputs, release bundles) are namespaced by
`{repo_id}/{run_id}/{filename}` to allow easy per-run cleanup.
"""
import uuid
from io import BytesIO
from typing import Optional

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError
from fastapi import UploadFile, HTTPException, status

from app.core.config import get_settings

settings = get_settings()

ALLOWED_AVATAR_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_ARTIFACT_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB
PRESIGNED_URL_EXPIRY_SECONDS = 3600  # 1 hour


def _get_s3_client():
    scheme = "https" if settings.MINIO_USE_SSL else "http"
    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ROOT_USER,
        aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_buckets_exist() -> None:
    """Called once at application startup (see main.py lifespan) so the
    required buckets exist before the first upload request arrives."""
    client = _get_s3_client()
    for bucket in (
        settings.MINIO_BUCKET_AVATARS,
        settings.MINIO_BUCKET_LFS,
        settings.MINIO_BUCKET_ARTIFACTS,
    ):
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError:
            client.create_bucket(Bucket=bucket)


# ─────────────────────────────────────────────────────────────────────────────
# Avatar
# ─────────────────────────────────────────────────────────────────────────────

async def upload_avatar(user_id: uuid.UUID, file: UploadFile) -> str:
    """Upload a user avatar image and return its public URL."""
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type '{file.content_type}'. Allowed: png, jpeg, webp, gif.",
        )

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar file exceeds 5MB limit.",
        )

    ext = file.content_type.split("/")[-1]
    object_key = f"{user_id}/{uuid.uuid4()}.{ext}"

    client = _get_s3_client()
    client.put_object(
        Bucket=settings.MINIO_BUCKET_AVATARS,
        Key=object_key,
        Body=BytesIO(contents),
        ContentType=file.content_type,
        ACL="public-read",
    )

    scheme = "https" if settings.MINIO_USE_SSL else "http"
    return f"{scheme}://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET_AVATARS}/{object_key}"


# ─────────────────────────────────────────────────────────────────────────────
# Git LFS
# ─────────────────────────────────────────────────────────────────────────────

def upload_lfs_object(oid: str, size: int, data: bytes) -> None:
    """Store a Git LFS object by its content-addressable OID (SHA256 hex).

    The key format ``{oid[:2]}/{oid[2:4]}/{oid}`` mirrors what git-lfs itself
    uses on disk, which makes manual debugging and tooling easier.

    Raises ``HTTPException(409)`` if an object with the same OID already
    exists (size mismatch would indicate data corruption).
    """
    if len(data) != size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Declared size {size} does not match received {len(data)} bytes.",
        )

    object_key = f"{oid[:2]}/{oid[2:4]}/{oid}"
    client = _get_s3_client()

    # Idempotent: if identical object already exists, skip re-upload.
    try:
        head = client.head_object(Bucket=settings.MINIO_BUCKET_LFS, Key=object_key)
        if head["ContentLength"] == size:
            return  # Already stored, nothing to do.
        # Size mismatch means corruption — refuse and surface loudly.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"LFS object {oid} already exists with a different size.",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "404":
            raise

    client.put_object(
        Bucket=settings.MINIO_BUCKET_LFS,
        Key=object_key,
        Body=BytesIO(data),
        ContentType="application/octet-stream",
        ContentLength=size,
        Metadata={"oid": oid},
    )


def download_lfs_object(oid: str) -> bytes:
    """Retrieve a Git LFS object by its OID. Raises 404 if not found."""
    object_key = f"{oid[:2]}/{oid[2:4]}/{oid}"
    client = _get_s3_client()
    try:
        response = client.get_object(Bucket=settings.MINIO_BUCKET_LFS, Key=object_key)
        return response["Body"].read()
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("404", "NoSuchKey"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LFS object {oid} not found.",
            )
        raise


def lfs_object_exists(oid: str, size: int) -> bool:
    """Return True if the LFS object exists with the declared size."""
    object_key = f"{oid[:2]}/{oid[2:4]}/{oid}"
    client = _get_s3_client()
    try:
        head = client.head_object(Bucket=settings.MINIO_BUCKET_LFS, Key=object_key)
        return head["ContentLength"] == size
    except ClientError:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Artifacts (CI outputs / release bundles)
# ─────────────────────────────────────────────────────────────────────────────

async def upload_artifact(
    repo_id: uuid.UUID,
    run_id: str,
    file: UploadFile,
) -> str:
    """Upload a CI/release artifact and return its storage key.

    Key format: ``{repo_id}/{run_id}/{sanitised_filename}``

    The original filename is kept (sanitised) because artifact downloads
    need human-readable names. The repo_id+run_id prefix ensures isolation.
    """
    contents = await file.read()
    if len(contents) > MAX_ARTIFACT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Artifact exceeds 500 MB limit.",
        )

    # Sanitise: strip path separators, keep extension
    safe_name = (file.filename or "artifact").replace("/", "_").replace("..", "_")
    object_key = f"{repo_id}/{run_id}/{safe_name}"

    client = _get_s3_client()
    client.put_object(
        Bucket=settings.MINIO_BUCKET_ARTIFACTS,
        Key=object_key,
        Body=BytesIO(contents),
        ContentType=file.content_type or "application/octet-stream",
        ContentLength=len(contents),
        Metadata={"repo_id": str(repo_id), "run_id": run_id},
    )
    return object_key


def list_artifacts(repo_id: uuid.UUID, run_id: str) -> list[dict]:
    """List all artifacts for a given repo + run combination."""
    prefix = f"{repo_id}/{run_id}/"
    client = _get_s3_client()
    try:
        response = client.list_objects_v2(
            Bucket=settings.MINIO_BUCKET_ARTIFACTS,
            Prefix=prefix,
        )
        return [
            {
                "key": obj["Key"],
                "filename": obj["Key"].split("/")[-1],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            }
            for obj in response.get("Contents", [])
        ]
    except ClientError:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Generic helpers
# ─────────────────────────────────────────────────────────────────────────────

def generate_presigned_url(
    bucket: str,
    object_key: str,
    expiry: int = PRESIGNED_URL_EXPIRY_SECONDS,
    method: str = "get_object",
) -> str:
    """Generate a time-limited pre-signed URL for direct client access.

    Args:
        bucket: Target MinIO bucket name.
        object_key: Key of the object within the bucket.
        expiry: URL validity in seconds (default 1 hour).
        method: boto3 client method name — ``"get_object"`` for downloads,
                ``"put_object"`` for direct client uploads.
    """
    client = _get_s3_client()
    try:
        return client.generate_presigned_url(
            method,
            Params={"Bucket": bucket, "Key": object_key},
            ExpiresIn=expiry,
        )
    except ClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate presigned URL: {exc}",
        )


def delete_object(bucket: str, object_key: str) -> None:
    """Delete a single object from storage. Silently ignores 404."""
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=bucket, Key=object_key)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in ("404", "NoSuchKey"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete object: {exc}",
            )


def delete_objects_with_prefix(bucket: str, prefix: str) -> int:
    """Bulk-delete all objects under a given prefix. Returns count deleted.

    Useful for cleaning up all artifacts for a repo or a specific run.
    """
    client = _get_s3_client()
    deleted_count = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if objects:
            client.delete_objects(Bucket=bucket, Delete={"Objects": objects})
            deleted_count += len(objects)
    return deleted_count
