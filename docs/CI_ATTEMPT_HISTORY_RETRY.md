# PandaHub CI attempt audit and manual recovery (draft QA)

This QA-only feature branch is based on the authenticated runner + lease
branch (`0008_ci_runner_leases`). It adds Alembic
`0009_ci_attempt_audit` and does **not** touch the user's installed
local PandaHub, token file, database, Docker services, or QA repository.

## Why it exists

The previously verified scoped runner can execute a successful Git push,
but a single `ci_runs` summary does not preserve what happened if a job is
later retried. The system also cannot safely infer that a crashed runner's
Docker container stopped merely because a lease expired.

### Implemented

1. **Durable attempts:** Each atomic runner claim creates a numbered
   `ci_run_attempts` record with runner identity, lease UUID, start time,
   eventual outcome, bounded logs, completion time, and end reason.
   The runner cannot finalize a job without its matching active audit row.
2. **Previous results preserved:** A successful or failed attempt remains
   recorded when a subsequent attempt is explicitly queued. The current
   `ci_runs` row continues to show the latest status.
3. **Historical backfill:** Migration `0009` writes one attempt for every
   existing running or completed CI job from `0008`; queued jobs remain at
   attempt count zero. This preserves the two QA successes rather than
   treating them as never-run jobs. No automatic CI is enabled by migration.
4. **Bounded retry:** The repository ADMIN endpoint
   `POST /{owner}/{repo}/ci/runs/{id}/retry` requires CI already enabled,
   a completed `failure`, `error` or `timed_out` status, at least one
   finalized prior attempt, a 10-300 character reason, and explicit
   `operator_confirmed_runner_stopped: true`. At most **3 actual attempts**
   are permitted. It only sets the run back to `queued`; it never starts
   Docker or invokes a worker.
5. **Failed-closed results:** Every new claim gets a fresh lease UUID.
   A late completion from an earlier attempt is rejected, even if it
   comes from the same runner identity and same Git commit.
6. **Manual timeout audit:** A repo ADMIN can still resolve an expired,
   genuinely stranded job after ten minutes, but only when there is no
   valid heartbeat lease. The corresponding attempt is closed with
   `admin_unverified_timeout`; this is not proof that its container exited.
7. **Readable history:** `GET /{owner}/{repo}/ci/runs/{id}/attempts`
   serves READ-authorized, scoped, numbered results, omitting the
   internal lease UUID and runner credential ID.
8. **CLI:** `panda ci attempts OWNER/REPO RUN_UUID` is read-only;
   `panda ci retry OWNER/REPO RUN_UUID --reason "Inspected the host..."`
   requires a separate interactive confirmation of actual Docker cleanup.

## Critical limits

The server cannot independently attest an operator's claim that the
old Docker container stopped. **Do not use retry** unless a human inspected
the runner host and confirmed shutdown. There are **no automatic retries,
automatic crashed-run recovery, trusted release checks, or production
deployment gates**. A retry on an old branch whose tip moved may fail the
runner's exact SHA safety check, which is intentional.

The existing `ci_runs` unique constraint on repository/branch/SHA remains,
so retrying never inserts a duplicate logical run.

## Tests

The GitHub backend workflow migrates ephemeral PostgreSQL to `0009`,
runs Ruff and full pytest, including real Postgres tests for failure →
explicit retry → new lease → success, no late-result overwrite, token
revocation and durable numbered audit. Real isolated Docker PASS/FAIL/
syntax-error smoke remains a separate job. Frontend CI continues to run.

## Installing locally — NOT YET

Do **not** run `alembic upgrade head` using the new staging worktree
against your current installation. The existing PandaHub is correctly
operating on `0008` and has valuable saved CI reports and runner
credentials. Before local integration:

- Finish all draft PR #9 CI gates and manual review.
- Create a verified PostgreSQL dump with the current `0008` system.
- Use a read-only source/conflict preflight that preserves local changes.
- Run migration `0009` only as part of a separately approved controlled
  installation; never reset or `git clean` the active worktree.
- Validate that the two previously saved CI runs and the active scoped
  runner credential still exist after migration.

Existing backend errors remain independent release blockers.
