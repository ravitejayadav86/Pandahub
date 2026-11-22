"""Capture actual Git ref changes after smart-HTTP pushes, not diagnostic stderr."""
from __future__ import annotations

import re
import subprocess
from typing import Mapping

_ZERO_SHA = "0" * 40
_SHA = re.compile(r"^[0-9a-f]{40}$")


def snapshot_refs(disk_path: str) -> dict[str, str]:
    """Read branch/tag tips from a bare Git repository (no user code execution)."""
    process = subprocess.run(
        ["git", "--git-dir", disk_path, "for-each-ref",
         "--format=%(objectname) %(refname)", "refs/heads/", "refs/tags/"],
        capture_output=True, text=True, check=True, timeout=15,
    )
    refs: dict[str, str] = {}
    for line in process.stdout.splitlines():
        try:
            sha, name = line.split(" ", 1)
        except ValueError:
            continue
        if _SHA.fullmatch(sha) and name.startswith(("refs/heads/", "refs/tags/")):
            refs[name] = sha
    return refs


def changed_ref_lines(before: Mapping[str, str], after: Mapping[str, str]) -> str:
    """Return validated updates in the existing ``parse_receive_pack_output`` format.

    Includes new/deleted branches and force pushes. No change means no event.
    """
    rows: list[str] = []
    for name in sorted(before.keys() | after.keys()):
        if not name.startswith(("refs/heads/", "refs/tags/")):
            continue
        old, new = before.get(name, _ZERO_SHA), after.get(name, _ZERO_SHA)
        if old == new:
            continue
        if not (_SHA.fullmatch(old) and _SHA.fullmatch(new)):
            continue
        rows.append(f"{old} {new} {name}")
    return "\n".join(rows)
