"""panda.core.gitutil - Shared git-hosting helpers (host, URL building, credential helper setup)."""
from __future__ import annotations

import subprocess

GIT_HOST = "pandahub.onrender.com"


def build_repo_url(owner: str, repo_name: str) -> str:
    return f"https://{GIT_HOST}/git/{owner}/{repo_name}.git"


def ensure_credential_helper() -> None:
    """
    Register `panda` as git's credential helper for the PandaHub host.

    After this, any plain `git clone/push/pull` against pandahub.onrender.com
    automatically authenticates via `panda git-credential` - no token ever
    needs to be typed or pasted by the user.

    Best-effort: silently does nothing if git isn't installed.
    """
    try:
        subprocess.run(
            [
                "git", "config", "--global",
                f"credential.https://{GIT_HOST}.helper",
                "!panda git-credential",
            ],
            check=False,
            capture_output=True,
        )
    except FileNotFoundError:
        pass