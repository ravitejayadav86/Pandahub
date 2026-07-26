# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Build context is the repo ROOT (dockerContext: . in render.yaml), so all
# paths below are relative to the repo root.
FROM python:3.12-slim AS builder

# libgit2 is required by pygit2; build deps only needed during compile.
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

# Runtime shared libraries for libgit2 / pygit2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgit2-1.7 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy the backend application code
COPY backend/ .

# Create non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

# Render injects PORT env var; default to 8000 for local builds.
ENV PORT=8000

# Run DB migrations then start uvicorn.
CMD alembic upgrade head && \
    uvicorn app.main:app \
        --host 0.0.0.0 \
        --port $PORT \
        --workers 2 \
        --log-level info
