"""
Request-scoped middleware: assigns a request ID and logs every request's
outcome (method, path, status, duration).

The request ID is returned in the `X-Request-ID` response header
specifically so a user reporting "I got an error" can hand support that
one value, and it's the same ID that appears in every server-side log
line for that request (see core/logging.py's contextvar).

Implementation note
-------------------
This is intentionally a **pure ASGI middleware** (not BaseHTTPMiddleware).

Starlette's ``BaseHTTPMiddleware`` has a known bug: when a route handler
raises an exception that propagates through ``call_next``, the exception
escapes *outside* ``ExceptionMiddleware`` and reaches ``ServerErrorMiddleware``
directly — BEFORE ``CORSMiddleware`` gets to add headers to the response.
The result is 500 error responses with no ``Access-Control-Allow-Origin``
header, causing the browser to block them as CORS violations even though
the CORS config is correct.

A pure ASGI middleware delegates exception handling entirely to the inner
application (ExceptionMiddleware → our handlers) and never re-raises, so
the exception → response conversion happens inside the CORS boundary.
"""
import time
import uuid
from typing import Callable

from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.datastructures import MutableHeaders

from app.core.logging import get_logger, request_id_ctx

logger = get_logger("app.request")


class RequestContextMiddleware:
    """Pure ASGI middleware that assigns a request ID and logs request metrics."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Honour an incoming X-Request-ID (e.g. from a load balancer) or
        # generate a fresh UUID so every request is uniquely traceable.
        headers = dict(scope.get("headers", []))
        incoming_id = headers.get(b"x-request-id", b"").decode("utf-8", errors="replace")
        req_id = incoming_id or str(uuid.uuid4())
        token = request_id_ctx.set(req_id)

        start = time.perf_counter()
        status_code = 500  # default if something goes wrong before send

        async def send_with_request_id(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                # Inject the request ID into the response headers.
                headers_mut = MutableHeaders(scope=message)
                headers_mut.append("X-Request-ID", req_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                "request failed (unhandled exception escaped middleware)",
                extra={
                    "method": scope.get("method", ""),
                    "path": scope.get("path", ""),
                    "duration_ms": duration_ms,
                },
            )
            raise
        else:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.info(
                "request completed",
                extra={
                    "method": scope.get("method", ""),
                    "path": scope.get("path", ""),
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
            )
        finally:
            request_id_ctx.reset(token)
