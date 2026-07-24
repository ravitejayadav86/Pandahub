"""
Pydantic I/O schemas for the Startup Hub API.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import StartupStage


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------

class StartupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(
        ...,
        min_length=1,
        max_length=255,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-safe unique identifier, e.g. 'my-startup'",
    )
    tagline: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=10000)
    logo_url: Optional[str] = Field(None, max_length=500)
    website_url: Optional[str] = Field(None, max_length=500)
    stage: StartupStage = StartupStage.IDEA


class StartupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    tagline: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=10000)
    logo_url: Optional[str] = Field(None, max_length=500)
    website_url: Optional[str] = Field(None, max_length=500)
    stage: Optional[StartupStage] = None


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

class StartupOut(BaseModel):
    """
    Startup representation returned by list and detail endpoints.

    ``member_count`` and ``open_roles_count`` are computed at query time
    so the frontend can display them without an extra round-trip.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    tagline: Optional[str]
    description: Optional[str]
    logo_url: Optional[str]
    website_url: Optional[str]
    stage: StartupStage
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    # Computed by the service layer — not columns on the ORM model
    member_count: int = 0
    open_roles_count: int = 0
