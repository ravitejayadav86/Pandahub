"""
Email-sending Celery tasks.

Celery workers execute tasks synchronously by default; `email_service`'s
send functions are async (aiosmtplib). Each task below is a thin sync
wrapper that runs the async function to completion via `asyncio.run()` --
this is the ONLY place that bridge happens, so `email_service.py` itself
stays pure-async and reusable (e.g. testable directly with pytest-asyncio
without needing Celery running at all).

Previously (Module 4) `auth_service.py` awaited these send functions
directly inline, with a docstring noting "sent via Celery in production."
This module is that promise fulfilled -- `auth_service.py` is updated in
this same module to call `.delay()` on these tasks instead.
"""
import asyncio

from app.worker.celery_app import celery_app
from app.services import email_service


@celery_app.task(
    name="app.worker.tasks.email_tasks.send_verification_email_task",
    max_retries=3,
    default_retry_delay=30,
)
def send_verification_email_task(to_email: str, username: str, token: str) -> None:
    asyncio.run(email_service.send_verification_email(to_email, username, token))


@celery_app.task(
    name="app.worker.tasks.email_tasks.send_password_reset_email_task",
    max_retries=3,
    default_retry_delay=30,
)
def send_password_reset_email_task(to_email: str, username: str, token: str) -> None:
    asyncio.run(email_service.send_password_reset_email(to_email, username, token))
