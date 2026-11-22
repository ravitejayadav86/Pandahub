# PandaHub native CI — development MVP

## Security and trust contract

This is **not** a production multi-tenant CI service or a deployment gate.

- CI is disabled for each repository by default. A repo admin must opt in.
- Accepted Git branch tips create durable `queued` records through `git_ops`.
- FastAPI, Git HTTP, and Celery NEVER execute repository code or access Docker.
- The runner operates as a **separate, explicitly started local host process**.
- Docker execution uses no network, no capabilities, no-new-privileges,
  a non-root user, a read-only root filesystem, read-only source mount,
  memory/pid/CPU limits, and a bounded timeout.
- The API accepts results from a repo administrator's CLI session. They are
  **self-reported and forgeable by that administrator**, so they MUST NOT
  satisfy branch protections, auto-merge rules, production deployments, or
  trusted security attestations.
- Docker containers share the host kernel. Use disposable local repositories,
  not hostile multi-tenant submissions; stronger isolation needs a dedicated
  VM/microVM runner, runner-specific identities, signed artifacts, and claims
  with leases and recovery.
- No automatic software installation or network access occurs inside jobs.
  This MVP supports **Python syntax checks and Python stdlib unittest** only.
  Missing tests count as failure. Other languages are not supported yet.
- Never pass PATs, tokens, provider credentials, host source directories,
  or the Docker socket into the test container.
- The CI worker does not verify deployments. Deployments require a separate
  permissioned release gate, not implemented here.

## Prepare (local Docker Desktop)

1. Review the draft PR and do **not** merge to production.
2. Back up the local PostgreSQL DB; then apply migration
   `0007_native_ci_queue` (requires migration 0006).
3. Restart the local FastAPI backend and Celery worker so they load the
   new model and Git post-receive hook.
4. On the local host, explicitly pre-pull the image:
   `docker pull python:3.12-slim`.
5. Use a dedicated disposable private PandaHub repository. For this MVP,
   the API must be `http://localhost:8000/api/v1` and the PandaHub
   CLI must already have an authenticated Git credential helper.

## Queue and run

From PowerShell in the PandaHub project root, after installing the updated CLI:

```powershell
panda ci enable raviteja/YOUR-DISPOSABLE-TEST-REPO
# Push a new Git commit to that repo; use --no-checkout/no secrets in test content.
panda ci list raviteja/YOUR-DISPOSABLE-TEST-REPO
& ".\\backend\\.venv\\Scripts\\python.exe" .\\scripts\\panda_ci_runner.py --repo raviteja/YOUR-DISPOSABLE-TEST-REPO
panda ci list raviteja/YOUR-DISPOSABLE-TEST-REPO
panda ci show raviteja/YOUR-DISPOSABLE-TEST-REPO RUN_UUID
panda ci disable raviteja/YOUR-DISPOSABLE-TEST-REPO
```

The runner defaults to **one queued job**, then exits. Add `--watch`
to keep polling while the local terminal remains open; stop with Ctrl+C.
Only start `--watch` for a repository whose commits you explicitly trust.
A job that gets stuck in `running` after a host crash requires manual
recovery; automatic retry/leases are out of scope.

Tests must be named `test*.py` and use `unittest`, e.g.:

```python
# tests/test_math.py
import unittest

class MathTests(unittest.TestCase):
    def test_addition(self):
        self.assertEqual(2 + 2, 4)
```

The runner verifies that the branch currently advertises the recorded exact
commit SHA, exports Git objects without a working-tree checkout, rejects
symlinks and unsafe archive entries, and starts a constrained local Docker
container. If the remote branch has moved, it refuses to test another SHA.

## Future production gates

Trusted runner authentication and job leases, isolated VMs/microVMs,
multi-language images with curated dependencies, test artifacts, redaction,
branch protection, approvals, multi-stage deployment, and monitoring must
be implemented **before** hosted untrusted repo CI or production shipping.
