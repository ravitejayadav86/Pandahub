"""
FastAPI application entrypoint.

CORS is configured from `settings.cors_origins_list` (env-driven), never
wildcarded ("*") in combination with credentials=True -- that combination
is a known misconfiguration that defeats the purpose of CORS entirely.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth
from app.core.config import get_settings
from app.services.storage_service import ensure_buckets_exist

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: make sure MinIO buckets exist before the first request needs them.
    ensure_buckets_exist()
    yield
    # Shutdown: nothing to clean up yet (Module 5+ adds Redis pool teardown, etc.)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Build. Collaborate. Innovate.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["system"])
async def health_check():
    """Liveness/readiness probe target for Docker/orchestrator healthchecks."""
    return {"status": "ok", "service": settings.PROJECT_NAME}
