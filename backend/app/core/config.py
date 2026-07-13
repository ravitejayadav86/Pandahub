"""
Centralized, validated application settings.

Why Pydantic Settings and not `os.environ.get()` scattered across files:
every config value is validated ONCE at process startup (wrong type / missing
required value crashes immediately with a clear error) instead of failing
mysteriously deep inside a request handler hours later. This is also the
single place referenced by Module 1's security architecture note that
secrets must have "a single validated source of truth."
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---- General ----
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PROJECT_NAME: str = "PandaHub"
    API_V1_PREFIX: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # ---- Database ----
    DATABASE_URL: str

    # ---- Redis ----
    REDIS_URL: str = "redis://redis:6379/0"

    # ---- JWT ----
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ---- Application-layer encryption (2FA secrets, OAuth tokens at rest) ----
    # Separate from JWT_SECRET_KEY on purpose: rotating the JWT signing key
    # (e.g. after a suspected leak) should never simultaneously break every
    # user's stored 2FA secret. Must be a valid Fernet key (32 url-safe base64 bytes).
    ENCRYPTION_KEY: str = Field(..., min_length=32)

    # ---- OAuth ----
    GITHUB_OAUTH_CLIENT_ID: str | None = None
    GITHUB_OAUTH_CLIENT_SECRET: str | None = None
    GOOGLE_OAUTH_CLIENT_ID: str | None = None
    GOOGLE_OAUTH_CLIENT_SECRET: str | None = None

    # ---- Email ----
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "no-reply@pandahub.dev"
    SMTP_TLS: bool = True

    # ---- MinIO ----
    MINIO_ROOT_USER: str = "pandahub_admin"
    MINIO_ROOT_PASSWORD: str = "change_me"
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_BUCKET_AVATARS: str = "pandahub-avatars"
    MINIO_BUCKET_LFS: str = "pandahub-lfs"
    MINIO_BUCKET_ARTIFACTS: str = "pandahub-artifacts"
    MINIO_USE_SSL: bool = False

    # ---- Git storage ----
    GIT_REPOS_ROOT: str = "/data/repositories"
    GIT_HTTP_ROUTE_PREFIX: str = "/git"

    # ---- AI ----
    AI_PROVIDER: str = "anthropic"
    ANTHROPIC_API_KEY: str | None = None
    AI_MODEL: str = "claude-sonnet-4-6"

    # ---- Celery ----
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # ---- Rate limiting ----
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_GIT_OPS_PER_MINUTE: int = 30

    # ---- CORS ----
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Cached so `Settings()` (which reads/validates the environment) runs
    exactly once per process, not on every request that depends on it."""
    return Settings()
