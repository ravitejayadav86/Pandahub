# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# This Dockerfile lives at the repo root so Render can find it
# regardless of dockerContext configuration.
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgit2-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgit2-1.7 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

WORKDIR /app

COPY backend/ .

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

ENV PORT=8000

CMD alembic upgrade head && \
    uvicorn app.main:app \
        --host 0.0.0.0 \
        --port $PORT \
        --workers 2 \
        --log-level info
