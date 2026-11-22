# PandaHub Native CI attempt history dashboard (draft)

This dashboard feature is stacked on the already tested
`feature/ci-attempt-history-safe-retry-20261122` backend and relies on
Alembic `0009_ci_attempt_audit`.

It is **not merged into main**, installed in the user's Windows PandaHub, or
deployed. No runner credential, CI setting, Docker service, or database is
changed by this PR.

## Selected-run experience

- Under a repository's existing monochrome `/{owner}/{repo}/ci` page,
  the selected run now exposes a numbered **Attempt history** panel.
- The UI fetches `GET /api/v1/{owner}/{repo}/ci/runs/{run_id}/attempts` for
  only the selected run, with request abort on selection or route changes.
  It refreshes when the run list refreshes (including a new completion).
- It shows distinct failure/success/timed_out/active outcomes, start/finish,
  elapsed time, and the saved retry reason/authorization time.
- Original logs remain inspectable via collapsed native HTML details.
  No auto-expanded long tracebacks, scroll-bound animations, or additional
  heavy client libraries.
- Missing/older API versions, unauthenticated responses, loading and empty
  records are handled separately without inventing a successful status.
- The original run inspector and saved latest-log output remain available.

## Safety

This is a read-only history panel. It makes **no** retry/claim/completion
requests. The backend is authoritative for repository permissions and
historical attempt records. Tokens and lease UUIDs are not exposed by the
history endpoint. CI reports remain advisory, never deployment approval.

The intentional QA sequence is: original failed commit with two failures,
then fixed commit with a separate success. The timeline should show two
failed attempts on the old run and one success on the new run.

## Validation and local rollout

The new frontend unit tests cover state labeling, attempt counts, missing
data and preserved histories. GitHub Frontend Tests must pass before this
draft PR is considered ready for manual review. Backend is unchanged from
migration `0009`.

Do not copy the entire staging repository into the active PandaHub
worktree. Integrate the dashboard's specific frontend files only after
comparing against the local customized frontend and creating backups.
