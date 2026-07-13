"""
User-facing Pydantic schemas.

Separate from the SQLAlchemy models on purpose (clean architecture: the API
contract and the persistence model are allowed to diverge). UserOut, for
instance, deliberately excludes hashed_password and two_factor_secret_encrypted
-- there is no `from_orm` shortcut that could accidentally leak them, because
they simply aren't fields on this schema.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserOut(BaseModel):
    """Public-safe user representation, returned by the API."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    full_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    location: str | None = None
    website_url: str | None = None
    is_verified: bool
    two_factor_enabled: bool
    created_at: datetime


class UserProfileUpdate(BaseModel):
    """All fields optional -- PATCH semantics, only provided fields are changed."""
    full_name: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=255)
    website_url: str | None = Field(default=None, max_length=500)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
