FROM python:3.12-slim

# Install system deps for pygit2 (libgit2) and pip build tools.
# libgit2-dev pulls in the correct runtime lib automatically.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgit2-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Non-root user for security
RUN addgroup --system appgroup \
 && adduser --system --ingroup appgroup appuser \
 && chown -R appuser:appgroup /app
USER appuser

ENV PORT=8000

CMD alembic upgrade head && \
    uvicorn app.main:app \
        --host 0.0.0.0 \
        --port $PORT \
        --workers 2 \
        --log-level info
