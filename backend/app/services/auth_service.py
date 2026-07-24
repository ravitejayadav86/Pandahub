"""
Authentication business logic.

This is the ONLY layer that talks to `users`, `refresh_tokens`,
`email_verification_tokens`, and `password_reset_tokens` for auth purposes --
API route handlers (api/v1/auth.py) call into these functions and never
touch SQLAlchemy sessions for auth logic directly. Keeping this boundary
strict is what makes it possible to later expose the same logic through
the CLI's `panda login` without duplicating a single rule.

Refresh token rotation & reuse detection:
Each refresh token has a `family_id` implicitly tracked via a chain --
in this schema we approximate it by revoking ALL of a user's refresh
tokens the moment a revoked-or-unknown token is presented, which is a
simpler (if slightly blunter) version of full token-family tracking, and
sufficient for now. A dedicated `token_family_id` column can be added
later without a breaking migration if finer-grained revocation is needed.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pyotp
from fastapi import HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_opaque_token,
    hash_token,
    encrypt_secret,
    decrypt_secret,
)
from app.models.user import User, RefreshToken, EmailVerificationToken, PasswordResetToken
from app.schemas.auth_schema import UserRegister
from app.worker.tasks.email_tasks import send_verification_email_task, send_password_reset_email_task

settings = get_settings()

REFRESH_TOKEN_TTL = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)
TWO_FA_CHALLENGE_TTL_MINUTES = 5


class AuthError(HTTPException):
    """Thin wrapper so route handlers can catch a single exception type
    for all auth failures without inspecting status codes manually."""
    def __init__(self, detail: str, status_code: int = status.HTTP_401_UNAUTHORIZED):
        super().__init__(status_code=status_code, detail=detail)


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
async def register_user(db: AsyncSession, payload: UserRegister) -> User:
    existing = await db.execute(
        select(User).where((User.username == payload.username) | (User.email == payload.email))
    )
    if existing.scalar_one_or_none() is not None:
        raise AuthError("Username or email already registered", status.HTTP_409_CONFLICT)

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    await db.flush()  # populate user.id without committing yet

    await _issue_email_verification_token(db, user)
    await db.commit()
    await db.refresh(user)
    return user


async def _issue_email_verification_token(db: AsyncSession, user: User) -> None:
    raw_token = generate_opaque_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + EMAIL_VERIFICATION_TTL,
        )
    )
    # Enqueued via Celery, not awaited inline -- registration must return
    # immediately regardless of SMTP latency/availability (this was a
    # known shortcut in Module 4; fixed here in Module 5's Celery wiring).
    send_verification_email_task.delay(user.email, user.username, raw_token)


async def verify_email(db: AsyncSession, token: str) -> None:
    token_hash = hash_token(token)
    result = await db.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()
    if record is None or record.expires_at < datetime.now(timezone.utc):
        raise AuthError("Invalid or expired verification token", status.HTTP_400_BAD_REQUEST)

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one()
    user.is_verified = True
    await db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    await db.commit()


async def resend_verification(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    # Deliberately no error if the email doesn't exist -- prevents using this
    # endpoint to enumerate registered email addresses.
    if user is None or user.is_verified:
        return
    await db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    await _issue_email_verification_token(db, user)
    await db.commit()


# ---------------------------------------------------------------------------
# Login (password step)
# ---------------------------------------------------------------------------
async def authenticate_password(db: AsyncSession, username_or_email: str, password: str) -> User:
    result = await db.execute(
        select(User).where(
            (User.username == username_or_email) | (User.email == username_or_email)
        )
    )
    user = result.scalar_one_or_none()
    # Constant-shape response whether the user exists or the password is
    # wrong -- avoids leaking which one was incorrect (user enumeration).
    if user is None or user.hashed_password is None or not verify_password(password, user.hashed_password):
        raise AuthError("Incorrect username/email or password")
    if not user.is_active:
        raise AuthError("Account is disabled", status.HTTP_403_FORBIDDEN)
    return user


def issue_two_factor_challenge(user: User) -> str:
    """Short-lived token proving password verification succeeded, without
    granting API access -- exchanged for real tokens only after a valid
    TOTP code is presented."""
    return create_access_token(
        subject=str(user.id),
        extra_claims={"type": "access", "purpose": "2fa_challenge"},
    )


def verify_two_factor_challenge(challenge_token: str) -> uuid.UUID:
    try:
        payload = decode_access_token(challenge_token)
    except Exception:
        raise AuthError("Invalid or expired 2FA challenge", status.HTTP_400_BAD_REQUEST)
    if payload.get("purpose") != "2fa_challenge":
        raise AuthError("Invalid challenge token", status.HTTP_400_BAD_REQUEST)
    return uuid.UUID(payload["sub"])


# ---------------------------------------------------------------------------
# Token issuance / rotation / revocation
# ---------------------------------------------------------------------------
async def issue_token_pair(db: AsyncSession, user: User, device_info: str | None = None) -> tuple[str, str]:
    access_token = create_access_token(subject=str(user.id))

    raw_refresh = generate_opaque_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            device_info=device_info,
            expires_at=datetime.now(timezone.utc) + REFRESH_TOKEN_TTL,
        )
    )
    await db.commit()
    return access_token, raw_refresh


async def rotate_refresh_token(db: AsyncSession, raw_refresh_token: str) -> tuple[str, str]:
    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    record = result.scalar_one_or_none()

    if record is None:
        # Unknown token presented -- either garbage or (more concerning) a
        # token from a family that was already rotated/revoked elsewhere.
        raise AuthError("Invalid refresh token")

    if record.revoked or record.expires_at < datetime.now(timezone.utc):
        # Reuse of an already-rotated (revoked) token is the classic signal
        # of a stolen refresh token -- respond by revoking every refresh
        # token this user holds, forcing re-login everywhere.
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == record.user_id))
        await db.commit()
        raise AuthError("Refresh token reuse detected -- all sessions revoked", status.HTTP_401_UNAUTHORIZED)

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthError("Account no longer active")

    record.revoked = True
    new_access, new_refresh = await issue_token_pair(db, user, device_info=record.device_info)
    return new_access, new_refresh


async def revoke_refresh_token(db: AsyncSession, raw_refresh_token: str) -> None:
    token_hash = hash_token(raw_refresh_token)
    await db.execute(
        delete(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------
async def request_password_reset(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return  # no enumeration signal

    raw_token = generate_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + PASSWORD_RESET_TTL,
        )
    )
    await db.commit()
    send_password_reset_email_task.delay(user.email, user.username, raw_token)


async def confirm_password_reset(db: AsyncSession, token: str, new_password: str) -> None:
    token_hash = hash_token(token)
    result = await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    record = result.scalar_one_or_none()

    if record is None or record.used or record.expires_at < datetime.now(timezone.utc):
        raise AuthError("Invalid or expired reset token", status.HTTP_400_BAD_REQUEST)

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one()
    user.hashed_password = hash_password(new_password)
    record.used = True

    # Password reset invalidates all existing sessions -- if an attacker
    # had a stolen refresh token, this locks them out too.
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    if user.hashed_password is None or not verify_password(current_password, user.hashed_password):
        raise AuthError("Current password is incorrect", status.HTTP_400_BAD_REQUEST)
    user.hashed_password = hash_password(new_password)
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()


# ---------------------------------------------------------------------------
# Two-Factor Authentication (TOTP)
# ---------------------------------------------------------------------------
def generate_totp_setup(user: User) -> tuple[str, str]:
    """Returns (raw_secret, provisioning_uri). The secret is NOT persisted
    here -- it's only committed to the DB (encrypted) once the user proves
    they've correctly configured their authenticator app, in
    `enable_two_factor`. This avoids leaving a half-configured, unusable
    2FA secret on the account if the user never completes setup."""
    secret = pyotp.random_base32()
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="PandaHub")
    return secret, uri


async def enable_two_factor(db: AsyncSession, user: User, raw_secret: str, totp_code: str) -> None:
    totp = pyotp.TOTP(raw_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise AuthError("Invalid authentication code", status.HTTP_400_BAD_REQUEST)

    user.two_factor_secret_encrypted = encrypt_secret(raw_secret)
    user.two_factor_enabled = True
    await db.commit()


async def disable_two_factor(db: AsyncSession, user: User, password: str, totp_code: str) -> None:
    if user.hashed_password is None or not verify_password(password, user.hashed_password):
        raise AuthError("Incorrect password", status.HTTP_400_BAD_REQUEST)
    if not user.two_factor_enabled or user.two_factor_secret_encrypted is None:
        raise AuthError("Two-factor authentication is not enabled", status.HTTP_400_BAD_REQUEST)

    secret = decrypt_secret(user.two_factor_secret_encrypted)
    if not pyotp.TOTP(secret).verify(totp_code, valid_window=1):
        raise AuthError("Invalid authentication code", status.HTTP_400_BAD_REQUEST)

    user.two_factor_secret_encrypted = None
    user.two_factor_enabled = False
    await db.commit()


def verify_totp_for_login(user: User, totp_code: str) -> bool:
    if not user.two_factor_enabled or user.two_factor_secret_encrypted is None:
        return False
    secret = decrypt_secret(user.two_factor_secret_encrypted)
    return pyotp.TOTP(secret).verify(totp_code, valid_window=1)


# ---------------------------------------------------------------------------
# OAuth (Google / GitHub)
# ---------------------------------------------------------------------------
async def handle_oauth_login(
    db: AsyncSession,
    provider: str,
    provider_account_id: str,
    email: str,
    name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    from app.models.user import OAuthAccount
    from app.models.enums import OAuthProvider
    
    # 1. Check if OAuth account exists
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_account_id == provider_account_id
        )
    )
    oauth_account = result.scalar_one_or_none()
    
    if oauth_account:
        # Existing linked account
        user_result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = user_result.scalar_one()
        return user
        
    # 2. Check if user with this email already exists (linking)
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    
    if not user:
        # 3. Create new user
        # Generate a unique username derived from email or name
        base_username = (email.split("@")[0] if email else "user").lower()
        import re
        base_username = re.sub(r'[^a-z0-9]', '', base_username)
        if not base_username:
            base_username = "oauthuser"
            
        username = base_username
        
        # Ensure uniqueness
        while True:
            existing_u = await db.execute(select(User.id).where(User.username == username))
            if not existing_u.scalar_one_or_none():
                break
            import random
            username = f"{base_username}{random.randint(100, 9999)}"
            
        user = User(
            username=username,
            email=email,
            full_name=name,
            avatar_url=avatar_url,
            is_verified=True,  # OAuth emails are inherently verified by the provider
            hashed_password=None, # OAuth only
        )
        db.add(user)
        await db.flush()
        
    # Link OAuth account to the user
    new_oauth = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_account_id=provider_account_id,
    )
    db.add(new_oauth)
    await db.commit()
    await db.refresh(user)
    return user
