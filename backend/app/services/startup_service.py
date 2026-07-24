"""
Startup Hub service layer.

Handles all DB interactions for startups so the API router stays thin.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.startup import Startup, StartupMember, StartupOpenRole
from app.models.enums import StartupStage
from app.models.user import User
from app.schemas.startup_schema import StartupCreate, StartupOut, StartupUpdate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _count_members(db: AsyncSession, startup_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).where(StartupMember.startup_id == startup_id)
    )
    return result.scalar_one()


async def _count_open_roles(db: AsyncSession, startup_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).where(
            StartupOpenRole.startup_id == startup_id,
            StartupOpenRole.is_filled == False,  # noqa: E712
        )
    )
    return result.scalar_one()


def _to_out(startup: Startup, member_count: int, open_roles_count: int) -> StartupOut:
    """Map an ORM Startup + computed counts to StartupOut."""
    data = {
        "id": startup.id,
        "name": startup.name,
        "slug": startup.slug,
        "tagline": startup.tagline,
        "description": startup.description,
        "logo_url": startup.logo_url,
        "website_url": startup.website_url,
        "stage": startup.stage,
        "created_by": startup.created_by,
        "created_at": startup.created_at,
        "updated_at": startup.updated_at,
        "member_count": member_count,
        "open_roles_count": open_roles_count,
    }
    return StartupOut.model_validate(data)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def list_startups(
    db: AsyncSession,
    *,
    stage: Optional[StartupStage] = None,
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[StartupOut]:
    """
    Return a list of startups with optional filtering.

    - ``stage``: filter by startup stage
    - ``q``: case-insensitive search on name and tagline
    - ``limit`` / ``offset``: pagination
    """
    stmt = select(Startup)

    if stage is not None:
        stmt = stmt.where(Startup.stage == stage)

    if q:
        pattern = f"%{q.lower()}%"
        from sqlalchemy import or_, func as sqlfunc
        stmt = stmt.where(
            or_(
                sqlfunc.lower(Startup.name).like(pattern),
                sqlfunc.lower(Startup.tagline).like(pattern),
            )
        )

    stmt = stmt.order_by(Startup.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    startups = result.scalars().all()

    out = []
    for s in startups:
        mc = await _count_members(db, s.id)
        rc = await _count_open_roles(db, s.id)
        out.append(_to_out(s, mc, rc))
    return out


async def get_startup_by_slug(db: AsyncSession, slug: str) -> StartupOut:
    """Return a single startup by its slug. Raises NotFoundError if missing."""
    result = await db.execute(select(Startup).where(Startup.slug == slug))
    startup = result.scalar_one_or_none()
    if startup is None:
        raise NotFoundError(f"Startup '{slug}' not found.")
    mc = await _count_members(db, startup.id)
    rc = await _count_open_roles(db, startup.id)
    return _to_out(startup, mc, rc)


async def create_startup(
    db: AsyncSession,
    current_user: User,
    payload: StartupCreate,
) -> StartupOut:
    """
    Create a new startup and add the creator as the first member (founder).

    Raises ConflictError if the slug is already taken.
    """
    # Check slug uniqueness
    existing = await db.execute(select(Startup.id).where(Startup.slug == payload.slug))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError(f"A startup with slug '{payload.slug}' already exists.")

    startup = Startup(
        name=payload.name,
        slug=payload.slug,
        tagline=payload.tagline,
        description=payload.description,
        logo_url=payload.logo_url,
        website_url=payload.website_url,
        stage=payload.stage,
        created_by=current_user.id,
    )
    db.add(startup)
    await db.flush()  # get the auto-generated id

    # Add creator as founding member
    member = StartupMember(
        startup_id=startup.id,
        user_id=current_user.id,
        title="Founder",
    )
    db.add(member)
    await db.commit()
    await db.refresh(startup)

    return _to_out(startup, member_count=1, open_roles_count=0)


async def update_startup(
    db: AsyncSession,
    slug: str,
    current_user: User,
    payload: StartupUpdate,
) -> StartupOut:
    """Update a startup. Only the creator may update it."""
    result = await db.execute(select(Startup).where(Startup.slug == slug))
    startup = result.scalar_one_or_none()
    if startup is None:
        raise NotFoundError(f"Startup '{slug}' not found.")
    if startup.created_by != current_user.id and not current_user.is_superuser:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("Only the startup creator may edit it.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(startup, field, value)

    await db.commit()
    await db.refresh(startup)
    mc = await _count_members(db, startup.id)
    rc = await _count_open_roles(db, startup.id)
    return _to_out(startup, mc, rc)
