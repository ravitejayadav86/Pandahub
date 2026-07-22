"""
Shared FastAPI dependencies.

`get_current_user` is the single place that turns a bearer token into a
`User` ORM object -- every protected route in every module (issues, PRs,
repos, admin panel) depends on this function, never re-implements token
parsing itself. This is what makes it possible to change the auth scheme
later (e.g. add session cookies alongside JWT) in one file.

`get_repository` and `require_repo_permission` are Module 7 additions.
They centralise the owner-slug → ORM-object lookup and permission-gating
so no individual route handler reimplements that logic.
"""
import uuid
from typing import Callable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.core.exceptions import NotFoundError, PermissionDeniedError, UnauthorizedError
from app.db.session import get_db
from app.models.enums import PermissionLevel
from app.models.organization import Organization
from app.models.repo import Repository
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


# ---------------------------------------------------------------------------
# Repository resolution (Module 7)
# ---------------------------------------------------------------------------

async def get_repository(
    owner: str,
    repo: str,
    db: AsyncSession = Depends(get_db),
) -> Repository:
    """
    Resolve ``/{owner}/{repo}`` path parameters to a ``Repository`` ORM object.

    The *owner* segment can be either a **username** (user-owned repos) or an
    **organization name** (org-owned repos).  We look up both in a single
    round-trip using a sub-select UNION rather than two sequential queries.

    Raises:
        NotFoundError: if the owner doesn't exist or the repo doesn't exist
            under that owner.  A 404 (rather than a 403) is returned even for
            private repos that do exist -- leaking "this private repo exists"
            is an information disclosure risk.
    """
    # 1. Resolve owner slug → (user_id | None, org_id | None)
    user_result = await db.execute(
        select(User.id).where(User.username == owner)
    )
    owner_user_id: Optional[uuid.UUID] = user_result.scalar_one_or_none()

    owner_org_id: Optional[uuid.UUID] = None
    if owner_user_id is None:
        org_result = await db.execute(
            select(Organization.id).where(Organization.name == owner)
        )
        owner_org_id = org_result.scalar_one_or_none()

    if owner_user_id is None and owner_org_id is None:
        raise NotFoundError(f"Owner '{owner}' not found.")

    # 2. Resolve repo name under that owner.
    if owner_user_id is not None:
        repo_result = await db.execute(
            select(Repository).where(
                Repository.owner_user_id == owner_user_id,
                Repository.name == repo,
            )
        )
    else:
        repo_result = await db.execute(
            select(Repository).where(
                Repository.owner_organization_id == owner_org_id,
                Repository.name == repo,
            )
        )

    repository = repo_result.scalar_one_or_none()
    if repository is None:
        raise NotFoundError(f"Repository '{owner}/{repo}' not found.")

    return repository


def require_repo_permission(
    minimum: PermissionLevel,
    allow_anonymous: bool = True,
) -> Callable:
    """
    Dependency factory that gates a route on a minimum permission level.

    Usage::

        @router.get("/{owner}/{repo}/branches")
        async def list_branches(
            repo: Repository = Depends(get_repository),
            user: User | None = Depends(get_optional_current_user),
            _perm: PermissionLevel = Depends(require_repo_permission(PermissionLevel.READ)),
        ): ...

    The resolved ``PermissionLevel`` is returned so the handler can branch on
    it (e.g. hide certain fields for non-admin viewers) without a second call
    to the resolver.

    Args:
        minimum:         Minimum acceptable permission level.
        allow_anonymous: When False, an anonymous caller gets a 401 instead
                         of a 403 (used for endpoints that make no sense
                         without a logged-in user, like starring a repo).
    """
    async def _check(
        repository: Repository = Depends(get_repository),
        user: Optional[User] = Depends(get_optional_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> PermissionLevel:
        # Deferred import avoids circular dependency at module load time.
        from app.permissions.resolver import resolve_permission, _meets_minimum

        user_id = user.id if user is not None else None

        if not allow_anonymous and user_id is None:
            raise UnauthorizedError(
                "Authentication required to perform this action."
            )

        resolved = await resolve_permission(db, user_id, repository)

        if not _meets_minimum(resolved, minimum):
            if user_id is None:
                raise UnauthorizedError(
                    "Authentication required to access this repository."
                )
            raise PermissionDeniedError(
                f"You do not have '{minimum.value}' permission on "
                f"'{repository.name}'."
            )

        return resolved  # type: ignore[return-value]

    return _check
