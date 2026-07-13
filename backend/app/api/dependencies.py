"""
Shared FastAPI dependencies.

`get_current_user` is the single place that turns a bearer token into a
`User` ORM object -- every protected route in every module (issues, PRs,
repos, admin panel) depends on this function, never re-implements token
parsing itself. This is what makes it possible to change the auth scheme
later (e.g. add session cookies alongside JWT) in one file.
"""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

# tokenUrl is documentation-only (used by the OpenAPI/Swagger "Authorize"
# button) -- our actual login endpoint returns a token pair in the response
# body, not via this OAuth2 form flow, but FastAPI needs *a* URL to display.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_error

    try:
        payload = decode_access_token(token)
        # Reject 2FA-challenge tokens here explicitly -- they're valid JWTs
        # but scoped to a single purpose and must never grant general access.
        if payload.get("purpose") == "2fa_challenge":
            raise credentials_error
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_error

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_error
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


async def get_current_verified_user(user: User = Depends(get_current_active_user)) -> User:
    """Use this dependency on actions that require a confirmed email
    (creating repos, opening issues) -- registration alone is not enough."""
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required",
        )
    return user


async def get_optional_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """For endpoints that behave differently for logged-in vs anonymous
    users (e.g. showing a 'Star' button state) without requiring auth."""
    if token is None:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None
