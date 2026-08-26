"""
Admin error log API.

Exposes the in-memory circular error buffer (maintained by exceptions.py)
via REST endpoints accessible only to superusers.

Routes
------
  GET    /api/v1/admin/errors          Paginated recent errors (newest first)
  GET    /api/v1/admin/errors/stats    Per-code aggregated counts
  DELETE /api/v1/admin/errors          Clear all records
  DELETE /api/v1/admin/errors/{id}     Dismiss a single record

Security
--------
All routes require an authenticated superuser (``is_superuser=True`` on the
User model).  Regular admin users are NOT sufficient.

Pagination
----------
  ?limit=50&offset=0   (max limit: 200)

Filter params on GET /admin/errors
-----------------------------------
  ?code=NOT_FOUND          filter by error code
  ?severity=error          filter by severity level
  ?path=/api/v1/repos      filter by request path prefix
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user
from app.core.exceptions import (
    get_error_log,
    get_error_stats,
    clear_error_log,
    remove_error_record,
)
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/admin/errors", tags=["admin", "errors"])


# ---------------------------------------------------------------------------
# Superuser guard
# ---------------------------------------------------------------------------

async def require_superuser(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Dependency: only superusers may access admin error endpoints."""
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "",
    summary="List recent error records (superuser only)",
    response_model=dict,
)
async def list_errors(
    limit:    int           = Query(50,  ge=1, le=200),
    offset:   int           = Query(0,   ge=0),
    code:     Optional[str] = Query(None, description="Filter by error code"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    path:     Optional[str] = Query(None, description="Filter by path prefix"),
    _su: User = Depends(require_superuser),
) -> dict:
    """
    Return the most recent error records from the in-memory circular buffer.

    Records are ordered newest-first.  Filters are applied in-process
    (the buffer is small enough that this is instantaneous).
    """
    records = get_error_log(limit=1000, offset=0)  # fetch all, filter in Python

    if code:
        records = [r for r in records if r.get("code") == code]
    if severity:
        records = [r for r in records if r.get("severity") == severity]
    if path:
        records = [r for r in records if (r.get("path") or "").startswith(path)]

    total = len(records)
    page  = records[offset : offset + limit]

    return {
        "total":  total,
        "limit":  limit,
        "offset": offset,
        "items":  page,
    }


@router.get(
    "/stats",
    summary="Aggregated error counts by code (superuser only)",
    response_model=dict,
)
async def error_stats(
    _su: User = Depends(require_superuser),
) -> dict:
    """
    Return per-error-code counts and last_seen timestamps.

    Useful for a quick dashboard: "which error is happening most often?"
    """
    return {"stats": get_error_stats()}


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Clear all error records (superuser only)",
)
async def clear_errors(
    _su: User = Depends(require_superuser),
) -> None:
    """Wipe the in-memory error buffer. Irreversible within this process."""
    clear_error_log()


@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dismiss a single error record (superuser only)",
)
async def dismiss_error(
    record_id: str,
    _su: User = Depends(require_superuser),
) -> None:
    """Remove one error record from the buffer by its UUID."""
    removed = remove_error_record(record_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Error record '{record_id}' not found.",
        )
