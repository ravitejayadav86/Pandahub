#!/bin/sh
# entrypoint.sh - run DB migrations then start the API server.
# Used by the backend Docker container (both local and Render).
set -e

echo '==> Running database migrations...'
alembic upgrade head

echo '==> Starting uvicorn...'
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
