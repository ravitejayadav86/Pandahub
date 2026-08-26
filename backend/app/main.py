"""
FastAPI application entrypoint.

CORS is configured from `settings.cors_origins_list` (env-driven), never
wildcarded ("*") in combination with credentials=True -- that combination
is a known misconfiguration that defeats the purpose of CORS entirely.
"""
from contextlib import asynccontextmanager
import asyncio
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, repos, git, issues, pulls, orgs, startups, messages, pages, error_logs
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
    # Fire the repo restore as a background task so the app starts accepting
    # health-check probes immediately. Render kills the process if /health
    # doesn't respond within the first few seconds of startup.
    asyncio.create_task(_restore_repos_on_startup())
    await connection_manager.start_listener()
    logger.info("PandaHub backend started", extra={"environment": settings.ENVIRONMENT})
    yield
    # Shutdown
    await connection_manager.stop_listener()
    logger.info("PandaHub backend shutting down")


async def _restore_repos_on_startup() -> None:
    """
    Restore any bare git repositories that are missing from disk.

    On Render (and other platforms with ephemeral filesystems), the
    /data/repositories directory is wiped on every container restart.
    This function queries all repositories from the DB and, for each
    one whose disk_path does not exist:
      - Restores from B2 if a backup exists.
      - Re-initialises an empty bare repo if no backup exists yet
        (so git-http-backend doesn't crash with FileNotFoundError).

    All errors are caught per-repo and logged; one failure never blocks
    the rest of startup.
    """
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.repo import Repository
    from app.services.repo_storage import restore_repo, repo_backup_exists
    from app.services.repo_service import _init_bare_repo

    logger.info("startup: checking for repos to restore from B2 ...")
    loop = asyncio.get_running_loop()
    restored = 0
    reinited = 0
    skipped = 0

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Repository))
            all_repos = result.scalars().all()
    except Exception as exc:
        logger.error("startup: failed to query repos from DB", extra={"error": str(exc)})
        return

    # Ensure the root directory exists first
    Path(settings.GIT_REPOS_ROOT).mkdir(parents=True, exist_ok=True)

    for repo in all_repos:
        if os.path.exists(repo.disk_path):
            skipped += 1
            continue

        # Need owner slug for B2 key lookup
        try:
            async with AsyncSessionLocal() as db:
                from app.models.user import User
                from app.models.organization import Organization
                owner_slug = None
                if repo.owner_user_id:
                    row = await db.execute(
                        select(User.username).where(User.id == repo.owner_user_id)
                    )
                    owner_slug = row.scalar_one_or_none()
                elif repo.owner_organization_id:
                    row = await db.execute(
                        select(Organization.name).where(Organization.id == repo.owner_organization_id)
                    )
                    owner_slug = row.scalar_one_or_none()

            if not owner_slug:
                logger.warning(
                    "startup: cannot resolve owner for repo, skipping",
                    extra={"repo_id": str(repo.id)},
                )
                continue

            has_backup = await loop.run_in_executor(
                None, repo_backup_exists, owner_slug, repo.name
            )

            if has_backup:
                logger.info(
                    "startup: restoring repo from B2",
                    extra={"owner": owner_slug, "repo": repo.name, "disk_path": repo.disk_path},
                )
                parent = str(Path(repo.disk_path).parent)
                await loop.run_in_executor(None, restore_repo, parent, owner_slug, repo.name)
                # restore_repo extracts to parent/{repo.name}; rename to disk_path if needed
                extracted = Path(parent) / repo.name
                if extracted.exists() and not Path(repo.disk_path).exists():
                    extracted.rename(repo.disk_path)
                restored += 1
            else:
                logger.info(
                    "startup: no B2 backup found, re-initialising empty bare repo",
                    extra={"owner": owner_slug, "repo": repo.name, "disk_path": repo.disk_path},
                )
                await loop.run_in_executor(
                    None, _init_bare_repo, repo.disk_path, repo.default_branch, False
                )
                reinited += 1

        except Exception as exc:
            logger.error(
                "startup: failed to restore repo",
                extra={"repo_id": str(repo.id), "error": str(exc)},
            )

    logger.info(
        "startup: repo restore complete",
        extra={"restored": restored, "reinited": reinited, "skipped": skipped},
    )


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
    expose_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)

register_exception_handlers(app)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(repos.router, prefix=settings.API_V1_PREFIX)
app.include_router(issues.router, prefix=settings.API_V1_PREFIX)
app.include_router(pulls.router, prefix=settings.API_V1_PREFIX)
app.include_router(orgs.router, prefix=settings.API_V1_PREFIX)
app.include_router(startups.router, prefix=settings.API_V1_PREFIX)
app.include_router(messages.router, prefix=f"{settings.API_V1_PREFIX}/messages", tags=["messages"])
# Pages router: registered so /api/v1/pages/... static serving resolves correctly.
app.include_router(pages.router, prefix=settings.API_V1_PREFIX)
# Admin error log — superuser-only, exposes the in-memory error buffer
app.include_router(error_logs.router, prefix=settings.API_V1_PREFIX)
# Git transport routes are NOT under /api/v1 — they use the /git/ prefix
# that nginx routes separately (proxy_request_buffering off, long timeouts).
# The .git URL convention is a well-known client expectation that must not
# be nested under /api/v1.
app.include_router(git.router)
app.include_router(ws.router)


@app.get("/_debug/git-check", include_in_schema=False)
def _debug_git_check():
    import shutil
    import subprocess
    import os

    git_path = shutil.which("git")
    backend_path = "/usr/lib/git-core/git-http-backend"

    try:
        git_version = subprocess.run(
            ["git", "--version"], capture_output=True, text=True, timeout=5
        ).stdout.strip()
    except Exception as exc:
        git_version = f"ERROR: {exc}"

    return {
        "git_which": git_path,
        "git_version": git_version,
        "http_backend_exists": os.path.exists(backend_path),
        "http_backend_path": backend_path,
        "PATH_env": os.environ.get("PATH", ""),
    }


@app.get("/health", tags=["system"])
@app.get("/api/v1/health", tags=["system"])
async def health_check():
    """Liveness/readiness probe target for Docker/orchestrator healthchecks."""
    return {"status": "ok", "service": settings.PROJECT_NAME}
