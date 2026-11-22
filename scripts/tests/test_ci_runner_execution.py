"""Real Docker CI smoke matrix: PASS / FAIL / NO TESTS.

Runs only when PANDAHUB_RUN_CI_DOCKER_TESTS=1, inside an ephemeral GitHub
Actions VM. No PandaHub server, credentials, or live repositories are used.
The exact development runner's constrained Docker command is tested.
"""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "panda_ci_runner.py"
SPEC = importlib.util.spec_from_file_location("panda_ci_runner_live", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


@unittest.skipUnless(
    os.getenv("PANDAHUB_RUN_CI_DOCKER_TESTS") == "1",
    "Real isolated Docker runner smoke tests are opt-in",
)
class RealDockerRunnerTests(unittest.TestCase):
    def _workspace(self, source: dict[str, str]) -> tuple[tempfile.TemporaryDirectory, Path]:
        tmp = tempfile.TemporaryDirectory(prefix="ph-ci-live-")
        workspace = Path(tmp.name) / "source"
        workspace.mkdir(mode=0o755)
        for rel, contents in source.items():
            path = workspace / rel
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            path.write_text(contents, encoding="utf-8")
        return tmp, workspace

    def test_real_pass_is_reported_as_success(self):
        tmp, root = self._workspace({
            "app.py": "def add(a, b):\n    return a + b\n",
            "tests/test_app.py": (
                "import unittest\n"
                "from app import add\n"
                "class PositiveTests(unittest.TestCase):\n"
                "    def test_add(self):\n"
                "        self.assertEqual(add(2, 3), 5)\n"
            ),
        })
        with tmp:
            status, logs = runner.run_docker(root)
        self.assertEqual(status, "success", logs)
        self.assertIn("Ran 1 test", logs)
        self.assertIn("OK", logs)

    def test_real_failing_assertion_cannot_become_success(self):
        tmp, root = self._workspace({
            "app.py": "value = 1\n",
            "tests/test_app.py": (
                "import unittest\n"
                "class NegativeTests(unittest.TestCase):\n"
                "    def test_reject(self):\n"
                "        self.assertEqual(1, 2)\n"
            ),
        })
        with tmp:
            status, logs = runner.run_docker(root)
        self.assertEqual(status, "failure", logs)
        self.assertIn("FAILED", logs)

    def test_empty_suite_is_a_failure_not_a_pass(self):
        tmp, root = self._workspace({"app.py": "value = 1\n"})
        with tmp:
            status, logs = runner.run_docker(root)
        self.assertEqual(status, "failure", logs)
        self.assertIn("no tests collected", logs)
