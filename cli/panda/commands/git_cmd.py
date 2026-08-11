"""panda.commands.git_cmd - Real git clone/push/pull wrapping, with automatic auth."""
from __future__ import annotations

import subprocess
import sys

import click

from panda.core import config
from panda.core.api_client import ApiError, request
from panda.core.gitutil import GIT_HOST, build_repo_url, ensure_credential_helper


def _parse_owner_repo(spec: str) -> tuple[str, str]:
    if "/" not in spec:
        click.secho("Expected format: <owner>/<repo>", fg="red")
        raise SystemExit(1)
    owner, repo_name = spec.split("/", 1)
    return owner, repo_name


@click.command("clone")
@click.argument("repo_spec")
@click.argument("directory", required=False)
def clone(repo_spec: str, directory: str | None):
    """Clone a PandaHub repository. Usage: panda clone <owner>/<repo> [directory]"""
    owner, repo_name = _parse_owner_repo(repo_spec)
    ensure_credential_helper()
    url = build_repo_url(owner, repo_name)
    cmd = ["git", "clone", url] + ([directory] if directory else [])
    result = subprocess.run(cmd)
    raise SystemExit(result.returncode)


@click.command("remote-add")
@click.argument("repo_spec")
@click.option("--name", default="pandahub", help="Remote name (default: pandahub)")
def remote_add(repo_spec: str, name: str):
    """Add (or update) a PandaHub remote in the current git repo. Usage: panda remote-add <owner>/<repo>"""
    owner, repo_name = _parse_owner_repo(repo_spec)
    ensure_credential_helper()
    url = build_repo_url(owner, repo_name)

    existing = subprocess.run(
        ["git", "remote"], capture_output=True, text=True
    ).stdout.split()

    if name in existing:
        subprocess.run(["git", "remote", "set-url", name, url])
        click.secho(f"Updated remote '{name}' -> {url}", fg="green")
    else:
        subprocess.run(["git", "remote", "add", name, url])
        click.secho(f"Added remote '{name}' -> {url}", fg="green")


@click.command("git-credential", hidden=True)
@click.argument("action")
def git_credential(action: str):
    """
    Internal: implements git's credential-helper protocol.

    Not meant to be run directly - git invokes this automatically
    (via the config set up by `ensure_credential_helper`) whenever it
    needs credentials for a pandahub.onrender.com URL.
    """
    input_lines: dict[str, str] = {}
    for line in sys.stdin:
        line = line.strip()
        if not line:
            break
        if "=" in line:
            k, v = line.split("=", 1)
            input_lines[k] = v

    host = input_lines.get("host", "")
    if GIT_HOST not in host:
        return

    if action != "get":
        return

    username = config.get_username()
    if not username:
        return

    token = config.get_git_token()
    if not token:
        # Lazily create a dedicated token for git operations, once.
        # Requires the user to be logged in via `panda login`.
        if not config.is_logged_in():
            return
        try:
            data = request(
                "POST",
                "/auth/tokens",
                json_body={
                    "name": "panda-cli-git",
                    "scopes": ["repo"],
                    "expires_in_days": None,
                },
            )
        except ApiError:
            return
        token = data["token"]
        config.save_git_token(token)

    click.echo(f"username={username}")
    click.echo(f"password={token}")