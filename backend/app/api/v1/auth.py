from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.schemas.user import LoginRequest, RefreshRequest, Token, UserCreate, UserRead
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DbDep):
    """Register a new user account."""
    user = await auth_service.register_user(db, data)
    return user


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, db: DbDep):
    """Authenticate and receive access + refresh tokens."""
    user = await auth_service.authenticate_user(db, data.username_or_email, data.password)
    return auth_service.issue_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh(data: RefreshRequest, db: DbDep):
    """Exchange a valid refresh token for a new access token."""
    return await auth_service.refresh_access_token(db, data.refresh_token)
