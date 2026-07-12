# syntax=docker/dockerfile:1
#
# Shares the exact same dependency set as backend.Dockerfile on purpose:
# the worker imports the same app/ package (services, models, git_engine)
# as the API — it just runs a Celery entrypoint instead of Uvicorn.
# Keeping requirements.txt identical avoids "works on API, breaks on worker" drift.
FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libgit2-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home pandahub && chown -R pandahub:pandahub /app
USER pandahub

CMD ["celery", "-A", "app.worker.celery_app", "worker", "--loglevel=info", "-Q", "git_ops,ai_ops,email"]
