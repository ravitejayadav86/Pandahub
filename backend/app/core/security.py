"""
Core security primitives, used by auth_service and API dependencies.

Three distinct cryptographic needs, deliberately kept separate:
1. Password hashing (one-way, bcrypt via passlib) - for user login credentials.
2. JWT signing (HMAC-SHA256) - for stateless access tokens.
3. Symmetric encryption (Fernet) - for secrets we must later DECRYPT
   (2FA TOTP secrets, OAuth provider tokens). Passwords never need decrypting,
   so they get a fundamentally different (hashing) treatment than these do.

Refresh tokens and PATs are neither hashed-for-comparison nor encrypted --
they're random high-entropy strings, and we store only a SHA-256 hash of
them (like a password), since we only ever need to check "does this
presented token match a stored hash", never decrypt it back to the original.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------
def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """`subject` is the user id (string). Kept short-lived (default 15 min)
    so a leaked access token has a small blast radius -- revocation for
    access tokens isn't possible (they're stateless), so short expiry is
    the primary mitigation."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Raises jose.JWTError on invalid/expired token -- caller (dependency)
    is responsible for converting that into an HTTP 401."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Not an access token")
    return payload


# ---------------------------------------------------------------------------
# Refresh tokens / Personal Access Tokens (opaque, hash-stored)
# ---------------------------------------------------------------------------
def generate_opaque_token() -> str:
    """High-entropy random token for refresh tokens and PATs. Not a JWT --
    opaque tokens can be revoked server-side by deleting/marking their hash
    row, unlike JWTs which remain valid until expiry no matter what."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """SHA-256, not bcrypt: these tokens are already high-entropy random
    strings (unlike user-chosen passwords), so they're not vulnerable to
    dictionary/rainbow-table attacks, and we need fast lookup-by-hash on
    every request -- bcrypt's deliberate slowness would hurt request latency
    for no security benefit here."""
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Symmetric encryption (2FA secrets, OAuth tokens at rest)
# ---------------------------------------------------------------------------
_fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_secret(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()
