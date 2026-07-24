"""
FastAPI application entrypoint.

CORS is configured from `settings.cors_origins_list` (env-driven), never
wildcarded ("*") in combination with credentials=True -- that combination
is a known misconfiguration that defeats the purpose of CORS entirely.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, repos, git, issues, pulls, orgs, startups
from app.api import ws
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestContextMiddleware
from app.services.storage_service import ensure_buckets_exist
from app.websockets.manager import connection_manager

settings = get_settings()

configure_logging(level="DEBUG" if settings.DEBUG else "INFO")
logger = get_logger("app.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_buckets_exist()
    await connection_manager.start_listener()
    logger.info("PandaHub backend started", extra={"environment": settings.ENVIRONMENT})
    yield
    # Shutdown
    await connection_manager.stop_listener()
    logger.info("PandaHub backend shutting down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Build. Collaborate. Innovate.",
    version="0.1.0",
    lifespan=lifespan,
)

# Order matters: CORS should wrap everything (including error responses),
# so it's added first. RequestContextMiddleware runs inside that, assigning
# a request_id before any route or exception handler needs to log one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)

register_exception_handlers(app)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(repos.router, prefix=settings.API_V1_PREFIX)
app.include_router(issues.router, prefix=settings.API_V1_PREFIX)
app.include_router(pulls.router, prefix=settings.API_V1_PREFIX)
app.include_router(orgs.router, prefix=settings.API_V1_PREFIX)
app.include_router(startups.router, prefix=settings.API_V1_PREFIX)
# Git transport routes are NOT under /api/v1 — they use the /git/ prefix
# that nginx routes separately (proxy_request_buffering off, long timeouts).
# The .git URL convention is a well-known client expectation that must not
# be nested under /api/v1.
app.include_router(git.router)
app.include_router(ws.router)


@app.get("/health", tags=["system"])
async def health_check():
    """Liveness/readiness probe target for Docker/orchestrator healthchecks."""
    return {"status": "ok", "service": settings.PROJECT_NAME}
