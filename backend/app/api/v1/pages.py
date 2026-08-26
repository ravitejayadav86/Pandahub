"""
PandaHub Pages REST router.

Route layout:
  POST   /api/v1/{owner}/{repo}/pages            Enable Pages
  GET    /api/v1/{owner}/{repo}/pages            Get Pages config + status
  PATCH  /api/v1/{owner}/{repo}/pages            Update source branch / folder
  DELETE /api/v1/{owner}/{repo}/pages            Disable Pages
  POST   /api/v1/{owner}/{repo}/pages/rebuild    Trigger manual rebuild
  GET    /api/v1/pages/{owner}/{repo}/{path}     Serve the static site

Permission model:
  - Enable / Update / Disable -> ADMIN
  - Rebuild -> WRITE
  - Get config -> READ (any authenticated user; config is not sensitive)
  - Serve -> public (no auth required; only serves from public repos)

The serving endpoint (GET /pages/...) is intentionally placed BEFORE the
/{owner}/{repo} group routes in main.py so it resolves first and doesn't
clash with repo-level wildcard paths.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_active_user,
    get_optional_current_user,
    get_repository,
    require_repo_permission,
)
from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.enums import PermissionLevel
from app.models.repo import Repository
from app.models.user import User
from app.schemas.repo_schema import PagesCreate, PagesOut, PagesUpdate
from app.services import pages_service

settings = get_settings()

router = APIRouter(tags=["pages"])


# ---------------------------------------------------------------------------
# Helper — build the public URL for a Pages site
# ---------------------------------------------------------------------------

def _pages_url(owner: str, repo_name: str) -> str:
    """Return the canonical public URL for a Pages site."""
    base = settings.BACKEND_URL.rstrip("/")
    return f"{base}/api/v1/pages/{owner}/{repo_name}/"


def _enrich(pages_out: PagesOut, owner: str, repo_name: str) -> PagesOut:
    """Attach the computed ``url`` field to a PagesOut response."""
    pages_out.url = _pages_url(owner, repo_name)
    return pages_out


# ---------------------------------------------------------------------------
# Enable Pages
# ---------------------------------------------------------------------------

@router.post(
    "/{owner}/{repo}/pages",
    response_model=PagesOut,
    status_code=status.HTTP_201_CREATED,
    summary="Enable PandaHub Pages for a repository",
    description=(
        "Enable static-site hosting for this repository. "
        "PandaHub will build and serve the site from the specified branch and folder. "
        "Requires ADMIN permission."
    ),
)
async def enable_pages(
    owner: str,
    payload: PagesCreate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> PagesOut:
    pages = await pages_service.enable_pages(
        db,
        repository,
        owner_username=owner,
        source_branch=payload.source_branch,
        source_folder=payload.source_folder,
    )
    out = PagesOut.model_validate(pages)
    return _enrich(out, owner, repository.name)


# ---------------------------------------------------------------------------
# Get Pages config
# ---------------------------------------------------------------------------

@router.get(
    "/{owner}/{repo}/pages",
    response_model=PagesOut,
    summary="Get Pages configuration and build status",
)
async def get_pages(
    owner: str,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    _user: Optional[User] = Depends(get_optional_current_user),
    _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
) -> PagesOut:
    pages = await pages_service.get_pages(db, repository.id)
    if pages is None:
        raise NotFoundError("Pages is not enabled for this repository.")
    out = PagesOut.model_validate(pages)
    return _enrich(out, owner, repository.name)


# ---------------------------------------------------------------------------
# Update Pages source branch / folder
# ---------------------------------------------------------------------------

@router.patch(
    "/{owner}/{repo}/pages",
    response_model=PagesOut,
    summary="Update Pages source branch or folder (triggers rebuild)",
)
async def update_pages(
    owner: str,
    payload: PagesUpdate,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> PagesOut:
    pages = await pages_service.update_pages(
        db,
        repository,
        owner_username=owner,
        source_branch=payload.source_branch,
        source_folder=payload.source_folder,
    )
    out = PagesOut.model_validate(pages)
    return _enrich(out, owner, repository.name)


# ---------------------------------------------------------------------------
# Disable Pages
# ---------------------------------------------------------------------------

@router.delete(
    "/{owner}/{repo}/pages",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Disable Pages and remove all published artifacts",
)
async def disable_pages(
    owner: str,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.ADMIN, allow_anonymous=False)
    ),
) -> None:
    await pages_service.disable_pages(db, repository, owner_username=owner)


# ---------------------------------------------------------------------------
# Manual rebuild
# ---------------------------------------------------------------------------

@router.post(
    "/{owner}/{repo}/pages/rebuild",
    response_model=PagesOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a manual Pages rebuild",
)
async def rebuild_pages(
    owner: str,
    repository: Repository = Depends(get_repository),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _perm: PermissionLevel = Depends(
        require_repo_permission(PermissionLevel.WRITE, allow_anonymous=False)
    ),
) -> PagesOut:
    pages = await pages_service.trigger_rebuild(db, repository, owner_username=owner)
    out = PagesOut.model_validate(pages)
    return _enrich(out, owner, repository.name)


# ---------------------------------------------------------------------------
# Serve static files (public — no auth required)
# ---------------------------------------------------------------------------

@router.get(
    "/pages/{owner}/{repo}/{path:path}",
    summary="Serve a PandaHub Pages static site",
    include_in_schema=True,
    tags=["pages"],
)
async def serve_pages(
    owner: str,
    repo: str,
    path: str,
    db: AsyncSession = Depends(get_db),
) -> FastAPIResponse:
    """
    Serve a file from the active PandaHub Pages build.

    Requests for directories (paths without a file extension) automatically
    return ``index.html`` from that directory, enabling SPA routing support.

    This endpoint requires no authentication — Pages sites are always public.
    """
    # ------------------------------------------------------------------
    # 1. Look up the repository (public repos only for Pages)
    # ------------------------------------------------------------------
    from app.services.repo_service import get_repo_by_owner_and_name  # noqa: PLC0415
    from app.models.enums import RepositoryVisibility  # noqa: PLC0415

    repository = await get_repo_by_owner_and_name(db, owner, repo)
    if repository is None:
        raise NotFoundError(f"Repository '{owner}/{repo}' not found.")

    if repository.visibility != RepositoryVisibility.PUBLIC:
        raise NotFoundError(f"Repository '{owner}/{repo}' not found.")  # Don't leak private

    # ------------------------------------------------------------------
    # 2. Get Pages config
    # ------------------------------------------------------------------
    pages = await pages_service.get_pages(db, repository.id)
    if pages is None or not pages.enabled:
        raise NotFoundError(f"Pages is not enabled for '{owner}/{repo}'.")

    if pages.status != "active" or not pages.published_sha:
        return FastAPIResponse(
            content=(
                f"<html><body style='font-family:sans-serif;text-align:center;padding:4rem'>"
                f"<h1>🐼 PandaHub Pages</h1>"
                f"<p>This site is currently <strong>{pages.status}</strong>. "
                f"Please check back in a moment.</p></body></html>"
            ),
            media_type="text/html",
            status_code=202,
        )

    # ------------------------------------------------------------------
    # 3. Fetch file from MinIO and stream back
    # ------------------------------------------------------------------
    try:
        file_bytes, content_type = await pages_service.serve_pages_file(
            owner=owner,
            repo_name=repo,
            file_path=path or "index.html",
            published_sha=pages.published_sha,
        )
    except NotFoundError:
        # Return a friendly 404 page instead of the JSON error envelope
        return FastAPIResponse(
            content=(
                "<html><body style='font-family:sans-serif;text-align:center;padding:4rem'>"
                "<h1>404 — Page Not Found</h1>"
                f"<p>The file <code>/{path}</code> does not exist in this Pages site.</p>"
                f"<p><a href='/api/v1/pages/{owner}/{repo}/'>← Back to home</a></p>"
                "</body></html>"
            ),
            media_type="text/html",
            status_code=404,
        )

    return FastAPIResponse(
        content=file_bytes,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",  # 5-min browser cache
            "X-Pages-Sha": pages.published_sha,
        },
    )
