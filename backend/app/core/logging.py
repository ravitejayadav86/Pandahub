"""
Structured logging configuration — enhanced with error fingerprinting
and a standardized log_error_event() helper.

Changes over v1:
  - ``trace_id_ctx`` ContextVar: a second ID for cross-service correlation
    (separate from ``request_id`` which is per HTTP request).
  - ``error_fingerprint()``: stable hash of (exc_type, file, line) so the
    same bug appearing 1 000 times groups to one fingerprint in a log
    aggregator. Saves hours of triage.
  - ``log_error_event()``: one standardized call-site for unhandled errors
    so every 500 log line has identical fields (exc_type, path, fingerprint,
    traceback_snippet), making grep/alerting on them reliable.
  - ``ContextFilter`` attached to the root handler: injects request_id /
    trace_id / user_id into EVERY log record emitted during a request, even
    from third-party libraries that don't know about our contextvars.
"""
import hashlib
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Optional

request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_ctx:    ContextVar[Optional[str]] = ContextVar("user_id",    default=None)
trace_id_ctx:   ContextVar[Optional[str]] = ContextVar("trace_id",   default=None)


# ---------------------------------------------------------------------------
# Error fingerprinting
# ---------------------------------------------------------------------------

def error_fingerprint(exc_type: str, filename: str, lineno: int) -> str:
    """
    Return a short, stable hex fingerprint for a specific error location.

    Two occurrences of the same exception at the same file+line produce the
    same fingerprint, so you can alert "fingerprint X occurred 100x in 1 min"
    rather than 100 separate alerts with slightly different messages.

    Uses first 12 chars of SHA-256 — short enough to read, long enough to
    avoid collisions across a codebase.
    """
    raw = f"{exc_type}:{filename}:{lineno}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Structured log_error_event()
# ---------------------------------------------------------------------------

def log_error_event(
    *,
    code: str,
    message: str,
    path: str,
    traceback: str = "",
    exc_type: str = "",
    filename: str = "",
    lineno: int = 0,
) -> None:
    """
    Emit a single structured ERROR log line with all fields an on-call
    engineer needs to triage the problem without opening a second tool.

    Call this from the catch-all exception handler (exceptions.py) or
    any service layer that catches and handles an unexpected exception.
    """
    logger = logging.getLogger("app.errors")
    fingerprint = error_fingerprint(exc_type or code, filename or path, lineno)
    logger.error(
        "error_event",
        extra={
            "error_code":        code,
            "error_message":     message,
            "path":              path,
            "exc_type":          exc_type,
            "fingerprint":       fingerprint,
            "traceback_snippet": traceback[:500] if traceback else "",
        },
    )


# ---------------------------------------------------------------------------
# JSON log formatter
# ---------------------------------------------------------------------------

class JSONFormatter(logging.Formatter):
    """
    Emits each log record as a single JSON line.

    All ContextVar values (request_id, trace_id, user_id) are injected
    into every record automatically — no need for callers to pass them.
    Extra fields passed via ``logger.info("msg", extra={...})`` are
    promoted to top-level JSON keys for easy aggregator indexing.
    """

    # Standard LogRecord attributes we never want to re-emit as extra keys
    _SKIP_ATTRS = frozenset({
        "args", "msg", "exc_info", "exc_text", "stack_info",
        "levelno", "levelname", "created", "msecs", "relativeCreated",
        "funcName", "filename", "pathname", "lineno", "module",
        "name", "process", "processName", "thread", "threadName",
        "taskName",  # Python 3.12+
    })

    def format(self, record: logging.LogRecord) -> str:
        import json  # noqa: PLC0415

        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "logger":    record.name,
            "message":   record.getMessage(),
        }

        # Inject request-scoped context
        if (rid := request_id_ctx.get()):
            payload["request_id"] = rid
        if (uid := user_id_ctx.get()):
            payload["user_id"] = uid
        if (tid := trace_id_ctx.get()):
            payload["trace_id"] = tid

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # Promote extra fields to top-level JSON keys
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in payload or key in self._SKIP_ATTRS:
                continue
            if key in logging.LogRecord.__dict__:
                continue
            payload[key] = value

        return json.dumps(payload, default=str)


# ---------------------------------------------------------------------------
# Context filter — injects contextvars into third-party log records
# ---------------------------------------------------------------------------

class ContextFilter(logging.Filter):
    """
    Injects the three ContextVar values into every LogRecord, even those
    emitted by third-party libraries (sqlalchemy, httpx, uvicorn) that
    don't know about our context.  Without this, only our own logger.*()
    calls carry the request_id; third-party logs during the same request
    are orphaned and unrelatable.
    """

    def filter(self, record: logging.LogRecord) -> bool:  # type: ignore[override]
        record.request_id = request_id_ctx.get()  # type: ignore[attr-defined]
        record.user_id    = user_id_ctx.get()     # type: ignore[attr-defined]
        record.trace_id   = trace_id_ctx.get()    # type: ignore[attr-defined]
        return True


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

def configure_logging(level: str = "INFO") -> None:
    """
    Configure the root logger.

    Call once at startup (main.py) — never from individual modules.
    Individual modules should call ``get_logger(__name__)``; the root
    handler installed here takes care of formatting and output.
    """
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    handler.addFilter(ContextFilter())
    root.addHandler(handler)

    # Quiet down noisy third-party loggers that produce nothing actionable
    # at DEBUG level (SQLAlchemy echo already covers query logging).
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("pygit2").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger.  Formatting is handled by the root handler."""
    return logging.getLogger(name)
