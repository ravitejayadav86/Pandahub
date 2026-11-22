"""CLI for PandaHub's advisory, development-only native CI queue."""
from __future__ import annotations

import click

from panda.core.api_client import ApiError, request


def _repo(spec: str) -> str:
    parts = spec.split("/")
    if len(parts) != 2 or not all(p and p not in (".", "..") for p in parts):
        raise click.BadParameter("Expected OWNER/REPO")
    return "/".join(parts)


def _call(method: str, path: str, **kwargs):
    try:
        return request(method, path, **kwargs)
    except ApiError as exc:
        raise click.ClickException(str(exc.detail)) from exc


@click.group()
def ci():
    """Development-only CI jobs; results are advisory, not release gates."""


@ci.command("enable")
@click.argument("repository")
def enable(repository: str):
    target = _repo(repository)
    _call("PATCH", f"/{target}/ci/settings", json_body={"enabled": True})
    click.echo(f"Native CI queue enabled for {target}. External runner required.")


@ci.command("disable")
@click.argument("repository")
def disable(repository: str):
    target = _repo(repository)
    _call("PATCH", f"/{target}/ci/settings", json_body={"enabled": False})
    click.echo(f"Native CI queue disabled for {target}.")


@ci.command("list")
@click.argument("repository")
@click.option("--limit", default=20, type=click.IntRange(1, 100))
def list_runs(repository: str, limit: int):
    target = _repo(repository)
    rows = _call("GET", f"/{target}/ci/runs", params={"limit": limit})
    if not rows:
        click.echo("No CI jobs yet. Enable CI and push a new commit.")
    for row in rows:
        summary = row["conclusion"] or row["status"]
        click.echo(f'{row["id"]}  {row["sha"][:10]} [{summary}] {row["branch"]}')


@ci.command("show")
@click.argument("repository")
@click.argument("run_id")
def show(repository: str, run_id: str):
    target = _repo(repository)
    row = _call("GET", f"/{target}/ci/runs/{run_id}")
    click.echo(f'CI {row["id"]}  {row["sha"]}  [{row["conclusion"] or row["status"]}]')
    click.echo(row.get("log_excerpt") or "No test output recorded.")
    click.echo("This is an admin-reported advisory result, NOT a trusted deployment check.")


@ci.command("timeout")
@click.argument("repository")
@click.argument("run_id")
@click.confirmation_option(
    prompt="Mark this stranded CI run timed out? This does not stop Docker on the runner host",
)
def mark_timeout(repository: str, run_id: str):
    """Admin-only: resolve a running CI job that has been stuck for 10+ min."""
    import uuid
    target = _repo(repository)
    try:
        canonical_run_id = str(uuid.UUID(run_id))
    except ValueError:
        raise click.BadParameter("Expected a UUID run ID", param_hint="RUN_ID") from None

    row = _call("POST", f"/{target}/ci/runs/{canonical_run_id}/timeout")
    click.echo(
        f'CI {row["id"]} resolved as [{row["conclusion"]}]. '
        "Inspect Docker on the runner host before starting another job."
    )


@ci.command("runner-register")
@click.argument("repository")
@click.option("--name", default="Local development runner", show_default=True)
@click.option(
    "--out", "out_path", default=None, type=click.Path(dir_okay=False),
    help="Credential file. Defaults to ~/.pandahub/ci-runners/OWNER-REPO.token",
)
def runner_register(repository: str, name: str, out_path: str | None) -> None:
    """Create one repository-scoped runner token; save it outside source."""
    import os
    from pathlib import Path

    target = _repo(repository)
    default_dir = Path.home() / ".pandahub" / "ci-runners"
    dest = Path(out_path).expanduser().resolve() if out_path else (
        default_dir / (target.replace("/", "-") + ".token")
    )
    if dest.exists():
        raise click.ClickException(
            f"Refusing to overwrite runner credential file: {dest}"
        )
    if not dest.parent.is_dir():
        dest.parent.mkdir(parents=True, exist_ok=True)
    # Refuse secrets inside any surrounding Git worktree, not merely under
    # the process cwd (which might itself be the user's home directory).
    for ancestor in (Path.cwd(), *Path.cwd().parents):
        if (ancestor / ".git").exists() and dest.is_relative_to(ancestor.resolve()):
            raise click.ClickException(
                "Runner credentials must not be saved inside a Git repository."
            )

    data = _call(
        "POST", f"/{target}/ci/runner/credentials",
        json_body={"name": name},
    )
    try:
        # Create exclusively and restrict permissions on POSIX. Windows users
        # must review file ACLs; chmod is not a Windows secrecy guarantee.
        fd = os.open(str(dest), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(data["token"] + "\n")
    except OSError as exc:
        # A committed credential must not remain valid after local write failure.
        try:
            _call("DELETE", f"/{target}/ci/runner/credentials/{data['id']}")
        except Exception:
            raise click.ClickException(
                "Saving runner token failed. Revoke the newly created runner "
                "credential using 'panda ci runner-revoke'."
            ) from exc
        raise click.ClickException("Saving runner token failed; credential revoked.") from exc

    click.echo(f"Runner '{name}' registered for {target}.")
    click.echo(f"Runner ID: {data['id']}")
    click.echo(f"Private token file: {dest}")
    click.echo("Token not printed. Protect this file and NEVER commit it.")


@ci.command("runner-list")
@click.argument("repository")
def runner_list(repository: str) -> None:
    """List registered runner identities, without showing any secrets."""
    target = _repo(repository)
    rows = _call("GET", f"/{target}/ci/runner/credentials")
    if not rows:
        click.echo("No repository runners registered.")
    for row in rows:
        state = "revoked" if row["revoked"] else "active"
        click.echo(f'{row["id"]} [{state}] {row["name"]}')


@ci.command("runner-revoke")
@click.argument("repository")
@click.argument("credential_id")
@click.confirmation_option(prompt="Revoke this runner credential immediately?")
def runner_revoke(repository: str, credential_id: str) -> None:
    """Revoke a repository-scoped runner secret; running jobs may stall."""
    import uuid
    target = _repo(repository)
    try:
        parsed_id = str(uuid.UUID(credential_id))
    except ValueError:
        raise click.BadParameter("Expected runner UUID") from None
    _call("DELETE", f"/{target}/ci/runner/credentials/{parsed_id}")
    click.echo(f"Runner {parsed_id} revoked for {target}.")
    click.echo("Inspect any in-progress Docker jobs before recovery.")
