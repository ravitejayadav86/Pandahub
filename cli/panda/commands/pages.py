"""Control actual PandaHub Pages static publishing (not a generic app deployer)."""
from __future__ import annotations

import click

from panda.core.api_client import ApiError, request
from panda.commands.insights import _slug


def _api(method: str, path: str, **kwargs):
    try:
        return request(method, path, **kwargs)
    except ApiError as exc:
        raise click.ClickException(str(exc.detail)) from exc


@click.group()
def pages():
    """Deploy static websites using PandaHub Pages."""


@pages.command("enable")
@click.argument("repository")
@click.option("--branch", default="main", show_default=True)
@click.option("--folder", default="/", show_default=True)
def enable(repository: str, branch: str, folder: str):
    target = _slug(repository)
    data = _api("POST", f"/{target}/pages", json_body={"source_branch": branch, "source_folder": folder})
    click.echo(f"Pages configuration saved: {data.get('status', 'pending')}")
    click.echo(f"URL: {data.get('url') or 'not available yet'}")


@pages.command("deploy")
@click.argument("repository")
def deploy(repository: str):
    """Queue a static-site rebuild; check status to verify the outcome."""
    target = _slug(repository)
    data = _api("POST", f"/{target}/pages/rebuild")
    click.echo(f"Pages rebuild requested. Status: {data.get('status', 'queued')}")
    click.echo(f"URL: {data.get('url') or 'not available yet'}")


@pages.command("status")
@click.argument("repository")
def status(repository: str):
    target = _slug(repository)
    data = _api("GET", f"/{target}/pages")
    click.echo(f"Pages status: {data.get('status', 'unknown')}")
    click.echo(f"Published SHA: {data.get('published_sha') or 'none'}")
    click.echo(f"URL: {data.get('url') or 'not available'}")
    if data.get("last_error"):
        click.echo("Last error: " + str(data["last_error"])[:200])
