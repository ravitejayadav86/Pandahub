"""Guardrail tests for applying the CI dashboard to an existing worktree."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "install_ci_dashboard.py"
SPEC = importlib.util.spec_from_file_location("ci_dashboard_installer", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class DashboardInstallerTests(unittest.TestCase):
    def test_repo_navigation_idempotent(self):
        source = '''import {
  Sliders,
} from "lucide-react";
    {
      label: "Commits",
      icon: GitCommit,
      href: `${repoBase}/commits`,
    },
                  { label: "Commits", href: `${repoBase}/commits` },'''
        once = installer.patch_repo_page(source)
        self.assertEqual(once.count('label: "CI Runs"'), 2)
        self.assertEqual(once, installer.patch_repo_page(once))

    def test_repo_navigation_missing_anchor_refuses_mutation(self):
        with self.assertRaises(installer.InstallError):
            installer.patch_repo_page("totally different frontend")

    def test_shared_header_idempotent(self):
        source = """  { id: 'commits', label: 'Commits',       icon: 'commit' },
  commits: '/commits',"""
        amended = installer.patch_shared_header(source)
        self.assertIn("  ci: '/ci',", amended)
        self.assertEqual(amended, installer.patch_shared_header(amended))

    def test_insights_adds_real_ci_link_idempotently(self):
        source = '''import { BrainCircuit, ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";
          <button type="button" onClick={() => void load()} disabled={loading}
            className="rounded-xl">
            <RefreshCw size={15} /> Refresh
          </button>
        </header>'''
        amended = installer.patch_insights(source)
        self.assertIn('href={`${repoUrl}/ci`}', amended)
        self.assertEqual(amended, installer.patch_insights(amended))

    def test_preserves_windows_newlines_and_utf8_bom(self):
        original = ('  commits: \'/commits\',\r\n').encode("utf-8")
        amended = installer.bytes_with_patches(
            b"\xef\xbb\xbf" + original,
            lambda s: installer.once(
                s, "  commits: '/commits',",
                "  commits: '/commits',\n  ci: '/ci',",
                "  ci: '/ci',",
            ),
        )
        self.assertTrue(amended.startswith(b"\xef\xbb\xbf"))
        self.assertIn(b"\r\n", amended)


if __name__ == "__main__":
    unittest.main()
