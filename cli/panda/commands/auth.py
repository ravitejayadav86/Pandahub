"""panda.commands.auth — login, logout, whoami, and PAT management."""
from __future__ import annotations

import getpass

import click

from panda.core import config
from panda.core.api_client import ApiError, request
from panda.core.gitutil import GIT_HOST, ensure_credential_helper


@click.command()
@click.option("--username", "-u", default=None, help="Username or email")
def login(username: str | None):
    """Log in to PandaHub and save your session locally."""
    if username is None:
        username = click.prompt("Username or email")

    password = getpass.getpass("Password: ")

    try:
        data = request(
            "POST",
            "/auth/login",
            json_body={
                "username_or_email": username,
                "password": password,
            },
            auth_required=False,
        )
    except ApiError as exc:
        click.secho(f"Login failed: {exc.detail}", fg="red")
        raise SystemExit(1)

    if data.get("requires_2fa"):
        totp_code = click.prompt("Two-factor code")

        try:
            data = request(
                "POST",
                "/auth/login/2fa",
                json_body={
                    "challenge_token": data["challenge_token"],
                    "totp_code": totp_code,
                },
                auth_required=False,
            )
        except ApiError as exc:
            click.secho(
                f"Two-factor verification failed: {exc.detail}",
                fg="red",
            )
            raise SystemExit(1)

    config.save_tokens(
        data["access_token"],
        data["refresh_token"],
        username,
    )

    ensure_credential_helper()

    click.secho(
        f"Logged in as {username}.",
        fg="green",
    )
    click.secho(
        "Git is now configured to auto-authenticate with PandaHub.",
        fg="cyan",
    )


@click.command()
def logout():
    """Log out and clear your local session."""
    refresh_token = config.get_refresh_token()

    if refresh_token:
        try:
            request(
                "POST",
                "/auth/logout",
                json_body={"refresh_token": refresh_token},
                auth_required=False,
            )
        except ApiError:
            pass

    config.clear_tokens()
    click.secho("Logged out.", fg="green")


@click.command()
def whoami():
    """Show the currently logged-in user."""
    if not config.is_logged_in():
        click.secho(
            "Not logged in. Run `panda login`.",
            fg="yellow",
        )
        raise SystemExit(1)

    try:
        me = request("GET", "/auth/me")
    except ApiError as exc:
        click.secho(f"Error: {exc.detail}", fg="red")
        raise SystemExit(1)

    click.echo(
        f"Logged in as: {me['username']} ({me['email']})"
    )


@click.group()
def token():
    """Manage Personal Access Tokens."""


@token.command("create")
@click.argument("name")
@click.option(
    "--scopes",
    default="repo",
    help="Comma-separated scopes",
)
@click.option(
    "--expires-in-days",
    type=int,
    default=None,
    help="Days until expiry",
)
def token_create(
    name: str,
    scopes: str,
    expires_in_days: int | None,
):
    """Create a new Personal Access Token."""
    try:
        data = request(
            "POST",
            "/auth/tokens",
            json_body={
                "name": name,
                "scopes": [s.strip() for s in scopes.split(",")],
                "expires_in_days": expires_in_days,
            },
        )
    except ApiError as exc:
        click.secho(
            f"Error: {exc.detail}",
            fg="red",
        )
        raise SystemExit(1)

    token_value = data.get("token")

    if not token_value:
        click.secho(
            "Token was created, but the server did not return its value.",
            fg="red",
        )
        raise SystemExit(1)

    # Save the PAT locally so the PandaHub Git credential helper
    # can authenticate Git clone/fetch/push/pull operations.
    config.save_git_token(token_value)

    click.secho(
        "Token created — saved for PandaHub Git authentication.",
        fg="green",
    )

    click.echo()
    click.secho("Token:", fg="yellow")
    click.echo(token_value)

    username = config.get_username() or "<username>"

    click.echo()
    click.echo("Git URL format:")
    click.echo(
        f"  https://{username}:<TOKEN>@"
        f"{GIT_HOST}/git/{username}/<repo-name>.git"
    )


@token.command("list")
def token_list():
    """List your active Personal Access Tokens."""
    try:
        tokens = request("GET", "/auth/tokens")
    except ApiError as exc:
        click.secho(
            f"Error: {exc.detail}",
            fg="red",
        )
        raise SystemExit(1)

    if not tokens:
        click.echo("No tokens found.")
        return

    for item in tokens:
        token_status = (
            "revoked"
            if item["revoked"]
            else "active"
        )
        expires = item["expires_at"] or "never"

        click.echo(
            f"  {item['id']}  "
            f"{item['name']:<20} "
            f"[{token_status}]  "
            f"expires: {expires}"
        )


@token.command("revoke")
@click.argument("token_id")
def token_revoke(token_id: str):
    """Revoke a Personal Access Token by its ID."""
    try:
        request(
            "DELETE",
            f"/auth/tokens/{token_id}",
        )
    except ApiError as exc:
        click.secho(
            f"Error: {exc.detail}",
            fg="red",
        )
        raise SystemExit(1)

    click.secho(
        "Token revoked.",
        fg="green",
    )