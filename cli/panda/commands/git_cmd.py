"""PandaHub CLI commands backed by the local Git executable."""
from __future__ import annotations

import subprocess
import sys

import click

from panda.core import config
from panda.core.api_client import ApiError, request
from panda.core.gitutil import (
    GIT_HOST,
    build_repo_url,
    ensure_credential_helper,
)


def _run_git(args: list[str]) -> None:
    """Run a local Git command and return its exit code."""
    result = subprocess.run(["git", *args], check=False)
    raise SystemExit(result.returncode)


def _parse_owner_repo(spec: str) -> tuple[str, str]:
    if "/" not in spec:
        click.secho("Expected format: <owner>/<repo>", fg="red")
        raise SystemExit(1)

    owner, repo_name = spec.split("/", 1)
    owner = owner.strip()
    repo_name = repo_name.strip()

    if not owner or not repo_name:
        click.secho("Expected format: <owner>/<repo>", fg="red")
        raise SystemExit(1)

    return owner, repo_name


# ---------------------------------------------------------------------------
# Repository / transport
# ---------------------------------------------------------------------------

@click.command("clone")
@click.argument("repo_spec")
@click.argument("directory", required=False)
def clone(repo_spec: str, directory: str | None):
    """Clone a PandaHub repository.

    Example:
        panda clone mrteji/my-project
    """
    owner, repo_name = _parse_owner_repo(repo_spec)

    ensure_credential_helper()

    url = build_repo_url(owner, repo_name)

    click.echo(f"Cloning {owner}/{repo_name} from PandaHub...")

    args = ["clone", url]

    if directory:
        args.append(directory)

    _run_git(args)


@click.command("remote-add")
@click.argument("repo_spec")
@click.option(
    "--name",
    default="pandahub",
    show_default=True,
    help="Remote name.",
)
def remote_add(repo_spec: str, name: str):
    """Add or update a PandaHub remote.

    Example:
        panda remote-add mrteji/my-project
    """
    owner, repo_name = _parse_owner_repo(repo_spec)

    ensure_credential_helper()

    url = build_repo_url(owner, repo_name)

    existing_result = subprocess.run(
        ["git", "remote"],
        capture_output=True,
        text=True,
        check=False,
    )

    if existing_result.returncode != 0:
        click.secho(
            existing_result.stderr.strip() or "Not inside a Git repository.",
            fg="red",
        )
        raise SystemExit(existing_result.returncode)

    existing = existing_result.stdout.split()

    if name in existing:
        _run_git(["remote", "set-url", name, url])
        click.secho(f"Updated remote '{name}' -> {url}", fg="green")
    else:
        _run_git(["remote", "add", name, url])
        click.secho(f"Added remote '{name}' -> {url}", fg="green")


# ---------------------------------------------------------------------------
# Git-style local commands
# ---------------------------------------------------------------------------

@click.command("init")
@click.argument("directory", required=False)
def init_repo(directory: str | None):
    """Initialize a Git repository."""
    args = ["init"]

    if directory:
        args.append(directory)

    _run_git(args)


@click.command("status")
@click.option("--short", is_flag=True, help="Show short status.")
@click.option("--branch", is_flag=True, help="Show branch information.")
def status(short: bool, branch: bool):
    """Show the working tree status."""
    args = ["status"]

    if short:
        args.append("--short")

    if branch:
        args.append("--branch")

    _run_git(args)


@click.command("add")
@click.argument("paths", nargs=-1, required=True)
def add(paths: tuple[str, ...]):
    """Stage files for the next commit."""
    _run_git(["add", *paths])


@click.command("commit")
@click.option("-m", "--message", required=True, help="Commit message.")
@click.option("--amend", is_flag=True, help="Amend the previous commit.")
def commit(message: str, amend: bool):
    """Create a commit."""
    args = ["commit", "-m", message]

    if amend:
        args.append("--amend")

    _run_git(args)


@click.command("push")
@click.argument("remote", required=False)
@click.argument("branch", required=False)
@click.option(
    "-u",
    "--set-upstream",
    is_flag=True,
    help="Set upstream.",
)
def push(
    remote: str | None,
    branch: str | None,
    set_upstream: bool,
):
    """Push commits to PandaHub.

    Defaults to the 'pandahub' remote instead of Git's 'origin'.
    """
    ensure_credential_helper()

    # PandaHub is the default remote for `panda push`.
    target_remote = remote or "pandahub"

    args = ["push"]

    if set_upstream:
        args.append("--set-upstream")

    args.append(target_remote)

    if branch:
        args.append(branch)

    _run_git(args)

@click.command("pull")
@click.argument("remote", required=False)
@click.argument("branch", required=False)
def pull(remote: str | None, branch: str | None):
    """Fetch and integrate changes."""
    args = ["pull"]

    if remote:
        args.append(remote)

    if branch:
        args.append(branch)

    ensure_credential_helper()
    _run_git(args)


@click.command("fetch")
@click.argument("remote", required=False)
def fetch(remote: str | None):
    """Download objects and refs from a remote."""
    args = ["fetch"]

    if remote:
        args.append(remote)

    ensure_credential_helper()
    _run_git(args)


@click.command("branch")
@click.argument("name", required=False)
@click.option("-a", "--all", "show_all", is_flag=True, help="Show local and remote branches.")
@click.option("-r", "--remote", "show_remote", is_flag=True, help="Show remote branches.")
@click.option("-d", "--delete", is_flag=True, help="Delete a branch.")
def branch(name: str | None, show_all: bool, show_remote: bool, delete: bool):
    """List, create, or delete branches."""
    args = ["branch"]

    if show_all:
        args.append("--all")

    if show_remote:
        args.append("--remotes")

    if delete:
        args.append("--delete")

    if name:
        args.append(name)

    _run_git(args)


@click.command("switch")
@click.argument("branch_name", required=False)
@click.option(
    "-c",
    "--create",
    "create_branch",
    is_flag=True,
    help="Create and switch to a new branch.",
)
def switch(branch_name: str | None, create_branch: bool):
    """Switch branches."""
    args = ["switch"]

    if create_branch:
        args.append("--create")

    if branch_name:
        args.append(branch_name)

    _run_git(args)


@click.command("merge")
@click.argument("branch_name")
def merge(branch_name: str):
    """Merge a branch into the current branch."""
    _run_git(["merge", branch_name])


@click.command("log")
@click.option("--oneline", is_flag=True, help="Condensed commit history.")
@click.option("--limit", type=int, default=None, help="Maximum number of commits.")
def log(oneline: bool, limit: int | None):
    """Show commit history."""
    args = ["log"]

    if oneline:
        args.append("--oneline")

    if limit is not None:
        args.extend(["-n", str(limit)])

    _run_git(args)


@click.command("diff")
@click.argument("paths", nargs=-1)
def diff(paths: tuple[str, ...]):
    """Show changes between commits, files, or the working tree."""
    _run_git(["diff", *paths])


@click.command("remote")
@click.option("-v", "--verbose", is_flag=True, help="Show remote URLs.")
def remote(verbose: bool):
    """Show configured Git remotes."""
    args = ["remote"]

    if verbose:
        args.append("-v")

    _run_git(args)


@click.command("tag")
@click.argument("name", required=False)
@click.option("-l", "--list", "list_tags", is_flag=True, help="List tags.")
def tag(name: str | None, list_tags: bool):
    """Create or list Git tags."""
    args = ["tag"]

    if list_tags:
        args.append("--list")
        if name:
            args.append(name)
    elif name:
        args.append(name)

    _run_git(args)


@click.command("stash")
@click.argument("action", required=False)
@click.argument("args", nargs=-1)
def stash(action: str | None, args: tuple[str, ...]):
    """Save or restore uncommitted changes."""
    command = ["stash"]

    if action:
        command.append(action)

    command.extend(args)

    _run_git(command)


@click.command("restore")
@click.argument("paths", nargs=-1, required=True)
def restore(paths: tuple[str, ...]):
    """Restore working-tree files."""
    _run_git(["restore", *paths])


# ---------------------------------------------------------------------------
# Internal Git credential helper
# ---------------------------------------------------------------------------

@click.command("git-credential", hidden=True)
@click.argument("action")
def git_credential(action: str):
    """Git credential helper for PandaHub."""
    if action != "get":
        return

    username = config.get_username()
    token = config.get_git_token()

    if not username or not token:
        return

    click.echo("protocol=https")
    click.echo(f"host={GIT_HOST}")
    click.echo(f"username={username}")
    click.echo(f"password={token}")