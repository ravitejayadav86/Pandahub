"""PandaHub Git hosting helpers."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

# Derive the Git host from the same env var as the API client so they stay
# in sync: PANDAHUB_API_URL=http://localhost:8000/api/v1  →  localhost:8000
def _derive_git_host() -> str:
    api_url = os.environ.get("PANDAHUB_API_URL", "http://localhost:8000/api/v1")
    parsed = urlparse(api_url)
    host = parsed.hostname or "localhost"
    port = parsed.port
    if port and port not in (80, 443):
        return f"{host}:{port}"
    return host

GIT_HOST = _derive_git_host()


def build_repo_url(owner: str, repo_name: str) -> str:
    """Build the HTTPS Git URL for a PandaHub repository."""
    return f"https://{GIT_HOST}/git/{owner}/{repo_name}.git"


def _get_panda_command() -> str:
    """
    Return a command Git can execute for the PandaHub credential helper.

    Prefer the actual running executable. On Windows, sys.executable is
    the Python interpreter, so when the CLI is installed as a console
    script we prefer sys.argv[0].
    """
    candidate = Path(sys.argv[0]).resolve()

    if candidate.exists():
        return str(candidate).replace("\\", "/")

    return "panda"


def ensure_credential_helper() -> None:
    """
    Configure Git to use PandaHub's credential helper.

    Git will invoke:

        panda git-credential get

    whenever it needs credentials for pandahub-taupe.vercel.app.
    """
    panda_command = _get_panda_command()

    # Git's `!` credential helper syntax executes a shell command.
    #
    # Use double quotes around the executable so paths containing spaces
    # (for example under AppData or Program Files) continue to work.
    helper_command = f'!"{panda_command}" git-credential'

    try:
        result = subprocess.run(
            [
                "git",
                "config",
                "--global",
                f"credential.https://{GIT_HOST}.helper",
                helper_command,
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            return

    except (FileNotFoundError, OSError):
        return


def credential_helper_configured() -> bool:
    """Return True when PandaHub's Git credential helper is configured."""
    try:
        result = subprocess.run(
            [
                "git",
                "config",
                "--global",
                "--get",
                f"credential.https://{GIT_HOST}.helper",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0 and bool(result.stdout.strip())
    except (FileNotFoundError, OSError):
        return False


def remove_credential_helper() -> None:
    """Remove PandaHub's Git credential helper configuration."""
    try:
        subprocess.run(
            [
                "git",
                "config",
                "--global",
                "--unset-all",
                f"credential.https://{GIT_HOST}.helper",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except (FileNotFoundError, OSError):
        pass