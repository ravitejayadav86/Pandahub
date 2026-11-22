"""Tests use actual Git objects and deterministic logic, never mocked AI scores."""
import subprocess
from pathlib import Path

import pytest
from app.services.commit_insights_service import (
    next_steps_from_suggestions, read_commit_diff, redact_common_secrets,
)


def _git(*args, cwd):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def test_real_bare_repository_commit_diff(tmp_path):
    work = tmp_path / "work"
    bare = tmp_path / "remote.git"
    work.mkdir()
    subprocess.run(["git", "init", "-q", str(work)], check=True)
    subprocess.run(["git", "init", "--bare", "-q", str(bare)], check=True)
    _git("config", "user.email", "tester@example.com", cwd=work)
    _git("config", "user.name", "QA Tester", cwd=work)
    (work / "test.py").write_text("x = 1\n")
    _git("add", ".", cwd=work)
    _git("commit", "-qm", "Add x", cwd=work)
    first = _git("rev-parse", "HEAD", cwd=work)
    (work / "test.py").write_text("x = 2\n")
    _git("commit", "-qam", "Change x", cwd=work)
    second = _git("rev-parse", "HEAD", cwd=work)
    _git("remote", "add", "pandahub", str(bare), cwd=work)
    _git("push", "-q", "pandahub", "HEAD:refs/heads/main", cwd=work)
    initial_diff, incomplete = read_commit_diff(str(bare), first, None)
    assert "+x = 1" in initial_diff
    assert not incomplete
    update, incomplete = read_commit_diff(str(bare), second, first)
    assert "-x = 1" in update
    assert "+x = 2" in update
    assert not incomplete


def test_git_sha_validated_before_git_invocation(tmp_path):
    with pytest.raises(ValueError, match="Invalid Git object ID"):
        read_commit_diff(str(tmp_path), "--upload-pack=bad", "0" * 40)


def test_redaction_hides_common_provider_credentials():
    text = "token: sk-or-v1-" + "x" * 30 + "\npassword = very_secret_password"
    result = redact_common_secrets(text)
    assert "sk-or-v1-" not in result
    assert "very_secret_password" not in result
    assert "[REDACTED]" in result


def test_next_steps_derive_only_from_actual_provider_comments():
    result = next_steps_from_suggestions([
        {"file": "auth.py", "severity": "high", "comment": "Add expiry checks."},
        {"file": "tmp.py", "severity": "low", "comment": ""},
    ])
    assert result == [{
        "file": "auth.py", "priority": "high", "action": "Add expiry checks.",
        "source": "ai_review", "verified": False,
    }]
    assert next_steps_from_suggestions([]) == []
