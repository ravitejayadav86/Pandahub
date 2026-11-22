# PandaHub native CI: repository-scoped runners and leases (QA design)

This branch is an opt-in **development** upgrade atop the native CI,
dashboard, and reliability QA draft branches. No production deployment
or repository CI setting is enabled by these commits.

## Security boundary

- Human users manage runner identities via existing repository ADMIN
  permissions and PandaHub user JWTs. They can list, register and revoke
  runner identities.
- A runner uses a **separate, random, repository-specific bearer secret**
  through `X-PandaHub-CI-Token`. This token is not a user JWT and cannot
  call user account endpoints. The backend stores only its SHA-256 hash,
  credential ID, repository ID, name and timestamps. The raw token is
  returned once during registration.
- Running a test container still requires a separate explicitly started
  local process, not FastAPI or Celery. Git private-repo read access uses
  your existing Git credential helper, **not** the CI runner API token.
- Local runner HTTP is restricted to loopback at `localhost:8000`.
  External hosting requires TLS, a dedicated runner trust domain and a
  hardened network policy; this development proof is **not** suitable for
  hostile or multi-tenant code.
- An administrator can provision a credential and ultimately control the
  runner host, so results remain **advisory and not attested**. They must
  not gate production deployments or auto-merges.

## Atomic claim and heartbeat protocol

1. An opted-in repo receives a `queued` record from an accepted Git push.
2. The runner calls `POST /{owner}/{repo}/ci/runner/claim` using its token.
   PostgreSQL row locking with `SKIP LOCKED` picks only the oldest
   available job. The response contains commit SHA, branch, run ID, and
   a random opaque lease UUID.
3. A runner's lease lasts **3 minutes**. Heartbeat requests every 20
   seconds extend the server-side lease, up to an absolute 10-minute run
   deadline. A runner cannot renew leases indefinitely. Only the same
   repository-scoped credential + current lease ID can complete or heartbeat
   the job.
4. Completion stores the actual `success/failure/error/timed_out`
   conclusion, bounded output, and clears the lease. Revoked, mismatched,
   expired, or completed leases are rejected. Old user-JWT-only CI claim
   and complete routes return **410 Gone**, preventing silent fallback.
5. If a runner crashes, the job remains `running` (no automatic retry).
   An administrator may resolve it after **10 minutes**, but **not while
   a valid heartbeat lease remains**. This records an explicit unverified
   administrative timeout; the operator must separately inspect/stop
   any leftover Docker container.
6. Token revocation takes effect on future runner API requests. Running
   containers are not automatically terminated by credential revocation.

## Schema

Migration `0008_ci_runner_leases` follows `0007_native_ci_queue`,
adding `ci_runner_credentials` and nullable fields to `ci_runs`:
`runner_credential_id`, `lease_id`, `lease_expires_at` and
`last_heartbeat_at`. Existing saved CI run histories are retained
unchanged. **Back up PostgreSQL before running this migration.**

## Local-only testing (after separately reviewing and installing the branch)

Before enabling any CI runner, verify the local database and source state.
Do not merge the draft feature branch into production or run 0008 blindly.

```powershell
Set-Location "$env:USERPROFILE\Downloads\Pandahub"
git status --short
docker compose exec -T backend alembic current
docker compose ps
```

After migration 0008 and the new backend/CLI are installed on a QA
instance, and only for a disposable private repo:

```powershell
$project = "$env:USERPROFILE\Downloads\Pandahub"
$python = "$project\backend\.venv\Scripts\python.exe"
$repo = "raviteja/qa-ai-smoke-20261122-174645"
$env:PYTHONPATH = "$project\cli"

# Requires an authenticated repository ADMIN account:
& $python -m panda.cli ci runner-register $repo --name "Windows local QA"
& $python -m panda.cli ci runner-list $repo

# Keep CI disabled except during a disposable test push:
& $python -m panda.cli ci enable $repo
# Push a NEW synthetic QA commit containing unittest tests.
# Then explicitly run ONE job (no --watch yet):
& $python "$project\scripts\panda_ci_runner.py" --repo $repo --token-file "$env:USERPROFILE\.pandahub\ci-runners\raviteja-qa-ai-smoke-20261122-174645.token"
& $python -m panda.cli ci list $repo
& $python -m panda.cli ci disable $repo
```

The token file must stay outside any Git repository, have restrictive
file ACLs on Windows, and never appear in logs or source. Rotation is
achieved by registering a new credential, switching the runner token file,
then revoking the old credential. Saving a new token without confirming its
file permissions is not sufficient for production security.

## Automated QA

- Unit tests verify 401/409 rejection, expired lease fencing, credential
  hashing and secret non-persistence, no duplicate claims, and that a job
  cannot report success using a stale or unrelated lease.
- Real PostgreSQL integration test confirms repo isolation, claim,
  heartbeat, failed completion, and token revocation against migration 0008.
- Existing Docker safety, PASS/FAIL/syntax-error smoke, frontend tests,
  and migrations remain separate gates.
- **The installed local PandaHub remains at 0007** until an administrator
  explicitly reviews the upgrade, backs up data, and performs it in staging.

## Future work (NOT implemented)

VM/microVM isolation for untrusted tenants, per-attempt audit history,
retry policies, durable worker restart recovery, remote runner mTLS,
secret rotation policies, signed attestation, approval-gated staging and
production deployments. Outstanding existing backend errors remain
release blockers.
