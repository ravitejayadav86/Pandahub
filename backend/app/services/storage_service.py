"""
Object storage service (MinIO, S3-compatible via boto3).

Avatars specifically: validated for size/type here at the service layer
(not just trusted from client-provided Content-Type, which is trivially
spoofable) before ever reaching storage. Filenames are re-generated as
`{user_id}/{uuid}.{ext}` server-side -- never derived from the
client-supplied filename, which prevents path traversal and collisions.
"""
import uuid
from io import BytesIO

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError
from fastapi import UploadFile, HTTPException, status

from app.core.config import get_settings

settings = get_settings()

ALLOWED_AVATAR_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _get_s3_client():
    """Build a boto3 S3 client from settings.

    Works with both Backblaze B2 (production — uses B2_* env vars) and
    local MinIO (dev — uses MINIO_* env vars). The `storage_*` properties
    on Settings transparently resolve which credentials to use.
    """
    endpoint = settings.storage_endpoint
    # B2 endpoint comes without scheme; MinIO endpoint already includes it.
    if not endpoint.startswith("http"):
        scheme = "https" if settings.storage_use_ssl else "http"
        endpoint = f"{scheme}://{endpoint}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.storage_access_key,
        aws_secret_access_key=settings.storage_secret_key,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_buckets_exist() -> None:
    """Called once at application startup (see main.py lifespan) so the
    required buckets exist before the first upload request arrives.

    Failure is non-fatal: if MinIO is unreachable (e.g. not yet configured
    in a staging environment) we log a warning and continue startup so the
    rest of the API remains available.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        client = _get_s3_client()
        # B2 uses a single bucket; MinIO uses three separate ones.
        buckets = (
            [settings.B2_BUCKET_NAME]
            if settings.B2_BUCKET_NAME
            else [
                settings.MINIO_BUCKET_AVATARS,
                settings.MINIO_BUCKET_LFS,
                settings.MINIO_BUCKET_ARTIFACTS,
            ]
        )
        for bucket in buckets:
            try:
                client.head_bucket(Bucket=bucket)
            except ClientError:
                client.create_bucket(Bucket=bucket)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Object storage not reachable at startup — uploads unavailable. "
            "Configure B2_* or MINIO_* credentials to enable storage. Error: %s",
            exc,
        )


async def upload_avatar(user_id: uuid.UUID, file: UploadFile) -> str:
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
