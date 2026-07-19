"""
Celery application instance and configuration.

Three queues, matching Module 1's scalability decision: a slow AI job must
never delay a password-reset email, and a large git push must never sit
behind either. Each queue can be scaled independently later (e.g. more
git_ops workers during a traffic spike) since they're separate queues,
not just separate task names on one queue.

`task_routes` maps task NAME PREFIXES to queues -- new tasks in Module 8
(git_engine) and Module 11 (AI) just need to live under
`app.worker.tasks.git_tasks` / `app.worker.tasks.ai_tasks` respectively
and they're automatically routed correctly, no per-task configuration needed.
"""
from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "pandahub",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.worker.tasks.email_tasks",
        # "app.worker.tasks.git_tasks",   -- added in Module 8
        # "app.worker.tasks.ai_tasks",    -- added in Module 11
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Acks-late + reject-on-worker-lost: if a worker process dies mid-task
    # (OOM, deploy restart), the task is re-queued rather than silently
    # lost -- important for "send verification email", where silently
    # dropping it means a user is stuck unable to log in with no clue why.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        "app.worker.tasks.email_tasks.*": {"queue": "email"},
        "app.worker.tasks.git_tasks.*": {"queue": "git_ops"},
        "app.worker.tasks.ai_tasks.*": {"queue": "ai_ops"},
    },
    # Retry policy for transient failures (SMTP server hiccup, etc.) --
    # applied per-task via @celery_app.task(max_retries=..., default_retry_delay=...)
    # rather than globally, since git/AI tasks will want very different values.
)
