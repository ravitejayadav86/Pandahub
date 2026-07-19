"""
Structured logging configuration.

JSON output (not human-formatted text) even in development -- consistency
between local logs and production logs means a log line copy-pasted from
your terminal is already in the exact shape a log aggregator (CloudWatch,
Datadog, whatever gets chosen in Module 17) will index it. The alternative
(pretty text locally, JSON in prod) means debugging a production-only
issue requires learning a different log format under pressure.

`request_id` is threaded through via contextvars (see middleware.py) so
every log line emitted while handling a single request -- across service
calls, git_engine calls, whatever -- can be correlated by grepping one ID,
without manually passing a request object through every function signature.
"""
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[str | None] = ContextVar("user_id", default=None)


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        import json

        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = request_id_ctx.get()
        if request_id:
            payload["request_id"] = request_id
        user_id = user_id_ctx.get()
        if user_id:
            payload["user_id"] = user_id

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # Allow call sites to attach arbitrary structured fields:
        # logger.info("repo created", extra={"repo_id": str(repo.id)})
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in payload or key in logging.LogRecord.__dict__:
                continue
            if key in ("args", "msg", "exc_info", "exc_text", "stack_info", "levelno", "created", "msecs", "relativeCreated"):
                continue
            payload[key] = value

        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root.addHandler(handler)

    # Quiet down noisy third-party loggers at DEBUG unless we're
    # specifically debugging them -- SQLAlchemy's echo already covers
    # query logging when settings.DEBUG is on.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
