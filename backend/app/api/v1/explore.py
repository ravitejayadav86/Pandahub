from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.repository import Repository, RepoVisibility
from app.models.user import User
from app.schemas.repository import RepoRead
from app.schemas.user import UserPublic

router = APIRouter(prefix="/explore", tags=["explore"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/repos", response_model=list[RepoRead])
async def explore_repos(
    db: DbDep,
    q: str | None = Query(None, description="Search query"),
    sort: str = Query("updated", description="Sort by: updated | stars | forks"),
    skip: int = 0,
    limit: int = 30,
):
    """List public repositories, optionally filtered by search query."""
    from app.models.repository import Repository
    from sqlalchemy import desc

    stmt = select(Repository).where(Repository.visibility == RepoVisibility.PUBLIC)

    if q:
        stmt = stmt.where(
            or_(
                Repository.name.ilike(f"%{q}%"),
                Repository.description.ilike(f"%{q}%"),
            )
        )

    sort_col = {
        "stars": Repository.star_count,
        "forks": Repository.fork_count,
        "updated": Repository.updated_at,
    }.get(sort, Repository.updated_at)

    stmt = stmt.order_by(desc(sort_col)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    repos = result.scalars().all()

    # Attach owner username
    for repo in repos:
        if repo.owner_id:
            user_res = await db.execute(select(User).where(User.id == repo.owner_id))
            u = user_res.scalar_one_or_none()
            repo.owner_username = u.username if u else None
    return repos


@router.get("/users", response_model=list[UserPublic])
async def explore_users(
    db: DbDep,
    q: str | None = Query(None),
    skip: int = 0,
    limit: int = 30,
):
    """Search public users by username or full name."""
    stmt = select(User).where(User.is_active == True)  # noqa: E712
    if q:
        stmt = stmt.where(
            or_(User.username.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%"))
        )
    stmt = stmt.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()
