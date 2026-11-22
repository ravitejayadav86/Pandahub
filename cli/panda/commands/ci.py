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
