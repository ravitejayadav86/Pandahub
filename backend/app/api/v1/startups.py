"""
Startup Hub REST router.

Route layout:
  GET    /startups              list all startups (filterable by stage, searchable)
  POST   /startups              create a new startup (auth required)
  GET    /startups/{slug}       get startup details by slug
  PATCH  /startups/{slug}       update startup (creator only)
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user, get_current_verified_user
from app.db.session import get_db
from app.models.enums import StartupStage
from app.models.user import User
from app.schemas.startup_schema import StartupCreate, StartupOut, StartupUpdate
from app.services import startup_service

router = APIRouter(prefix="/startups", tags=["startups"])


@router.get(
    "",
    response_model=list[StartupOut],
    summary="List all startups",
)
async def list_startups(
    db: AsyncSession = Depends(get_db),
    stage: Optional[StartupStage] = Query(None, description="Filter by startup stage"),
    q: Optional[str] = Query(None, description="Search by name or tagline"),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[StartupOut]:
    """
    Return a list of startups.

    - Optionally filter by ``stage`` (idea, mvp, early_traction, growth, scaling).
    - Optionally search by ``q`` (matches name and tagline).
    - Results are ordered by most recently created first.
    """
    return await startup_service.list_startups(db, stage=stage, q=q, limit=limit, offset=offset)


@router.post(
    "",
    response_model=StartupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a startup",
)
async def create_startup(
    payload: StartupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> StartupOut:
    """
    Create a new startup and make the authenticated user its founding member.
    The ``slug`` must be globally unique (e.g. ``my-awesome-startup``).
    """
    return await startup_service.create_startup(db, current_user, payload)


@router.get(
    "/{slug}",
    response_model=StartupOut,
    summary="Get startup by slug",
)
async def get_startup(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> StartupOut:
    """Return full details for a single startup by its URL slug."""
    return await startup_service.get_startup_by_slug(db, slug)


@router.patch(
    "/{slug}",
    response_model=StartupOut,
    summary="Update a startup",
)
async def update_startup(
    slug: str,
    payload: StartupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StartupOut:
    """Update startup metadata. Only the startup creator may call this endpoint."""
    return await startup_service.update_startup(db, slug, current_user, payload)
