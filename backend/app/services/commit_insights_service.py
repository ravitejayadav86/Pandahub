"""Generate bounded, evidence-based diffs and source-linked next-step actions."""
from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
ZERO_SHA = "0" * 40
MAX_DIFF_CHARS = 24_000


def read_commit_diff(disk_path: str, sha: str, base_sha: str | None) -> tuple[str, bool]:
    """Read a Git diff without evaluating, checking out, or executing source code.

    Returns (diff, truncated). A new branch is reviewed against the commit's
    first parent using ``show`` rather than the entire potentially huge tree.
    """
    if not SHA_RE.fullmatch(sha) or (base_sha and not SHA_RE.fullmatch(base_sha)):
        raise ValueError("Invalid Git object ID")
    if not Path(disk_path).is_dir():
        raise FileNotFoundError("Git repository storage is not available")

    cmd = ["git", "--git-dir", disk_path]
    if base_sha and base_sha != ZERO_SHA:
        cmd += ["diff", "--no-ext-diff", "--no-textconv", base_sha, sha, "--"]
    else:
        cmd += ["show", "--format=", "--no-ext-diff", "--no-textconv", sha, "--"]

    # Spool output instead of accumulating unbounded bytes in Python RAM.
    with tempfile.TemporaryFile(mode="w+b") as output:
        result = subprocess.run(cmd, stdout=output, stderr=subprocess.DEVNULL,
                                check=False, timeout=30)
        if result.returncode:
            raise RuntimeError("Git could not calculate the commit diff")
        output.seek(0)
        raw = output.read(MAX_DIFF_CHARS * 4 + 4)
        truncated = bool(output.read(1))

    diff = raw.decode("utf-8", errors="replace")
    if len(diff) > MAX_DIFF_CHARS:
        diff = diff[:MAX_DIFF_CHARS]
        truncated = True
    return diff, truncated


_SECRET_PATTERNS = (
    re.compile(r"(?i)sk-or-v1-[a-z0-9_-]{12,}"),
    re.compile(r"(?i)sk-ant-[a-z0-9_-]{12,}"),
    re.compile(r"(?i)github_pat_[a-z0-9_]{20,}"),
    re.compile(r"(?i)ghp_[a-z0-9]{20,}"),
    re.compile(r"(?i)bearer\s+[a-z0-9._-]{16,}"),
    re.compile(r"(?i)AKIA[A-Z0-9]{16}"),
    re.compile(r"(?i)([\"']?(?:api_key|secret_key|access_token|password|private_key)[\"']?\s*[:=]\s*)[\"']?[^\s,\"']{8,}"),
)


def redact_common_secrets(text: str) -> str:
    """Best-effort defense-in-depth; never replaces the repository owner's consent."""
    text = re.sub(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
                  "[REDACTED PRIVATE KEY]", text, flags=re.DOTALL)
    for pattern in _SECRET_PATTERNS:
        if pattern.groups:
            text = pattern.sub(lambda match: match.group(1) + "[REDACTED]", text)
        else:
            text = pattern.sub("[REDACTED]", text)
    return text


def next_steps_from_suggestions(suggestions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Preserve only actual provider suggestions; never invent findings or scores."""
    result: list[dict[str, Any]] = []
    for item in suggestions[:30]:
        if not isinstance(item, dict):
            continue
        action = item.get("comment", "")
        if not isinstance(action, str) or not action.strip():
            continue
        severity = str(item.get("severity") or "medium").lower()
        if severity not in {"critical", "high", "medium", "low"}:
            severity = "medium"
        result.append({
            "action": action.strip()[:1200],
            "file": str(item.get("file") or "")[:255],
            "priority": severity,
            "source": "ai_review",
            "verified": False,
        })
    return result
