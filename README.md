# 🐼 PandaHub

**Build. Collaborate. Innovate.**

PandaHub is a self-hosted, cloud-ready Git repository hosting platform — an
open architecture inspired by GitHub, built with a modular monolith backend,
a Next.js frontend, native Git storage, and first-class AI tooling.

## Monorepo Layout

| Path | Purpose |
|---|---|
| `frontend/` | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| `backend/` | FastAPI application (REST + WebSocket API) |
| `cli/` | The `panda` command-line tool (Typer-based) |
| `infrastructure/` | Dockerfiles, Nginx config, deployment scripts |
| `docs/` | Architecture, API, CLI, and developer documentation |
| `storage/` | Local bare Git repositories (dev only — see `.gitignore`) |
| `.github/workflows/` | CI/CD pipelines |

## Module Build Order

PandaHub is being built module by module. Status so far:

- [x] Module 1 — Overall Architecture
- [x] Module 2 — Folder Structure & Project Scaffolding (this commit)
- [ ] Module 3 — Database Design
- [ ] Module 4 — Authentication
- [ ] Module 5 — Backend Foundation
- [ ] Module 6 — Frontend Foundation
- [ ] Module 7 — Repository Engine
- [ ] Module 8 — Git Integration
- [ ] Module 9 — Panda CLI
- [ ] Module 10 — Collaboration Features (Issues, PRs, Discussions)
- [ ] Module 11 — AI Features
- [ ] Module 12 — Startup Hub
- [ ] Module 13 — Notifications
- [ ] Module 14 — Search
- [ ] Module 15 — Admin Panel
- [ ] Module 16 — Testing
- [ ] Module 17 — Deployment
- [ ] Module 18 — Documentation

## Quick Start (Development)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Bring up the full stack
make up

# 3. Run database migrations
make migrate

# 4. Backend docs available at:
#    http://localhost:8000/docs
# 5. Frontend available at:
#    http://localhost:3000
```

See `docs/architecture.md` for the full system design rationale.
