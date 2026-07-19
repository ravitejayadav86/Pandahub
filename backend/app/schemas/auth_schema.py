"""
Auth-flow request/response schemas.

Username validation lives here (regex + length), not just as a DB
constraint, so an invalid username is rejected with a clear 422 error at
the API boundary rather than surfacing as an opaque database
IntegrityError deep in the service layer.
"""
import re

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$")


class UserRegister(BaseModel):
    username: str = Field(min_length=1, max_length=39)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not USERNAME_PATTERN.match(v):
            raise ValueError(
                "Username must be alphanumeric with optional hyphens, "
                "cannot start/end with a hyphen, max 39 characters"
            )
        return v


class LoginRequest(BaseModel):
    # Accepts username OR email in the same field -- resolved in auth_service.
    username_or_email: str
    password: str


class TwoFactorLoginRequest(BaseModel):
    """Second step of login when the account has 2FA enabled. `challenge_token`
    is a short-lived, purpose-scoped token issued by the first login step --
    it proves password verification already succeeded, without yet granting
    full API access."""
    challenge_token: str
    totp_code: str = Field(min_length=6, max_length=6)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class TwoFactorChallengeResponse(BaseModel):
    """Returned instead of TokenPair when 2FA is required."""
    requires_2fa: bool = True
    challenge_token: str


class TwoFactorSetupResponse(BaseModel):
    secret: str          # shown once, for manual entry
    provisioning_uri: str  # otpauth:// URI, for QR code generation client-side


class TwoFactorVerifyRequest(BaseModel):
    totp_code: str = Field(min_length=6, max_length=6)


class TwoFactorDisableRequest(BaseModel):
    password: str
    totp_code: str = Field(min_length=6, max_length=6)


class EmailVerificationConfirm(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr
