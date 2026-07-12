.PHONY: up down build logs migrate makemigration shell-backend shell-db test-backend test-frontend lint clean

## Bring the full stack up (detached)
up:
	docker compose up -d --build

## Stop and remove containers (keeps volumes/data)
down:
	docker compose down

## Rebuild all images without cache
build:
	docker compose build --no-cache

## Tail logs from every service
logs:
	docker compose logs -f

## Apply all pending Alembic migrations
migrate:
	docker compose exec backend alembic upgrade head

## Generate a new Alembic migration from model changes
## Usage: make makemigration name="add users table"
makemigration:
	docker compose exec backend alembic revision --autogenerate -m "$(name)"

## Open a shell inside the backend container
shell-backend:
	docker compose exec backend /bin/bash

## Open a psql shell inside the postgres container
shell-db:
	docker compose exec postgres psql -U $${POSTGRES_USER} -d $${POSTGRES_DB}

## Run backend test suite
test-backend:
	docker compose exec backend pytest -v --cov=app

## Run frontend test suite
test-frontend:
	docker compose exec frontend npm run test

## Run backend linters (ruff + mypy)
lint:
	docker compose exec backend ruff check app
	docker compose exec backend mypy app

## Remove all containers, volumes, and orphaned images (DESTRUCTIVE)
clean:
	docker compose down -v --remove-orphans
