"""
Request-scoped middleware: assigns a request ID and logs every request's
outcome (method, path, status, duration).

The request ID is returned in the `X-Request-ID` response header
specifically so a user reporting "I got an error" can hand support that
one value, and it's the same ID that appears in every server-side log
line for that request (see core/logging.py's contextvar).
"""
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logging import get_logger, request_id_ctx

logger = get_logger("app.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        incoming_id = request.headers.get("X-Request-ID")
        req_id = incoming_id or str(uuid.uuid4())
        token = request_id_ctx.set(req_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                "request failed",
                extra={"method": request.method, "path": request.url.path, "duration_ms": duration_ms},
            )
            raise
        finally:
            request_id_ctx.reset(token)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-ID"] = req_id
        logger.info(
            "request completed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
