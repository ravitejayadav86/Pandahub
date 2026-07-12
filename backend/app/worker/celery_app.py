from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "pandahub",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.worker.tasks.email_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_queues={
        "git_ops": {"exchange": "git_ops", "routing_key": "git_ops"},
        "ai_ops": {"exchange": "ai_ops", "routing_key": "ai_ops"},
        "email": {"exchange": "email", "routing_key": "email"},
    },
    task_default_queue="email",
)
