"""
Authentication API routes.

Every route here delegates business logic to `auth_service` -- handlers
only translate between HTTP (request parsing, status codes) and the
service layer. This keeps the routes thin and testable independent of
FastAPI's request/response machinery.
"""
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
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
    PersonalAccessTokenCreate,
    PersonalAccessTokenCreateResponse,
    PersonalAccessTokenOut,
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
    from sqlalchemy import select as sa_select
    update_data = payload.model_dump(exclude_unset=True)

    # If username is being changed, verify it is unique.
    new_username = update_data.get("username")
    if new_username and new_username != current_user.username:
        existing = await db.execute(
            sa_select(User.id).where(User.username == new_username)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Username already taken")

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
    from app.models.user import UserFollow
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

    follower_count_result = await db.execute(
        select(func.count()).where(UserFollow.following_id == user.id)
    )
    follower_count = follower_count_result.scalar_one()

    following_count_result = await db.execute(
        select(func.count()).where(UserFollow.follower_id == user.id)
    )
    following_count = following_count_result.scalar_one()

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
        "public_key": user.public_key,
        "repo_count": repo_count,
        "follower_count": follower_count,
        "following_count": following_count,
    }


# ---------------------------------------------------------------------------
# Followers
# ---------------------------------------------------------------------------

@router.post("/users/{username}/follow", summary="Follow a user")
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from sqlalchemy import select
    from app.models.user import UserFollow
    from app.core.exceptions import NotFoundError, BadRequestError

    if username == current_user.username:
        raise BadRequestError("You cannot follow yourself.")

    result = await db.execute(select(User).where(User.username == username))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise NotFoundError("User not found.")

    # Check if already following
    follow_check = await db.execute(
        select(UserFollow).where(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == target_user.id
        )
    )
    if follow_check.scalar_one_or_none():
        return {"status": "ok", "message": "Already following."}

    new_follow = UserFollow(
        follower_id=current_user.id,
        following_id=target_user.id
    )
    db.add(new_follow)
    await db.commit()
    return {"status": "ok", "message": f"Successfully followed {username}."}

@router.delete("/users/{username}/follow", summary="Unfollow a user")
async def unfollow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from sqlalchemy import select
    from app.models.user import UserFollow
    from app.core.exceptions import NotFoundError

    result = await db.execute(select(User).where(User.username == username))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise NotFoundError("User not found.")

    follow_check = await db.execute(
        select(UserFollow).where(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == target_user.id
        )
    )
    follow_obj = follow_check.scalar_one_or_none()
    if follow_obj:
        await db.delete(follow_obj)
        await db.commit()
    
    return {"status": "ok", "message": f"Successfully unfollowed {username}."}

@router.get("/users/{username}/followers", summary="Get users following this user")
async def get_followers(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.user import UserFollow
    from app.core.exceptions import NotFoundError

    result = await db.execute(select(User).where(User.username == username))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise NotFoundError("User not found.")

    stmt = select(User).join(UserFollow, UserFollow.follower_id == User.id).where(UserFollow.following_id == target_user.id)
    followers_result = await db.execute(stmt)
    followers = followers_result.scalars().all()

    return [
        {
            "id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "bio": u.bio,
        }
        for u in followers
    ]

@router.get("/users/{username}/following", summary="Get users this user is following")
async def get_following(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.user import UserFollow
    from app.core.exceptions import NotFoundError

    result = await db.execute(select(User).where(User.username == username))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise NotFoundError("User not found.")

    stmt = select(User).join(UserFollow, UserFollow.following_id == User.id).where(UserFollow.follower_id == target_user.id)
    following_result = await db.execute(stmt)
    following = following_result.scalars().all()

    return [
        {
            "id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "bio": u.bio,
        }
        for u in following
    ]

# ---------------------------------------------------------------------------
# Users Search
# ---------------------------------------------------------------------------

@router.get("/users", summary="List and search users (admin)")
async def list_users(
    q: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from sqlalchemy import select, or_
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.username.ilike(search),
                User.email.ilike(search),
                User.full_name.ilike(search)
            )
        )
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "is_verified": u.is_verified,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]

@router.get("/explore/users", summary="Public user search")
async def explore_users(
    q: str | None = None,
    limit: int = 24,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, or_
    stmt = select(User).where(User.is_active == True).order_by(User.created_at.desc())
    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.username.ilike(search),
                User.full_name.ilike(search)
            )
        )
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    # Do not expose sensitive info like email here
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "bio": u.bio,
            "location": u.location,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]

# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------

@router.get("/google/login", summary="Initiate Google OAuth login")
async def google_login():
    from fastapi.responses import RedirectResponse
    from app.core.config import get_settings
    settings = get_settings()
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=select_account"  # always show account chooser
    )
    return RedirectResponse(url)


@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(code: str | None = None, error: str | None = None, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    from app.core.config import get_settings
    import httpx

    settings = get_settings()

    # User cancelled the Google OAuth flow or Google returned an error.
    if error or not code:
        frontend_error = f"{settings.FRONTEND_URL}/login?error=Google+login+cancelled"
        return RedirectResponse(frontend_error)

    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    client_secret = settings.GOOGLE_OAUTH_CLIENT_SECRET
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"

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
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail="Google did not return an access token")
        access_token = tokens["access_token"]

        # Get user info
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")

        user_info = user_response.json()

    # Handle user login/creation — returns (user, is_new_user)
    user, is_new_user = await auth_service.handle_oauth_login(
        db=db,
        provider="google",
        provider_account_id=user_info["id"],
        email=user_info["email"],
        name=user_info.get("name"),
        avatar_url=user_info.get("picture")
    )

    # Generate our JWT tokens
    panda_access, panda_refresh = await auth_service.issue_token_pair(db, user)

    # New users → onboarding page; returning users → dashboard via oauth callback
    if is_new_user:
        frontend_callback = (
            f"{settings.FRONTEND_URL}/oauth/callback"
            f"?access_token={panda_access}&refresh_token={panda_refresh}&onboarding=true"
        )
    else:
        frontend_callback = (
            f"{settings.FRONTEND_URL}/oauth/callback"
            f"?access_token={panda_access}&refresh_token={panda_refresh}"
        )
    return RedirectResponse(frontend_callback)


@router.get("/github/login", summary="Initiate GitHub OAuth login")
async def github_login():
    from fastapi.responses import RedirectResponse
    from app.core.config import get_settings
    settings = get_settings()
    client_id = settings.GITHUB_OAUTH_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/github/callback"
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope=user:email"
    return RedirectResponse(url)


@router.get("/github/callback", summary="GitHub OAuth callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    from app.core.config import get_settings
    import httpx

    settings = get_settings()
    client_id = settings.GITHUB_OAUTH_CLIENT_ID
    client_secret = settings.GITHUB_OAUTH_CLIENT_SECRET

    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"}
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange token with GitHub")

        tokens = token_response.json()
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail="Failed to get access token from GitHub")
        access_token = tokens["access_token"]

        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info from GitHub")

        user_info = user_response.json()

        # Get user email
        email_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if email_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user emails from GitHub")

        emails = email_response.json()
        primary_email = next((e["email"] for e in emails if e["primary"]), None)
        if not primary_email and emails:
            primary_email = emails[0]["email"]

        if not primary_email:
            raise HTTPException(status_code=400, detail="No email found on GitHub account")

    # Handle user login/creation — returns (user, is_new_user)
    user, is_new_user = await auth_service.handle_oauth_login(
        db=db,
        provider="github",
        provider_account_id=str(user_info["id"]),
        email=primary_email,
        name=user_info.get("name") or user_info.get("login"),
        avatar_url=user_info.get("avatar_url")
    )

    # Generate our JWT tokens
    panda_access, panda_refresh = await auth_service.issue_token_pair(db, user)

    # Redirect to frontend callback page
    frontend_callback = f"{settings.FRONTEND_URL}/oauth/callback?access_token={panda_access}&refresh_token={panda_refresh}"
    return RedirectResponse(frontend_callback)


# ---------------------------------------------------------------------------
# Personal Access Tokens (panda CLI, git-over-HTTPS -- see git_engine/auth.py)
# ---------------------------------------------------------------------------
@router.post("/tokens", response_model=PersonalAccessTokenCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: PersonalAccessTokenCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    pat, raw_token = await auth_service.create_personal_access_token(
        db, current_user, payload.name, payload.scopes, payload.expires_in_days
    )
    return PersonalAccessTokenCreateResponse(
        id=pat.id, name=pat.name, token=raw_token,
        scopes=pat.scopes, expires_at=pat.expires_at, created_at=pat.created_at,
    )

@router.get("/tokens", response_model=list[PersonalAccessTokenOut])
async def list_tokens(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await auth_service.list_personal_access_tokens(db, current_user)

@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(
    token_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await auth_service.revoke_personal_access_token(db, current_user, token_id)
