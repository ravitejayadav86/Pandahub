from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.repository import RepoRead
from app.schemas.user import UserPublic, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/me", response_model=UserRead)
async def get_me(current_user: CurrentUser):
    """Return the authenticated user's full profile."""
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_me(data: UserUpdate, current_user: CurrentUser, db: DbDep):
    """Update the authenticated user's profile fields."""
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.add(current_user)
    return current_user


@router.get("/{username}", response_model=UserPublic)
async def get_user(username: str, db: DbDep):
    """Fetch a public user profile by username."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/{username}/repos", response_model=list[RepoRead])
async def get_user_repos(username: str, db: DbDep, skip: int = 0, limit: int = 30):
    """List public repositories for a given user."""
    from app.models.repository import Repository, RepoVisibility

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    repos_result = await db.execute(
        select(Repository)
        .where(
            Repository.owner_id == user.id,
            Repository.visibility == RepoVisibility.PUBLIC,
        )
        .offset(skip)
        .limit(limit)
    )
    repos = repos_result.scalars().all()
    # Attach owner_username for schema
    for repo in repos:
        repo.owner_username = user.username
    return repos
