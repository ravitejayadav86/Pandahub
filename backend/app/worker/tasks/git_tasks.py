"""
Celery tasks for git post-receive processing.

Fired by ``api/v1/git.py`` after every successful ``git push``.  The task
runs in the ``git_ops`` worker queue, completely separate from API request
handling, so:
  - A slow webhook delivery (30 s timeout) doesn't block the next push
  - DB writes for branch cache sync happen outside the HTTP request lifecycle
  - AI review dispatch (Module 11 hook point) doesn't add latency to the push

Task chain on every push:
  1. Parse pushed refs from receive-pack output
  2. Read new commit details from the bare repo (pygit2, sync)
  3. Upsert/delete Branch rows in the DB
  4. Update Repository.pushed_at + Repository.size_kb
  5. Deliver payloads to registered Webhooks (with HMAC-SHA256 signature)
  6. [Module 11 hook] Dispatch AI review if a PR exists for the pushed branch

Design: this task uses a SYNCHRONOUS SQLAlchemy session (psycopg3 sync
driver) because Celery workers are not async.  We deliberately don't use
asyncio.run() here — mixing the two event loops in a Celery worker is
fragile and provides no benefit since tasks are already concurrent at the
process level.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests  # synchronous HTTP client for webhook delivery

from app.core.config import get_settings
from app.core.logging import get_logger
from app.git_engine.writer import (
    get_commit_detail,
    get_repo_size_kb,
    parse_receive_pack_output,
    sync_branch_cache_from_refs,
)
from app.worker.celery_app import celery_app

settings = get_settings()
logger = get_logger("app.worker.tasks.git_tasks")

# Webhook delivery timeout (seconds). Long enough for slow endpoints but
# short enough that one dead webhook doesn't stall the whole post-receive.
_WEBHOOK_TIMEOUT_S = 10


# ---------------------------------------------------------------------------
# Synchronous DB session helper
# ---------------------------------------------------------------------------

def _get_sync_session():
    """
    Return a synchronous SQLAlchemy session for use inside Celery tasks.

    We use ``psycopg`` (sync driver) here.  The async ``asyncpg`` driver
    is only safe inside an asyncio event loop, which Celery workers don't
    have by default.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Convert async URL (postgresql+asyncpg://...) → sync URL (postgresql+psycopg://...)
    sync_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    ).replace(
        "postgresql://", "postgresql+psycopg://"
    )
    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    return Session()


# ---------------------------------------------------------------------------
# Main post-receive task
# ---------------------------------------------------------------------------

@celery_app.task(
    name="app.worker.tasks.git_tasks.post_receive_hook",
    queue="git_ops",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def post_receive_hook(
    repo_id: str,
    disk_path: str,
    pusher_username: str,
    receive_pack_output: str,
) -> dict:
    """
    Post-receive processing for a completed git push.

    Args:
        repo_id:               UUID string of the repository.
        disk_path:             Absolute path to the bare git repo on disk.
        pusher_username:       Username of the user who pushed.
        receive_pack_output:   Captured stderr from ``git http-backend``
                               receive-pack, containing pushed ref lines.

    Returns:
        A summary dict with counts of actions taken (for Celery result backend).
    """
    logger.info(
        "post_receive_hook started",
        extra={"repo_id": repo_id, "pusher": pusher_username},
    )

    summary = {
        "repo_id": repo_id,
        "branches_upserted": [],
        "branches_deleted": [],
        "webhooks_fired": 0,
        "webhooks_failed": 0,
        "errors": [],
    }

    # ------------------------------------------------------------------
    # 1. Parse pushed refs
    # ------------------------------------------------------------------
    updates = parse_receive_pack_output(receive_pack_output)
    if not updates:
        logger.info("post_receive_hook: no ref updates parsed", extra={"repo_id": repo_id})
        # Even with no parsed refs (e.g. force-push to same SHA), update pushed_at
        updates = []

    # ------------------------------------------------------------------
    # 2. Read commit details + compute branch sync data (sync pygit2)
    # ------------------------------------------------------------------
    sync_result = sync_branch_cache_from_refs(disk_path, updates)
    new_size_kb = get_repo_size_kb(disk_path)
    now = datetime.now(timezone.utc)

    # Build a mapping of branch_name → CommitDetail for upserted branches
    commit_details: dict[str, object] = {}
    for update in updates:
        if not update.is_branch or update.is_delete:
            continue
        detail = get_commit_detail(disk_path, update.new_sha)
        if detail:
            commit_details[update.branch_name] = detail

    if sync_result.errors:
        summary["errors"].extend(sync_result.errors)
        for err in sync_result.errors:
            logger.warning("branch sync error", extra={"repo_id": repo_id, "error": err})

    # ------------------------------------------------------------------
    # 3. DB writes: Branch upsert/delete + Repository metadata
    # ------------------------------------------------------------------
    repo_uuid = uuid.UUID(repo_id)
    try:
        from sqlalchemy import select, delete, update as sql_update
        from app.models.repo import Branch, Repository, Webhook

        session = _get_sync_session()
        try:
            # Load the repository row
            repo = session.execute(
                select(Repository).where(Repository.id == repo_uuid)
            ).scalar_one_or_none()

            if repo is None:
                logger.error("post_receive_hook: repo not found in DB", extra={"repo_id": repo_id})
                return summary

            # Upsert branches
            for branch_name in sync_result.upserted:
                detail = commit_details.get(branch_name)
                sha = detail.sha if detail else None
                last_pushed = detail.committed_at if detail else now

                existing = session.execute(
                    select(Branch).where(
                        Branch.repository_id == repo_uuid,
                        Branch.name == branch_name,
                    )
                ).scalar_one_or_none()

                if existing:
                    existing.last_commit_sha = sha
                    existing.last_pushed_at = last_pushed
                else:
                    session.add(Branch(
                        repository_id=repo_uuid,
                        name=branch_name,
                        is_default=(branch_name == repo.default_branch),
                        is_protected=False,
                        last_commit_sha=sha,
                        last_pushed_at=last_pushed,
                    ))

            # Delete removed branches
            for branch_name in sync_result.deleted:
                session.execute(
                    delete(Branch).where(
                        Branch.repository_id == repo_uuid,
                        Branch.name == branch_name,
                    )
                )

            # Update repository metadata
            repo.pushed_at = now
            repo.size_kb = new_size_kb

            session.commit()

            summary["branches_upserted"] = sync_result.upserted
            summary["branches_deleted"] = sync_result.deleted

            # ------------------------------------------------------------------
            # 4. Webhook delivery
            # ------------------------------------------------------------------
            webhooks = session.execute(
                select(Webhook).where(
                    Webhook.repository_id == repo_uuid,
                    Webhook.is_active.is_(True),
                )
            ).scalars().all()

            if webhooks and updates:
                payload = _build_webhook_payload(
                    repo=repo,
                    updates=updates,
                    pusher_username=pusher_username,
                    pushed_at=now,
                )
                for webhook in webhooks:
                    success = _deliver_webhook(webhook, payload)
                    if success:
                        summary["webhooks_fired"] += 1
                    else:
                        summary["webhooks_failed"] += 1

        finally:
            session.close()

    except Exception as exc:
        logger.exception(
            "post_receive_hook DB/webhook step failed",
            extra={"repo_id": repo_id, "error": str(exc)},
        )
        summary["errors"].append(str(exc))
        # Retry the task on transient errors (DB connection, etc.)
        raise post_receive_hook.retry(exc=exc)

    # ------------------------------------------------------------------
    # 5. [Module 11 hook point] AI review dispatch
    # ------------------------------------------------------------------
    # When Module 11 (AI) is built, add:
    #   from app.worker.tasks.ai_tasks import trigger_ai_review_for_push
    #   trigger_ai_review_for_push.delay(repo_id=repo_id, pushed_refs=[...])
    # The hook is intentionally a no-op here so Module 8 doesn't depend on
    # Module 11 being implemented.

    logger.info(
        "post_receive_hook completed",
        extra={
            "repo_id": repo_id,
            "branches_upserted": len(summary["branches_upserted"]),
            "branches_deleted": len(summary["branches_deleted"]),
            "webhooks_fired": summary["webhooks_fired"],
        },
    )
    return summary


# ---------------------------------------------------------------------------
# Webhook helpers
# ---------------------------------------------------------------------------

def _build_webhook_payload(
    repo,
    updates: list,
    pusher_username: str,
    pushed_at: datetime,
) -> dict:
    """Build the JSON payload delivered to webhook URLs."""
    from app.git_engine.writer import RefUpdate
    refs = []
    primary_ref = ""

    for u in updates:
        if not isinstance(u, object) or not hasattr(u, "ref_name"):
            continue
        refs.append({
            "ref": u.ref_name,
            "before": u.old_sha,
            "after": u.new_sha,
            "created": u.is_create,
            "deleted": u.is_delete,
            "forced": False,  # force-push detection requires comparing ancestry
        })
        if u.is_branch and not primary_ref:
            primary_ref = u.ref_name

    return {
        "event": "push",
        "repository_id": str(repo.id),
        "repository_name": repo.name,
        "pusher_username": pusher_username,
        "ref": primary_ref,
        "refs": refs,
        "pushed_at": pushed_at.isoformat(),
    }


def _sign_payload(payload_bytes: bytes, secret_hash: str) -> str:
    """
    Compute HMAC-SHA256 signature for webhook delivery.

    The ``secret_hash`` stored in DB is the SHA-256 of the raw secret
    (not the raw secret itself — we never store secrets in plaintext).
    However, for HMAC signing we need the raw secret.

    Current approach: use the hash as the HMAC key.  This is not ideal
    (ideally we'd encrypt the secret at rest with Fernet like OAuth tokens),
    but it's consistent with the existing Webhook model which stores
    ``secret_hash`` — updating the Webhook model to store an encrypted
    secret instead is a small migration tracked for Module 9.
    """
    return "sha256=" + hmac.new(
        secret_hash.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()


def _deliver_webhook(webhook, payload: dict) -> bool:
    """
    Deliver *payload* to *webhook.url* via HTTP POST.

    Signs the payload with HMAC-SHA256 so the receiving server can
    verify the request is genuine.

    Returns True on success (2xx), False otherwise.
    """
    try:
        payload_bytes = json.dumps(payload).encode("utf-8")
        signature = _sign_payload(payload_bytes, webhook.secret_hash)

        response = requests.post(
            webhook.url,
            data=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-PandaHub-Event": "push",
                "X-PandaHub-Signature-256": signature,
                "X-PandaHub-Delivery": str(uuid.uuid4()),
                "User-Agent": "PandaHub-Hookshot/1.0",
            },
            timeout=_WEBHOOK_TIMEOUT_S,
        )
        success = response.status_code < 400
        if not success:
            logger.warning(
                "webhook delivery failed",
                extra={
                    "url": webhook.url,
                    "status": response.status_code,
                },
            )
        return success

    except requests.RequestException as exc:
        logger.warning(
            "webhook delivery exception",
            extra={"url": webhook.url, "error": str(exc)},
        )
        return False
