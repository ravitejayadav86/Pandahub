"""Use repository-scoped AI commit reviews from the PandaHub CLI."""
from __future__ import annotations

import click

from panda.core.api_client import ApiError, request


def _slug(spec: str) -> str:
    parts = spec.split("/")
    if len(parts) != 2 or not all(p and p not in (".", "..") for p in parts):
        raise click.BadParameter("Expected OWNER/REPOSITORY")
    return "/".join(parts)


def _request(method: str, path: str, **kwargs):
    try:
        return request(method, path, **kwargs)
    except ApiError as exc:
        raise click.ClickException(str(exc.detail)) from exc


@click.group()
def insights():
    """Inspect actual AI review results for pushed commits."""


@insights.command("enable")
@click.argument("repository")
def enable(repository: str):
    """Opt a repository into external AI commit review (admin only)."""
    target = _slug(repository)
    _request("PATCH", f"/{target}/insights/settings", json_body={"enabled": True})
    click.secho(f"AI analysis enabled for {target}. Code diffs may be sent to your configured AI provider.", fg="green")


@insights.command("disable")
@click.argument("repository")
def disable(repository: str):
    """Disable new external AI commit analyses (admin only)."""
    target = _slug(repository)
    _request("PATCH", f"/{target}/insights/settings", json_body={"enabled": False})
    click.secho(f"AI analysis disabled for {target}.", fg="green")


@insights.command("list")
@click.argument("repository")
@click.option("--limit", default=10, show_default=True, type=click.IntRange(1, 100))
def list_insights(repository: str, limit: int):
    """List recorded reviews and their actual job statuses."""
    target = _slug(repository)
    data = _request("GET", f"/{target}/insights", params={"limit": limit})
    if not data:
        click.echo("No commit analyses recorded. Enable analysis, then push a new commit.")
        return
    for row in data:
        click.echo(f"{row['sha'][:10]} [{row['status']}] {row.get('branch', '')}")
        if row.get("summary"):
            click.echo("  " + row["summary"].replace("\n", " ")[:180])
        for step in (row.get("next_steps") or [])[:5]:
            click.echo(f"  - [{step.get('priority', 'medium')}] {step.get('action', '')[:160]}")
        if row.get("error"):
            click.echo("  Error: " + row["error"])


@insights.command("show")
@click.argument("repository")
@click.argument("sha")
def show(repository: str, sha: str):
    """Display the AI findings and next steps for a specific pushed SHA."""
    target = _slug(repository)
    data = _request("GET", f"/{target}/insights/{sha}")
    click.echo(f"Commit {data['sha']}  [{data['status']}]  model: {data.get('model_used') or 'none'}")
    click.echo(data.get("summary") or data.get("error") or "No result yet.")
    for step in data.get("next_steps") or []:
        click.echo(f"- [{step.get('priority', 'medium')}] {step.get('file', '')}: {step.get('action', '')}")
    click.echo("AI review is advisory. Build/test and deployment checks are separate.")
