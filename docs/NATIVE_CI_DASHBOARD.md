# PandaHub native CI dashboard (QA feature)

The dashboard lives at `/{owner}/{repo}/ci` and requires the
`0007_native_ci_queue` backend API. It reads only live PandaHub CI data.

## Features

- Monochrome black/white/gray interface, responsive run history and detail pane.
- Real status and conclusion values; no hard-coded success metrics.
- Latest-run view, pass/fail/active counts and a rate based on **decided** jobs.
- Filter by result, branch, SHA and job ID; pagination through the most recent
  100 runs (not the complete database history).
- Saved result logs, run timing, commit/branch info, copyable SHA and logs.
- Automatic low-frequency refresh **only while queued or running jobs exist**,
  plus manual refresh.
- Explicit permission-scoped admin setting to enable/disable CI job creation.
  No buttons claim a run, execute code on the server, forge a CI result, or
  authorize deployment.
- Link from repository sidebar and tab bar, shared repository header, and AI
  Insights page.

## Security and correctness

All results are **repository-admin-reported and advisory**, as established
by the native CI API. The UI must NEVER treat a reported success as an
attested build or use it as a production deployment permission.

The user is allowed to view CI reports only if the backend grants repository
READ access. Changing settings requires backend ADMIN permission. UI buttons
are not authorization controls and do not bypass the backend.

The test logs are shown as escaped React text; no HTML parsing or shell
execution is performed by the frontend. The dashboard does not expose
runner credentials or trigger Docker remotely.

## Run locally

From a separate staging worktree on the dashboard branch:

```powershell
cd "$env:USERPROFILE\Downloads\PandaHub-CI-Dashboard"
cd frontend
npm ci
npm run type-check
npm run test
npm run lint
npm run build
```

To see real saved runs, the browser must reach a local PandaHub backend
with migration 0007, and the frontend must have a working `/api/v1` proxy.
Open `http://localhost:3000/raviteja/qa-ai-smoke-20261122-174645/ci`
after the frontend feature has been deployed locally. A previously completed
run must show PASS and its saved two test cases; the repository's CI setting
should remain disabled unless the administrator explicitly enables it.

## Out of scope

This PR does not modify the native CI backend, start a runner, enable CI
for any repository, provide job replay, or deploy PandaHub. Proper runner
attestation, branch protection, and secure deployment gates remain separate
work.
