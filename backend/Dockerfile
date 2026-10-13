FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
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

ENV PORT=8000

CMD ["sh", "-c", "set -eu; echo '[boot] PHASE 1: starting Alembic'; alembic upgrade head; echo '[boot] PHASE 2: migrations completed; starting Uvicorn'; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --log-level info"]
