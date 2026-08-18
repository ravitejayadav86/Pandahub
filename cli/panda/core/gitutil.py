"""panda.core.gitutil - Shared git-hosting helpers (host, URL building, credential helper setup)."""
from __future__ import annotations

import subprocess
import sys

GIT_HOST = "pandahub-taupe.vercel.app"


def build_repo_url(owner: str, repo_name: str) -> str:
    return f"https://{GIT_HOST}/git/{owner}/{repo_name}.git"


def ensure_credential_helper() -> None:
    """
    Register `panda` as git's credential helper for the PandaHub host.

    Uses the ABSOLUTE path to the currently-running panda.exe (sys.argv[0])
    rather than relying on `panda` being resolvable via PATH. Git spawns its
    own subprocess (a bundled sh.exe) to run credential helpers, and that
    subprocess does NOT inherit PowerShell profile functions or aliases -
    only real PATH entries. Since panda's own PATH entry has proven
    unreliable across terminal sessions, we sidestep the problem entirely
    by baking in the exact executable path.

    Best-effort: silently does nothing if git isn't installed.
    """
    panda_exe = sys.argv[0].replace("\\", "/")
    helper_cmd = f'!\'{panda_exe}\' git-credential'

    try:
        subprocess.run(
            [
                "git", "config", "--global",
                f"credential.https://{GIT_HOST}.helper",
                helper_cmd,
            ],
            check=False,
            capture_output=True,
        )
    except FileNotFoundError:
        pass