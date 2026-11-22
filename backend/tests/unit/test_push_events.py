"""Post-push events reflect actual changed refs, never fabricated status strings."""
import subprocess

from app.git_engine.push_events import changed_ref_lines, snapshot_refs

ZERO = "0" * 40
A = "a" * 40
B = "b" * 40


def test_new_commit_and_deleted_branch():
    result = changed_ref_lines(
        {"refs/heads/main": A, "refs/heads/old": A},
        {"refs/heads/main": B, "refs/heads/feature": A},
    )
    assert f"{A} {B} refs/heads/main" in result
    assert f"{ZERO} {A} refs/heads/feature" in result
    assert f"{A} {ZERO} refs/heads/old" in result
    assert len(result.splitlines()) == 3


def test_no_change_or_invalid_sha_is_ignored():
    assert changed_ref_lines({"refs/heads/main": A}, {"refs/heads/main": A}) == ""
    assert changed_ref_lines({"refs/heads/main": "garbage"}, {"refs/heads/main": B}) == ""
    assert changed_ref_lines({}, {"refs/other/ignored": A}) == ""


def test_real_bare_repo_snapshot(tmp_path):
    bare = tmp_path / "example.git"
    subprocess.run(["git", "init", "--bare", "-q", str(bare)], check=True)
    assert snapshot_refs(str(bare)) == {}
