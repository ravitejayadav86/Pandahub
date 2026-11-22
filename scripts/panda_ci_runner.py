#!/usr/bin/env python3
"""Development-only PandaHub native CI worker.

Runs in a *separate host process*, never FastAPI/Celery. The Docker daemon
is accessed only on the host; untrusted code is mounted read-only inside a
restricted, network-disabled container with no secrets or Docker socket.

This is a local MVP, NOT a hardened multi-tenant sandbox or release gate.
Run against disposable repositories only. Image must be pulled deliberately.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

IMAGE = "python:3.12-slim"
MAX_FILES = 1000
MAX_BYTES = 20 * 1024 * 1024
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_LOG = 9000
TIMEOUT_SECONDS = 120

PYTHON_TEST_SCRIPT = r"""
import ast
from pathlib import Path
import sys
import unittest

root = Path("/workspace")
files = sorted(root.rglob("*.py"))
if not files:
    print("FAIL: no Python source files", flush=True)
    sys.exit(5)
for path in files:
    ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
print(f"PASS: parsed {len(files)} Python file(s)", flush=True)

tests = root / "tests"
if not tests.is_dir():
    tests = root
sys.path.insert(0, str(root))
sys.path.insert(0, str(tests))
suite = unittest.defaultTestLoader.discover(
    start_dir=str(tests), pattern="test*.py",
)
count = suite.countTestCases()
print(f"Discovered {count} test(s)", flush=True)
if count == 0:
    print("FAIL: no tests collected", flush=True)
    sys.exit(5)
outcome = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if outcome.wasSuccessful() else 1)
"""


class RunnerError(RuntimeError):
    pass


def api_call(base: str, token: str, method: str, path: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": "Bearer " + token}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = Request(base + path, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RunnerError(f"CI API {method} failed (HTTP {exc.code})") from None
    except URLError as exc:
        raise RunnerError("Local PandaHub API unavailable") from None


def checked(command: list[str], *, timeout: int = 40, env=None) -> bytes:
    try:
        result = subprocess.run(
            command, check=False, capture_output=True, timeout=timeout, env=env,
        )
    except subprocess.TimeoutExpired:
        raise RunnerError("Git operation timed out") from None
    if result.returncode:
        raise RunnerError(f"Git/Docker operation failed (exit {result.returncode})")
    return result.stdout


def extract_archive(repo: Path, sha: str, destination: Path) -> None:
    """Export Git blobs without checkout hooks, smudge filters or tar links."""
    process = subprocess.Popen(
        ["git", "-C", str(repo), "archive", "--format=tar", sha],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    size = 0
    count = 0
    try:
        assert process.stdout is not None
        with tarfile.open(fileobj=process.stdout, mode="r|") as archive:
            for member in archive:
                if member.isdir():
                    continue
                if not member.isfile():
                    raise RunnerError("Repository contains a link or unsupported archive entry")
                name = PurePosixPath(member.name)
                if (
                    name.is_absolute() or ".." in name.parts or
                    "\\" in member.name or ":" in member.name or
                    ".git" in name.parts or not name.parts
                ):
                    raise RunnerError("Unsafe repository path")
                count += 1
                size += member.size
                if count > MAX_FILES or size > MAX_BYTES or member.size > MAX_FILE_BYTES:
                    raise RunnerError("Repository exceeds local CI size limit")
                target = destination.joinpath(*name.parts)
                if not target.resolve().is_relative_to(destination.resolve()):
                    raise RunnerError("Archive path escapes workspace")
                target.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    raise RunnerError("Could not read Git archive entry")
                with source, target.open("wb") as output:
                    remaining = member.size
                    while remaining:
                        block = source.read(min(65536, remaining))
                        if not block:
                            raise RunnerError("Incomplete Git archive")
                        output.write(block)
                        remaining -= len(block)
        if process.wait(timeout=30) != 0:
            raise RunnerError("Could not export commit")
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()


def _docker_command(workspace: Path, name: str) -> list[str]:
    """Construct a bounded local sandbox; pure to allow security assertions."""
    return [
        "docker", "run", "--rm", "--pull=never", "--name", name,
        "--network", "none", "--read-only", "--cap-drop=ALL",
        "--security-opt", "no-new-privileges:true",
        "--pids-limit", "64", "--memory", "512m", "--cpus", "1",
        "--user", "65534:65534", "--workdir", "/workspace",
        "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
        "--mount", f"type=bind,src={workspace.resolve()},dst=/workspace,readonly",
        "--env", "PYTHONDONTWRITEBYTECODE=1",
        IMAGE, "python", "-I", "-B", "-c", PYTHON_TEST_SCRIPT,
    ]


def _force_remove_container(name: str) -> bool:
    """Best-effort Docker daemon cleanup. Do not claim timeout if unconfirmed."""
    try:
        result = subprocess.run(
            ["docker", "rm", "-f", name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=20,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def run_docker(workspace: Path) -> tuple[str, str]:
    checked(["docker", "image", "inspect", IMAGE], timeout=15)
    name = "pandahub-ci-" + secrets.token_hex(6)
    cmd = _docker_command(workspace, name)
    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
    except OSError:
        raise RunnerError("Docker CLI is unavailable") from None

    output = bytearray()
    def consume():
        assert process.stdout is not None
        while True:
            chunk = process.stdout.read(8192)
            if not chunk:
                break
            if len(output) < MAX_LOG:
                output.extend(chunk[:MAX_LOG - len(output)])

    thread = threading.Thread(target=consume, daemon=True)
    thread.start()
    timed_out = False
    cleanup_confirmed = False
    try:
        process.wait(timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            cleanup_confirmed = _force_remove_container(name)
        finally:
            # A failed or blocked Docker daemon must not leave this host
            # process waiting forever. The container may still be alive.
            if process.poll() is None:
                process.kill()
            process.wait()
    except BaseException:
        _force_remove_container(name)
        if process.poll() is None:
            process.kill()
        process.wait()
        raise
    finally:
        thread.join(timeout=5)

    text = output.decode("utf-8", errors="replace")
    if len(output) == MAX_LOG:
        text += "\n[Output truncated]"
    if timed_out:
        if not cleanup_confirmed:
            return (
                "error",
                text + "\nContainer cleanup could not be confirmed. "
                "Inspect Docker on the runner host before starting another CI job.",
            )
        return "timed_out", text + "\nCI container exceeded time limit; Docker removal confirmed"
    return ("success" if process.returncode == 0 else "failure"), text


def process_one(base: str, token: str, spec: str, run: dict) -> None:
    branch = run["branch"]
    sha = run["sha"]
    run_id = run["id"]
    if (
        not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,200}", branch)
        or ".." in branch or "//" in branch
        or branch.endswith("/") or branch.endswith(".lock")
        or not re.fullmatch(r"[0-9a-f]{40}", sha)
    ):
        raise RunnerError("Unsafe CI branch/SHA from API")

    path = "/" + "/".join(quote(s, safe="") for s in spec.split("/")) + "/ci/runs/" + run_id
    api_call(base, token, "POST", path + "/claim")
    outcome, logs = "error", "CI runner did not complete"
    try:
        with tempfile.TemporaryDirectory(prefix="pandahub-ci-") as tmp:
            root = Path(tmp)
            checkout = root / "git"
            workspace = root / "source"
            workspace.mkdir()
            git_url = f"http://localhost:8000/git/{spec}.git"
            env = dict(os.environ)
            env["GIT_TERMINAL_PROMPT"] = "0"
            # --no-checkout: no worktree content, hooks or smudge filters on host.
            checked([
                "git", "-c", "init.templateDir=", "clone",
                "--no-checkout", "--single-branch", "--depth=1",
                "--branch", branch, git_url, str(checkout),
            ], timeout=45, env=env)
            head = checked(
                ["git", "-C", str(checkout), "rev-parse", "HEAD"], env=env,
            ).decode().strip()
            if head != sha:
                raise RunnerError("Branch tip moved; refusing to test a different SHA")
            extract_archive(checkout, sha, workspace)
            outcome, logs = run_docker(workspace)
    except RunnerError as exc:
        outcome, logs = "error", str(exc)
    except Exception as exc:
        outcome, logs = "error", f"Runner error ({type(exc).__name__})"

    api_call(base, token, "POST", path + "/complete", {
        "conclusion": outcome,
        "log_excerpt": logs[:10000],
    })
    print(f"CI {run_id}: {outcome} for {sha[:12]}")
    if logs:
        print(logs[:1600])


def main() -> int:
    parser = argparse.ArgumentParser(description="Local, advisory PandaHub CI runner")
    parser.add_argument("--repo", required=True, help="OWNER/REPO")
    parser.add_argument("--watch", action="store_true", help="Poll for new queued runs")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repo):
        parser.error("--repo must be OWNER/REPO")
    config_path = Path.home() / ".pandahub" / "config.json"
    if not config_path.exists():
        parser.error("Log in via panda login first")
    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    base = str(cfg.get("api_base_url") or "").rstrip("/")
    parsed = urlparse(base)
    if (
        parsed.scheme != "http" or parsed.hostname not in ("localhost", "127.0.0.1")
        or parsed.port != 8000 or parsed.path != "/api/v1"
    ):
        parser.error("MVP runner allows ONLY http://localhost:8000/api/v1")
    token = cfg.get("access_token")
    if not token:
        parser.error("No PandaHub CLI session; run panda login")
    prefix = "/" + "/".join(quote(s, safe="") for s in args.repo.split("/"))
    print("PandaHub local CI runner: network-disabled Docker execution; advisory only.")
    print("Only run against disposable repos. Stop --watch with Ctrl+C.")
    try:
        while True:
            rows = api_call(base, token, "GET", prefix + "/ci/runs?limit=100")
            queued = [r for r in rows if r["status"] == "queued"]
            if queued:
                # Oldest first, no unexpected parallel execution.
                process_one(base, token, args.repo, queued[-1])
            elif not args.watch:
                print("No queued CI jobs.")
            if not args.watch:
                break
            time.sleep(5)
    except KeyboardInterrupt:
        print("Runner stopped.")
    except RunnerError as exc:
        print(f"CI runner: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
