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
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserOut(BaseModel):
    """Public-safe user representation, returned by the API."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    location: Optional[str] = None
    website_url: Optional[str] = None
    is_verified: bool
    two_factor_enabled: bool
    created_at: datetime

    # Education / onboarding
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    graduation_year: Optional[int] = None
    needs_onboarding: bool = False


class UserProfileUpdate(BaseModel):
    """All fields optional -- PATCH semantics, only provided fields are changed."""
    username: Optional[str] = Field(default=None, min_length=3, max_length=39)
    full_name: Optional[str] = Field(default=None, max_length=255)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=500)
    location: Optional[str] = Field(default=None, max_length=255)
    website_url: Optional[str] = Field(default=None, max_length=500)
    # Education fields
    institution: Optional[str] = Field(default=None, max_length=255)
    degree: Optional[str] = Field(default=None, max_length=100)
    field_of_study: Optional[str] = Field(default=None, max_length=255)
    graduation_year: Optional[int] = Field(default=None, ge=1950, le=2100)
    needs_onboarding: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
