"""
Authentication API routes.

Every route here delegates business logic to `auth_service` -- handlers
only translate between HTTP (request parsing, status codes) and the
service layer. This keeps the routes thin and testable independent of
FastAPI's request/response machinery.
"""
from fastapi import APIRouter, Depends, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user
from app.core.rate_limit import login_rate_limiter, register_rate_limiter, password_reset_rate_limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth_schema import (
    UserRegister,
    LoginRequest,
    TwoFactorLoginRequest,
    TokenPair,
    RefreshRequest,
    TwoFactorChallengeResponse,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorDisableRequest,
    EmailVerificationConfirm,
    ResendVerificationRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.schemas.user_schema import UserOut, UserProfileUpdate, ChangePasswordRequest
from app.services import auth_service
from app.services.storage_service import upload_avatar

router = APIRouter(prefix="/auth", tags=["authentication"])


# ---------------------------------------------------------------------------
# Registration & email verification
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limiter)],
)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register_user(db, payload)
    return user


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def verify_email(payload: EmailVerificationConfirm, db: AsyncSession = Depends(get_db)):
    await auth_service.verify_email(db, payload.token)


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def resend_verification(payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.resend_verification(db, payload.email)


# ---------------------------------------------------------------------------
# Login / logout / token refresh
# ---------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=TokenPair | TwoFactorChallengeResponse,
    dependencies=[Depends(login_rate_limiter)],
)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_password(db, payload.username_or_email, payload.password)

    if user.two_factor_enabled:
        challenge_token = auth_service.issue_two_factor_challenge(user)
        return TwoFactorChallengeResponse(challenge_token=challenge_token)

    access_token, refresh_token = await auth_service.issue_token_pair(db, user)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/login/2fa", response_model=TokenPair, dependencies=[Depends(login_rate_limiter)])
async def login_two_factor(payload: TwoFactorLoginRequest, db: AsyncSession = Depends(get_db)):
    user_id = auth_service.verify_two_factor_challenge(payload.challenge_token)

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not auth_service.verify_totp_for_login(user, payload.totp_code):
        raise auth_service.AuthError("Invalid authentication code", status.HTTP_400_BAD_REQUEST)

    access_token, refresh_token = await auth_service.issue_token_pair(db, user)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    access_token, refresh_token = await auth_service.rotate_refresh_token(db, payload.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.revoke_refresh_token(db, payload.refresh_token)


# ---------------------------------------------------------------------------
# Password reset & change
# ---------------------------------------------------------------------------
@router.post(
    "/password-reset/request",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(password_reset_rate_limiter)],
)
async def request_password_reset(payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.request_password_reset(db, payload.email)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def confirm_password_reset(payload: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    await auth_service.confirm_password_reset(db, payload.token, payload.new_password)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await auth_service.change_password(db, current_user, payload.current_password, payload.new_password)


# ---------------------------------------------------------------------------
# Two-factor authentication management
# ---------------------------------------------------------------------------
@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(current_user: User = Depends(get_current_active_user)):
    secret, uri = auth_service.generate_totp_setup(current_user)
    return TwoFactorSetupResponse(secret=secret, provisioning_uri=uri)


@router.post("/2fa/enable", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def enable_two_factor(
    payload: TwoFactorVerifyRequest,
    raw_secret: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # `raw_secret` is passed back from the /2fa/setup response by the client
    # (never stored server-side until this confirmation step succeeds --
    # see generate_totp_setup's docstring for why).
    await auth_service.enable_two_factor(db, current_user, raw_secret, payload.totp_code)


@router.post("/2fa/disable", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def disable_two_factor(
    payload: TwoFactorDisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await auth_service.disable_two_factor(db, current_user, payload.password, payload.totp_code)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserOut)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    avatar_url = await upload_avatar(current_user.id, file)
    current_user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# User repositories & activity feed
# ---------------------------------------------------------------------------

@router.get("/me/repos", summary="List authenticated user's repositories")
async def list_my_repos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = 30,
    offset: int = 0,
):
    """
    Return repositories owned by the authenticated user, most recently updated first.
    Includes public and private repos since the caller owns them all.
    """
    from sqlalchemy import select, desc
    from app.models.repo import Repository
    from app.schemas.repo_schema import RepositoryOut

    stmt = (
        select(Repository)
        .where(Repository.owner_user_id == current_user.id)
        .order_by(desc(Repository.updated_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    repos = result.scalars().all()
    out = []
    for repo in repos:
        repo_out = RepositoryOut.model_validate(repo)
        repo_out.owner_username = current_user.username
        out.append(repo_out)
    return out


@router.get("/me/activity", summary="Get authenticated user's recent activity feed")
async def get_my_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = 20,
):
    """
    Return a combined activity feed of recent pull requests and issues authored
    by the authenticated user.

    Each event has: ``id``, ``type``, ``title``, ``repo`` (owner/name),
    ``author`` (username), ``created_at`` (ISO-8601).
    """
    from sqlalchemy import select, desc
    from app.models.repo import Repository
    from app.models.pull_request import PullRequest
    from app.models.issue import Issue
    from app.models.enums import PullRequestState, IssueState

    events: list[dict] = []

    # Pull requests authored by user
    pr_stmt = (
        select(PullRequest.id, PullRequest.title, PullRequest.state,
               PullRequest.created_at, PullRequest.repository_id)
        .where(PullRequest.author_id == current_user.id)
        .order_by(desc(PullRequest.created_at))
        .limit(limit)
    )
    pr_rows = (await db.execute(pr_stmt)).fetchall()

    # Issues authored by user
    issue_stmt = (
        select(Issue.id, Issue.title, Issue.state,
               Issue.created_at, Issue.repository_id)
        .where(Issue.author_id == current_user.id)
        .order_by(desc(Issue.created_at))
        .limit(limit)
    )
    issue_rows = (await db.execute(issue_stmt)).fetchall()

    # Resolve repo names once
    repo_ids = {row.repository_id for row in list(pr_rows) + list(issue_rows)}
    repo_map: dict = {}
    if repo_ids:
        r_stmt = select(Repository.id, Repository.name).where(Repository.id.in_(repo_ids))
        for row in (await db.execute(r_stmt)).fetchall():
            repo_map[row.id] = f"{current_user.username}/{row.name}"

    for pr in pr_rows:
        event_type = "pr_merged" if pr.state == PullRequestState.MERGED else "pr_opened"
        events.append({
            "id": str(pr.id),
            "type": event_type,
            "title": pr.title,
            "repo": repo_map.get(pr.repository_id, "?/?"),
            "author": current_user.username,
            "created_at": pr.created_at.isoformat() if pr.created_at else None,
        })

    for issue in issue_rows:
        event_type = "issue_closed" if issue.state == IssueState.CLOSED else "issue_opened"
        events.append({
            "id": str(issue.id),
            "type": event_type,
            "title": issue.title,
            "repo": repo_map.get(issue.repository_id, "?/?"),
            "author": current_user.username,
            "created_at": issue.created_at.isoformat() if issue.created_at else None,
        })

    # Sort combined events newest-first and cap at limit
    events.sort(key=lambda e: e["created_at"] or "", reverse=True)
    return events[:limit]


# ---------------------------------------------------------------------------
# Public user profile
# ---------------------------------------------------------------------------

@router.get("/users/{username}", summary="Get public user profile")
async def get_user_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Return a public profile for the given username including repo count.

    ``follower_count`` and ``following_count`` are stubbed at 0 until the
    social-graph feature is implemented.
    """
    from sqlalchemy import select, func
    from app.models.repo import Repository
    from app.models.enums import RepositoryVisibility
    from app.core.exceptions import NotFoundError

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User '{username}' not found.")

    repo_count_result = await db.execute(
        select(func.count()).where(
            Repository.owner_user_id == user.id,
            Repository.visibility == RepositoryVisibility.PUBLIC,
        )
    )
    repo_count = repo_count_result.scalar_one()

    return {
        "id": str(user.id),
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "location": user.location,
        "website_url": user.website_url,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "repo_count": repo_count,
        "follower_count": 0,
        "following_count": 0,
    }


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------

@router.get("/google/login", summary="Initiate Google OAuth login")
async def google_login():
    from fastapi.responses import RedirectResponse
    from fastapi import HTTPException
    from app.core.config import get_settings
    settings = get_settings()
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    redirect_uri = "http://localhost:8000/api/v1/auth/google/callback"
    url = f"https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope=openid%20email%20profile&access_type=offline"
    return RedirectResponse(url)


@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    from fastapi import HTTPException
    from app.core.config import get_settings
    import httpx
    
    settings = get_settings()
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    client_secret = settings.GOOGLE_OAUTH_CLIENT_SECRET
    redirect_uri = "http://localhost:8000/api/v1/auth/google/callback"
    
    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange token with Google")
            
        tokens = token_response.json()
        access_token = tokens["access_token"]
        
        # Get user info
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")
            
        user_info = user_response.json()
        
    # Handle user login/creation
    user = await auth_service.handle_oauth_login(
        db=db,
        provider="google",
        provider_account_id=user_info["id"],
        email=user_info["email"],
        name=user_info.get("name"),
        avatar_url=user_info.get("picture")
    )
    
    # Generate our JWT tokens
    panda_access, panda_refresh = await auth_service.issue_token_pair(db, user)
    
    # Redirect to frontend callback page
    frontend_callback = f"http://localhost:3000/oauth/callback?access_token={panda_access}&refresh_token={panda_refresh}"
    return RedirectResponse(frontend_callback)
