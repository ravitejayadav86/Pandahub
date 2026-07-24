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
