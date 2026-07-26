FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgit2-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN addgroup --system appgroup \
 && adduser --system --ingroup appgroup appuser \
 && chown -R appuser:appgroup /app
USER appuser

CMD celery -A app.worker.celery_app.celery_app worker \
        --loglevel=info \
        --queues=email,git_ops,ai_ops \
        --concurrency=2
