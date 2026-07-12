# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

# System deps: libgit2 for pygit2, git itself for smart-http fallback, build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libgit2-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python deps first (layer caching: only reinstall when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user for security (defense in depth — container escape doesn't grant root on host)
RUN useradd --create-home pandahub && chown -R pandahub:pandahub /app
USER pandahub

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
