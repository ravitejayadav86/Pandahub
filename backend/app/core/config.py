from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General ---
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    PROJECT_NAME: str = "PandaHub"
    API_V1_PREFIX: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # --- PostgreSQL ---
    POSTGRES_USER: str = "pandahub"
    POSTGRES_PASSWORD: str = "change_me_in_production"
    POSTGRES_DB: str = "pandahub"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+asyncpg://pandahub:change_me_in_production@postgres:5432/pandahub"

    # Sync URL used by Alembic (psycopg2)
    @property
    def DATABASE_URL_SYNC(self) -> str:
        return self.DATABASE_URL.replace("+asyncpg", "+psycopg2")

    # --- Redis ---
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: str = "redis://redis:6379/0"

    # --- JWT / Auth ---
    JWT_SECRET_KEY: str = "change_me_super_secret_key_min_32_chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- OAuth (optional) ---
    GITHUB_OAUTH_CLIENT_ID: str = ""
    GITHUB_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""

    # --- Email ---
    SMTP_HOST: str = "smtp.mailtrap.io"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@pandahub.dev"
    SMTP_TLS: bool = True

    # --- MinIO / Object Storage ---
    MINIO_ROOT_USER: str = "pandahub_admin"
    MINIO_ROOT_PASSWORD: str = "change_me_in_production"
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_BUCKET_AVATARS: str = "pandahub-avatars"
    MINIO_BUCKET_LFS: str = "pandahub-lfs"
    MINIO_BUCKET_ARTIFACTS: str = "pandahub-artifacts"
    MINIO_USE_SSL: bool = False

    # --- Git Storage ---
    GIT_REPOS_ROOT: str = "/data/repositories"
    GIT_HTTP_ROUTE_PREFIX: str = "/git"

    # --- AI Service ---
    AI_PROVIDER: str = "anthropic"
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-6"

    # --- Celery ---
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # --- Rate Limiting ---
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_GIT_OPS_PER_MINUTE: int = 30

    # --- CORS ---
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
