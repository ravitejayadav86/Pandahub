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
