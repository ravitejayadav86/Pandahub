"""Safety regression tests for the separate local Docker CI runner."""
from __future__ import annotations

import importlib.util
import io
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
