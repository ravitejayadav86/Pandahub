# Native CI reliability QA — no deployment gates

This branch hardens PandaHub's **development-only** native CI lifecycle
without enabling CI for any repository and without applying a migration.

## Why this is needed

PandaHub previously verified one end-to-end successful job. A happy path is
not enough to approve continuous automation, so this adds negative cases and
explicit treatment of stuck runners.

## New behavior

1. CI continues to run only when an administrator opted in and a separate
   local Docker runner was started. Backend and worker never execute code.
2. On a real Docker timeout, the runner attempts `docker rm -f`.
   If removal succeeds it reports `timed_out`. If Docker removal fails or
   itself times out, it records `error` and tells the operator that the
   container may still exist. It always stops its local Docker CLI process.
3. A repository admin may resolve a CI job that has remained `running`
   for **at least 10 minutes**:
   `POST /api/v1/{owner}/{repo}/ci/runs/{run_id}/timeout`.
   The API uses a row lock, checks the server's clock, and records a
   non-attested, administrative `timed_out` conclusion. A late runner
   completion cannot overwrite it with success (409).
4. CLI: `panda ci timeout OWNER/REPO RUN_UUID`. Requires interactive
   confirmation; it explicitly warns this action does NOT terminate Docker.
5. The dashboard displays a guarded recovery control only for apparently
   stale runs. Server-side admin permission and server clock are authoritative.
   The UI cannot force a recent or completed run to time out.
6. No replay, retries, or trusted success attestations are added here. A
   timeout represents an **unresolved job**, not a verified container stop.

## Automated QA

Backend unit tests cover recent, old, missing, already-completed, and
naive-timestamp cases. Tests also verify that a manually resolved timeout
cannot subsequently be overwritten with a fake success.

The `Backend Tests` GitHub Actions workflow adds a **separate**
`runner-sandbox-smoke` job in a disposable GitHub VM. It pulls the same
`python:3.12-slim` image used by the development runner and executes
three synthetic scenarios in real constrained Docker containers:

| Scenario | Expected stored conclusion |
|---|---|
| Valid Python unittest | `success` |
| Deliberately failing assertion | `failure` |
| Python code with no tests | `failure` |

Those smoke tests do **not** call the live PandaHub server or use any
private repositories, tokens, or API credentials. They check runtime exit
classifications rather than actual DB integration.

## Manual local checks (after reviewing the QA branch)

```powershell
$project = "$env:USERPROFILE\Downloads\Pandahub"
$qaRepo = "raviteja/qa-ai-smoke-20261122-174645"

# Read-only checks from the existing installation.
Set-Location $project
docker compose exec -T backend alembic current
git status --short

# Do not run any migration for this branch.
# Do not automatically re-enable CI on the QA repository.
```

The new endpoint and CLI exist only after deliberately integrating this
branch into the local backend and restarting it. **Do not force-push,
merge into main, restart production, or enable deployment automation**
based on these tests. Existing backend errors should be tracked and
resolved before production CI releases.

## Outstanding production requirements

- Runner-specific, non-admin identities and per-job leased claims
- Durable history for multiple attempts, retries, and worker crash recovery
- VM/microVM-level isolation for untrusted multi-tenant workloads
- Secrets protection, audit trails, artifact provenance, trusted attestations
- Approval-gated staging and production deployments
- Investigation and resolution of outstanding application backend errors
