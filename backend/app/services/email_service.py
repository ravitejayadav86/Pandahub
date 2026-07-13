"""
Email delivery service.

Sends are dispatched through Celery (see worker/tasks/email_tasks.py,
Module 5) rather than awaited inline in the request handler -- SMTP calls
can take seconds and occasionally hang, and a registration request should
never block on mail server latency. This module contains the actual
send logic; the Celery task is a thin wrapper that calls into it.
"""
from pathlib import Path

import aiosmtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import get_settings

settings = get_settings()

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


async def _send_html_email(to_email: str, subject: str, html_body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable client to view.")
    message.add_alternative(html_body, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=settings.SMTP_TLS,
    )


async def send_verification_email(to_email: str, username: str, token: str) -> None:
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    template = _jinja_env.get_template("verify_email.html")
    html = template.render(username=username, verification_url=verification_url)
    await _send_html_email(to_email, "Verify your PandaHub email", html)


async def send_password_reset_email(to_email: str, username: str, token: str) -> None:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    template = _jinja_env.get_template("reset_password.html")
    html = template.render(username=username, reset_url=reset_url)
    await _send_html_email(to_email, "Reset your PandaHub password", html)
