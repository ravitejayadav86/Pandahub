"""
Pydantic schemas for the git smart-HTTP transport (Module 8).

The git wire protocol itself is binary and not parsed in Python — these
schemas cover only the application-layer concerns:
  - Which service type is being requested (upload-pack vs receive-pack)
  - Webhook delivery payloads (fired by the post-receive Celery task)

``GitServiceType`` values match the exact strings git sends in the
``?service=`` query parameter and in Content-Type headers.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class GitServiceType(str, Enum):
    """
    The two git smart-HTTP services.

    - ``UPLOAD_PACK`` handles clone and fetch (reading objects FROM the server).
    - ``RECEIVE_PACK`` handles push (writing objects TO the server).

    These string values are what git sends verbatim in the ``?service=``
    query parameter and in the ``Content-Type`` request header.
    """
    UPLOAD_PACK = "git-upload-pack"
    RECEIVE_PACK = "git-receive-pack"


# ---------------------------------------------------------------------------
# Webhook delivery schemas (fired by post_receive_hook Celery task)
# ---------------------------------------------------------------------------

class PushedRef(BaseModel):
    """One ref (branch or tag) that changed in a push event."""
    ref: str           # full ref name, e.g. "refs/heads/main"
    before: str        # old commit SHA (40 zeros for new branches)
    after: str         # new commit SHA (40 zeros for deleted branches)
    created: bool
    deleted: bool
    forced: bool       # true if old SHA is not an ancestor of new SHA


class WebhookPushPayload(BaseModel):
    """
    Payload delivered to registered webhook URLs on every push.

    Mirrors GitHub's push event payload shape so existing webhook
    consumers (CI systems, chat bots) can be reused with minimal changes.
    """
    event: str = "push"
    repository_id: uuid.UUID
    repository_name: str
    pusher_username: str
    ref: str                          # primary ref that was pushed
    refs: list[PushedRef]             # all refs changed in this push
    pushed_at: datetime
    compare_url: Optional[str] = None # link to diff view (populated by frontend)


class WebhookDeliveryResult(BaseModel):
    """Result of a single webhook delivery attempt."""
    webhook_id: uuid.UUID
    url: str
    status_code: Optional[int]
    success: bool
    error: Optional[str] = None
    delivered_at: datetime
