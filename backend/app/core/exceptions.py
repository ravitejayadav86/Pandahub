"""
Domain-level exceptions and their FastAPI handlers.

DESIGN — Error envelope shape
==============================
Every error response FastAPI returns has the same structured envelope:

    {
      "error": {
        "code":       "REPOSITORY_NAME_TAKEN",   # stable machine-readable key
        "message":    "A repository named ... already exists.",
        "hint":       "Try a different name...", # optional, actionable suggestion
        "docs":       "https://pandahub.dev/...",# optional, link to docs
        "severity":   "warning",                 # debug|info|warning|error|critical
        "request_id": "da671c96-...",
        "timestamp":  "2026-08-26T06:39:22Z",
        "path":       "/api/v1/repos",
        "fields":     [{"field":"name","message":"Name already taken"}]
      }
    }

``code`` is a stable, machine-readable string the frontend can switch on
(e.g. show a specific UI for REPOSITORY_NAME_TAKEN) without parsing the
human-readable ``message``, which is free to change wording.

``hint`` is the UX secret weapon: it tells the user what to DO, not just
what went wrong. "Repository already exists" is unhelpful; "Try deleting
the existing repository or picking a different name" is actionable.

``fields`` carries per-field validation errors so the frontend can
highlight individual form inputs rather than showing a wall of text.
"""
from __future__ import annotations

import traceback
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger, request_id_ctx, log_error_event

logger = get_logger("app.errors")


# ---------------------------------------------------------------------------
# Error severity levels (mirrors syslog convention)
# ---------------------------------------------------------------------------

class Severity:
    DEBUG    = "debug"
    INFO     = "info"
    WARNING  = "warning"
    ERROR    = "error"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Base AppError and domain subclasses
# ---------------------------------------------------------------------------

class AppError(Exception):
    """
    Base class for all PandaHub domain errors.

    Subclass this — never raise AppError directly — so ``code`` always
    reflects something semantically specific (NOT_FOUND, CONFLICT, …) and
    the frontend can branch on the code without parsing the message string.
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "APP_ERROR"
    severity: str = Severity.ERROR
    hint: Optional[str] = None
    docs: Optional[str] = None

    def __init__(
        self,
        message: str,
        *,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        hint: Optional[str] = None,
        docs: Optional[str] = None,
        fields: Optional[list[dict]] = None,
        severity: Optional[str] = None,
    ):
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        if hint:
            self.hint = hint
        if docs:
            self.docs = docs
        self.fields: list[dict] = fields or []
        if severity:
            self.severity = severity
        super().__init__(message)


# ── 404 Not Found ─────────────────────────────────────────────────────────

class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"
    severity = Severity.WARNING


# ── 409 Conflict ──────────────────────────────────────────────────────────

class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"
    severity = Severity.WARNING


# ── 403 Permission Denied ─────────────────────────────────────────────────

class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "PERMISSION_DENIED"
    severity = Severity.WARNING
    hint = "Make sure you have the required role on this resource."


# ── 401 Unauthorized ──────────────────────────────────────────────────────

class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"
    severity = Severity.WARNING
    hint = "Log in or pass a valid Bearer token to access this resource."


# ── 429 Rate Limited ──────────────────────────────────────────────────────

class RateLimitError(AppError):
    """Raised when a caller exceeds an API rate limit."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "RATE_LIMITED"
    severity = Severity.WARNING

    def __init__(
        self,
        message: str = "Too many requests. Please slow down.",
        *,
        retry_after: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after  # seconds


# ── 503 Service Unavailable ───────────────────────────────────────────────

class ServiceUnavailableError(AppError):
    """Raised when an external dependency (DB, MinIO, Redis) is unreachable."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "SERVICE_UNAVAILABLE"
    severity = Severity.ERROR
    hint = "This is a temporary infrastructure issue. Please try again in a few seconds."


# ── 422 Git Operation Failed ──────────────────────────────────────────────

class GitOperationError(AppError):
    """Raised for git-layer failures (merge conflict, no commits, bad ref, …)."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "GIT_ERROR"
    severity = Severity.ERROR


# ── 422 Validation with field detail ─────────────────────────────────────

class ValidationDetailError(AppError):
    """
    Like a 422 validation error but raised from service code (not Pydantic).

    ``fields`` carries per-field error info that the frontend can map
    directly onto form inputs:

        fields=[{"field": "name", "message": "Repository name already taken"}]
    """

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "VALIDATION_ERROR"
    severity = Severity.WARNING


# ---------------------------------------------------------------------------
# Error envelope builder
# ---------------------------------------------------------------------------

def _error_envelope(
    code: str,
    message: str,
    *,
    hint: Optional[str] = None,
    docs: Optional[str] = None,
    severity: str = Severity.ERROR,
    fields: Optional[list[dict]] = None,
    path: Optional[str] = None,
    extra_headers: Optional[dict] = None,
) -> dict:
    payload: dict = {
        "code":       code,
        "message":    message,
        "severity":   severity,
        "request_id": request_id_ctx.get(),
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    }
    if hint:
        payload["hint"] = hint
    if docs:
        payload["docs"] = docs
    if path:
        payload["path"] = path
    if fields:
        payload["fields"] = fields
    return {"error": payload}


# ---------------------------------------------------------------------------
# User-friendly code → copy mapping
# (the source of truth for human messages; frontend can also use this map)
# ---------------------------------------------------------------------------

_USER_MESSAGES: dict[str, str] = {
    "UNAUTHORIZED":         "Your session has expired or is invalid. Please log in again.",
    "PERMISSION_DENIED":    "You don't have permission to perform this action.",
    "NOT_FOUND":            "The resource you requested could not be found.",
    "CONFLICT":             "This resource already exists or conflicts with an existing one.",
    "RATE_LIMITED":         "You're making too many requests. Please wait a moment before trying again.",
    "SERVICE_UNAVAILABLE":  "A backend service is temporarily unavailable. We're on it — please try again shortly.",
    "VALIDATION_ERROR":     "Some fields contain invalid values. Please check and correct them.",
    "GIT_ERROR":            "A git operation failed. Check your branch name and repository state.",
    "INTERNAL_SERVER_ERROR":"An unexpected error occurred on our side. The team has been notified.",
}


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

def register_exception_handlers(app: FastAPI) -> None:

    # ── Domain errors ────────────────────────────────────────────────────
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        path = str(request.url.path)

        # Log at appropriate level based on severity
        log_method = {
            Severity.DEBUG:    logger.debug,
            Severity.INFO:     logger.info,
            Severity.WARNING:  logger.warning,
            Severity.ERROR:    logger.error,
            Severity.CRITICAL: logger.critical,
        }.get(exc.severity, logger.error)

        log_method(
            "app error",
            extra={
                "error_code":   exc.code,
                "status_code":  exc.status_code,
                "path":         path,
                "message":      exc.message,
            },
        )

        # Record in the in-memory error log for the admin panel
        _record_error(
            code=exc.code,
            message=exc.message,
            path=path,
            severity=exc.severity,
            status_code=exc.status_code,
        )

        headers: dict = {}
        if isinstance(exc, RateLimitError) and exc.retry_after:
            headers["Retry-After"] = str(exc.retry_after)

        return JSONResponse(
            status_code=exc.status_code,
            headers=headers,
            content=_error_envelope(
                exc.code,
                exc.message,
                hint=exc.hint,
                docs=exc.docs,
                severity=exc.severity,
                fields=exc.fields or None,
                path=path,
            ),
        )

    # ── Pydantic / request validation ───────────────────────────────────
    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        path = str(request.url.path)

        # Build structured per-field error list
        fields: list[dict] = []
        messages: list[str] = []
        for err in exc.errors():
            loc = err.get("loc", ())
            # Skip the first "body" segment if present
            field_parts = [str(p) for p in loc if p != "body"]
            field = ".".join(field_parts) if field_parts else "request"
            msg = err.get("msg", "Invalid value")
            fields.append({"field": field, "message": msg})
            messages.append(f"{field}: {msg}")

        summary = "; ".join(messages) if messages else "Request validation failed"

        logger.warning(
            "validation error",
            extra={"path": path, "fields": fields, "error_count": len(fields)},
        )

        _record_error(
            code="VALIDATION_ERROR",
            message=summary,
            path=path,
            severity=Severity.WARNING,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_envelope(
                "VALIDATION_ERROR",
                summary,
                hint="Check the highlighted fields and correct the values.",
                severity=Severity.WARNING,
                fields=fields,
                path=path,
            ),
        )

    # ── Starlette / FastAPI HTTP exceptions ───────────────────────────
    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException):
        path = str(request.url.path)
        code = f"HTTP_{exc.status_code}"
        raw_message = str(exc.detail or "")
        # Use user-friendly copy when possible
        message = raw_message or _USER_MESSAGES.get(code, "An error occurred.")

        severity = (
            Severity.WARNING if exc.status_code < 500
            else Severity.ERROR
        )

        logger.warning(
            "http exception",
            extra={"status_code": exc.status_code, "path": path, "detail": raw_message},
        )

        _record_error(
            code=code,
            message=message,
            path=path,
            severity=severity,
            status_code=exc.status_code,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(code, message, severity=severity, path=path),
        )

    # ── Catch-all — unhandled 500s ───────────────────────────────────
    @app.exception_handler(Exception)
    async def handle_unhandled_exception(request: Request, exc: Exception):
        path = str(request.url.path)
        tb = traceback.format_exc()

        # Log the full traceback server-side — NEVER send it to the client
        # (stack traces reveal file paths, library versions, query structure)
        logger.exception(
            "unhandled exception",
            extra={
                "path": path,
                "exc_type": type(exc).__name__,
                "traceback": tb[:2000],  # truncate; full trace in server logs
            },
        )

        log_error_event(
            code="INTERNAL_SERVER_ERROR",
            message=f"{type(exc).__name__}: {exc!s}",
            path=path,
            traceback=tb,
        )

        _record_error(
            code="INTERNAL_SERVER_ERROR",
            message=f"Unhandled {type(exc).__name__}",
            path=path,
            severity=Severity.CRITICAL,
            status_code=500,
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_envelope(
                "INTERNAL_SERVER_ERROR",
                _USER_MESSAGES["INTERNAL_SERVER_ERROR"],
                hint="If this keeps happening, use the Request ID to report it.",
                severity=Severity.CRITICAL,
                path=path,
            ),
        )


# ---------------------------------------------------------------------------
# In-memory circular error buffer (for admin panel)
# ---------------------------------------------------------------------------
# Stores the last MAX_ERROR_RECORDS error events.  One list per process.
# Replace with a Redis list for multi-process / multi-dyno deployments.

import threading
import uuid as _uuid
from collections import deque

_MAX_ERROR_RECORDS = 500
_error_log_lock = threading.Lock()
_error_log: deque[dict] = deque(maxlen=_MAX_ERROR_RECORDS)


def _record_error(
    *,
    code: str,
    message: str,
    path: str,
    severity: str,
    status_code: int,
) -> None:
    """Add one error record to the in-process circular buffer."""
    record = {
        "id":           str(_uuid.uuid4()),
        "code":         code,
        "message":      message,
        "path":         path,
        "severity":     severity,
        "status_code":  status_code,
        "request_id":   request_id_ctx.get(),
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    }
    with _error_log_lock:
        _error_log.appendleft(record)


def get_error_log(limit: int = 100, offset: int = 0) -> list[dict]:
    """Return a paginated slice of the in-memory error log (newest first)."""
    with _error_log_lock:
        items = list(_error_log)
    return items[offset : offset + limit]


def get_error_stats() -> list[dict]:
    """Return per-code counts and last_seen timestamps."""
    from collections import defaultdict
    counts: dict[str, dict] = defaultdict(lambda: {"count": 0, "last_seen": None, "severity": "error"})
    with _error_log_lock:
        snapshot = list(_error_log)
    for record in snapshot:
        c = record["code"]
        counts[c]["count"] += 1
        counts[c]["severity"] = record["severity"]
        if counts[c]["last_seen"] is None or record["timestamp"] > counts[c]["last_seen"]:
            counts[c]["last_seen"] = record["timestamp"]
    return [{"code": k, **v} for k, v in sorted(counts.items(), key=lambda x: -x[1]["count"])]


def clear_error_log() -> None:
    """Clear all records (admin action)."""
    with _error_log_lock:
        _error_log.clear()


def remove_error_record(record_id: str) -> bool:
    """Remove a single record by ID. Returns True if found and removed."""
    with _error_log_lock:
        for i, r in enumerate(_error_log):
            if r["id"] == record_id:
                del _error_log[i]  # type: ignore[attr-defined]
                return True
    return False
