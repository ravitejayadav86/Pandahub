import logging

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, queue="email", name="send_welcome_email")
def send_welcome_email(self, user_id: int, username: str, email: str) -> dict:
    """
    Send a welcome email to a newly registered user.
    In production, plug in aiosmtplib / SendGrid / SES here.
    """
    logger.info("Sending welcome email to %s (%s)", username, email)
    # TODO: integrate aiosmtplib with Jinja2 templates
    return {"status": "queued", "user_id": user_id}


@celery_app.task(bind=True, queue="email", name="send_verification_email")
def send_verification_email(self, user_id: int, email: str, token: str) -> dict:
    """Send an email-verification link."""
    logger.info("Sending verification email to %s (token=%s…)", email, token[:8])
    # TODO: integrate aiosmtplib with Jinja2 templates
    return {"status": "queued", "user_id": user_id}
