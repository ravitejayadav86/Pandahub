"""Safety regression tests for the separate local Docker CI runner."""
from __future__ import annotations

import importlib.util
import io
import subprocess
from pathlib import Path
import tarfile
from unittest.mock import patch

import pytest


@pytest.fixture(scope="module")
def runner():
    path = Path(__file__).resolve().parents[3] / "scripts" / "panda_ci_runner.py"
    spec = importlib.util.spec_from_file_location("panda_ci_runner", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_docker_command_has_no_network_docker_socket_or_secrets(runner, tmp_path):
    args = runner._docker_command(tmp_path, "ci-safe")
    assert args[:2] == ["docker", "run"]
    assert args[args.index("--network") + 1] == "none"
    assert "--read-only" in args
    assert "--cap-drop=ALL" in args
    assert "no-new-privileges:true" in args
    assert args[args.index("--user") + 1] == "65534:65534"
    assert args[args.index("--pids-limit") + 1] == "64"
    assert "--memory" in args and "--cpus" in args
    assert "--pull=never" in args
    mount = args[args.index("--mount") + 1]
    assert "readonly" in mount
    assert "/var/run/docker.sock" not in " ".join(args)
    assert "OPENROUTER_API_KEY" not in " ".join(args)
    assert "access_token" not in " ".join(args)
    assert "JWT_SECRET_KEY" not in " ".join(args)


class FakeGitArchive:
    def __init__(self, content):
        self.stdout = io.BytesIO(content)

    def poll(self):
        return 0

    def wait(self, timeout=None):
        return 0

    def kill(self):
        pass


def _tar_file(name, content=b"ok", *, kind=tarfile.REGTYPE, link=""):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w") as archive:
        item = tarfile.TarInfo(name=name)
        item.type = kind
        item.linkname = link
        item.size = len(content) if kind == tarfile.REGTYPE else 0
        archive.addfile(item, io.BytesIO(content))
    return stream.getvalue()


def test_extract_archive_allows_regular_file_without_checkout(runner, tmp_path):
    source = _tar_file("tests/test_sample.py", b"pass\n")
    with patch.object(runner.subprocess, "Popen", return_value=FakeGitArchive(source)):
        runner.extract_archive(tmp_path, "a" * 40, tmp_path)
    assert (tmp_path / "tests" / "test_sample.py").read_bytes() == b"pass\n"


@pytest.mark.parametrize("member,kind,link", [
    ("../outside.py", tarfile.REGTYPE, ""),
    ("nested/../../outside.py", tarfile.REGTYPE, ""),
    ("hostlink", tarfile.SYMTYPE, "/etc/passwd"),
    ("hardlink", tarfile.LNKTYPE, "/etc/passwd"),
])
def test_extract_archive_rejects_unsafe_entries(
    runner, tmp_path, member, kind, link,
):
    source = _tar_file(member, kind=kind, link=link)
    with patch.object(runner.subprocess, "Popen", return_value=FakeGitArchive(source)):
        with pytest.raises(runner.RunnerError):
            runner.extract_archive(tmp_path, "a" * 40, tmp_path)


class SimulatedStuckDocker:
    """Fake Docker CLI process; no actual container or network is started."""
    def __init__(self):
        self.stdout = io.BytesIO(b"partial test output")
        self.returncode = None
        self.alive = True
        self.killed = False

    def wait(self, timeout=None):
        if self.alive and timeout is not None:
            raise subprocess.TimeoutExpired(cmd="docker run", timeout=timeout)
        return self.returncode

    def poll(self):
        return None if self.alive else self.returncode

    def kill(self):
        self.killed = True
        self.alive = False
        self.returncode = -9


@pytest.mark.parametrize("cleanup_confirmed,expected", [
    (True, "timed_out"),
    (False, "error"),
])
def test_stuck_docker_always_kills_client_and_fails_closed(
    runner, tmp_path, cleanup_confirmed, expected,
):
    process = SimulatedStuckDocker()
    with patch.object(runner, "checked", return_value=b""), \
         patch.object(runner.subprocess, "Popen", return_value=process), \
         patch.object(runner, "_force_remove_container", return_value=cleanup_confirmed) as stop:
        outcome, message = runner.run_docker(tmp_path)
    assert outcome == expected
    assert process.killed is True
    stop.assert_called_once()
    if cleanup_confirmed:
        assert "removal confirmed" in message
    else:
        assert "cleanup could not be confirmed" in message


def test_container_cleanup_failure_is_not_a_success(runner):
    with patch.object(
        runner.subprocess, "run",
        return_value=subprocess.CompletedProcess(["docker"], returncode=1),
    ):
        assert runner._force_remove_container("test-job") is False
    with patch.object(
        runner.subprocess, "run",
        side_effect=subprocess.TimeoutExpired(cmd="docker rm", timeout=20),
    ):
        assert runner._force_remove_container("test-job") is False
