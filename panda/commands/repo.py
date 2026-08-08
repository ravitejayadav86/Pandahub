"""panda.commands.repo — repository creation and listing."""
from __future__ import annotations

import click

from panda.core import config
from panda.core.api_client import ApiError, request


@click.group()
def repo():
    """Manage PandaHub repositories."""


@repo.command("create")
@click.argument("name")
@click.option("--description", "-d", default=None, help="Repository description")
@click.option("--private", is_flag=True, help="Create as private (default: public)")
@click.option("--default-branch", default="main", help="Default branch name")
@click.option(
    "--no-auto-init",
    is_flag=True,
    help="Create an empty repo with no initial README/commit",
)
def repo_create(
    name: str,
    description: str | None,
    private: bool,
    default_branch: str,
    no_auto_init: bool,
):
    """Create a new repository under your account."""
    payload = {
        "name": name,
        "description": description,
        "visibility": "private" if private else "public",
        "default_branch": default_branch,
        "auto_init": not no_auto_init,
    }
    try:
        data = request("POST", "/repos", json_body=payload)
    except ApiError as exc:
        click.secho(f"Error: {exc.detail}", fg="red")
        raise SystemExit(1)

    username = config.get_username() or "<username>"
    click.secho(f"Created {username}/{name}", fg="green")
    click.echo(
        f"  Clone URL: https://pandahub-backend.onrender.com/git/{username}/{name}.git"
    )


@repo.command("list")
@click.option("--limit", default=30, help="Max number of repos to show")
def repo_list(limit: int):
    """List your repositories."""
    try:
        repos = request("GET", "/auth/me/repos", params={"limit": limit})
    except ApiError as exc:
        click.secho(f"Error: {exc.detail}", fg="red")
        raise SystemExit(1)

    if not repos:
        click.echo("No repositories found. Create one with `panda repo create <name>`.")
        return

    for r in repos:
        visibility = r.get("visibility", "?")
        click.echo(f"  {r['name']:<30} [{visibility}]")
