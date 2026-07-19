"""
Domain-level exceptions and their FastAPI handlers.

Every future module (repos, issues, PRs, ...) raises these instead of
`HTTPException` directly with ad-hoc detail strings -- that would mean 18
different modules each inventing their own error response shape. Instead,
every error response FastAPI returns has the same envelope:

    {"error": {"code": "NOT_FOUND", "message": "...", "request_id": "..."}}

`code` is a stable, machine-readable string the frontend can switch on
(e.g. show a specific UI for REPOSITORY_NAME_TAKEN) without parsing the
human-readable `message`, which is free to change wording without
breaking frontend logic.
"""
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger, request_id_ctx

logger = get_logger("app.errors")


class AppError(Exception):
    """Base class for all domain errors. Subclass this rather than raising
    AppError directly, so `code` always reflects something specific."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "APP_ERROR"

    def __init__(self, message: str, code: str | None = None, status_code: int | None = None):
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "PERMISSION_DENIED"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


def _error_envelope(code: str, message: str) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id_ctx.get(),
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=_error_envelope(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        # Pydantic's default validation error shape is verbose and nested;
        # flatten to "field: message" pairs, which is far easier for a
        # frontend form to map onto specific input fields.
        details = [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_envelope("VALIDATION_ERROR", "; ".join(details)),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException):
        # Covers FastAPI's own HTTPException (used throughout auth_service
        # via AuthError, which subclasses it) so even those get the same
        # envelope shape instead of FastAPI's default {"detail": "..."}.
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(f"HTTP_{exc.status_code}", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def handle_unhandled_exception(request: Request, exc: Exception):
        # Last-resort catch-all: log the full traceback server-side, but
        # NEVER leak exception details to the client -- that's an
        # information disclosure risk (stack traces can reveal file paths,
        # library versions, query structure).
        logger.exception("unhandled exception", extra={"path": request.url.path})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_envelope("INTERNAL_SERVER_ERROR", "An unexpected error occurred."),
        )
