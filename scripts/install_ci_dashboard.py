#!/usr/bin/env python3
"""Apply PandaHub's CI dashboard to an existing, locally modified working tree.

A dry-run is the default. --apply takes timestamped backups outside the repo.
Only copies three *new* frontend files and makes anchored, minimal navigation
edits in three existing files. Never modifies backend, DB, Docker or secrets.

Example:
  python scripts/install_ci_dashboard.py --project C:/path/Pandahub --source C:/path/PandaHub-CI-Dashboard
  python scripts/install_ci_dashboard.py --project C:/path/Pandahub --source C:/path/PandaHub-CI-Dashboard --apply
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import shutil
import subprocess
import sys

NEW_FILES = (
    "frontend/src/app/[org]/[repo]/ci/page.tsx",
    "frontend/src/lib/native-ci.ts",
    "frontend/src/lib/native-ci.test.ts",
)

EDIT_FILES = (
    "frontend/src/app/[org]/[repo]/page.tsx",
    "frontend/src/components/shared/RepoHeader.tsx",
    "frontend/src/app/[org]/[repo]/insights/page.tsx",
)


class InstallError(Exception):
    pass


def once(source: str, anchor: str, replacement: str, already: str) -> str:
    """Idempotent anchored replacement, never blindly overwrite a live file."""
    if already in source:
        return source
    if source.count(anchor) != 1:
        raise InstallError(f"Expected exactly one merge anchor, got {source.count(anchor)}")
    return source.replace(anchor, replacement, 1)


def patch_repo_page(source: str) -> str:
    source = once(
        source,
        '  Sliders,\n} from "lucide-react";',
        '  Sliders,\n  Workflow,\n} from "lucide-react";',
        '  Workflow,\n} from "lucide-react";',
    )
    anchor = '''    {
      label: "Commits",
      icon: GitCommit,
      href: `${repoBase}/commits`,
    },'''
    source = once(
        source,
        anchor,
        anchor + '''
    {
      label: "CI Runs",
      icon: Workflow,
      href: `${repoBase}/ci`,
    },''',
        'label: "CI Runs",\n      icon: Workflow,',
    )
    anchor = '                  { label: "Commits", href: `${repoBase}/commits` },'
    source = once(
        source, anchor, anchor + '''
                  { label: "CI Runs", href: `${repoBase}/ci` },''',
        '                  { label: "CI Runs", href: `${repoBase}/ci` },',
    )
    return source


def patch_shared_header(source: str) -> str:
    anchor = "  { id: 'commits', label: 'Commits',       icon: 'commit' },"
    source = once(
        source, anchor,
        anchor + "\n  { id: 'ci',      label: 'CI Runs',       icon: 'rule' },",
        "  { id: 'ci',      label: 'CI Runs'",
    )
    anchor = "  commits: '/commits',"
    return once(source, anchor, anchor + "\n  ci: '/ci',", "  ci: '/ci',")


def patch_insights(source: str) -> str:
    anchor = 'import { BrainCircuit, ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";'
    source = once(
        source, anchor,
        'import { BrainCircuit, ArrowLeft, RefreshCw, ShieldAlert, Workflow } from "lucide-react";',
        'ShieldAlert, Workflow } from "lucide-react";',
    )
    anchor = '          <button type="button" onClick={() => void load()} disabled={loading}'
    source = once(
        source, anchor,
        '''          <div className="flex flex-wrap items-center gap-2">
          <Link href={`${repoUrl}/ci`} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
            <Workflow size={15} /> CI Runs
          </Link>
''' + anchor,
        '<Link href={`${repoUrl}/ci`}',
    )
    anchor = '''            <RefreshCw size={15} /> Refresh
          </button>
        </header>'''
    return once(
        source, anchor,
        '''            <RefreshCw size={15} /> Refresh
          </button>
          </div>
        </header>''',
        '''            <RefreshCw size={15} /> Refresh
          </button>
          </div>
        </header>''',
    )


PATCHES = {
    EDIT_FILES[0]: patch_repo_page,
    EDIT_FILES[1]: patch_shared_header,
    EDIT_FILES[2]: patch_insights,
}


def bytes_with_patches(original: bytes, patcher) -> bytes:
    bom = original.startswith(b"\xef\xbb\xbf")
    text = original.decode("utf-8-sig")
    newline = "\r\n" if b"\r\n" in original else "\n"
    amended = patcher(text.replace("\r\n", "\n"))
    output = amended.replace("\n", newline).encode("utf-8")
    return (b"\xef\xbb\xbf" + output) if bom else output


def ensure_tree(path: Path) -> Path:
    if not (path / ".git").exists():
        raise InstallError(f"Missing Git working-tree marker: {path}")
    if not (path / "frontend" / "package.json").is_file():
        raise InstallError(f"Not a PandaHub frontend: {path}")
    return path.resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="Guarded PandaHub CI dashboard installer")
    parser.add_argument("--project", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    try:
        dest = ensure_tree(args.project)
        source = ensure_tree(args.source)
        if source == dest:
            raise InstallError("Staging source and local project must be separate working trees")
        changes: list[tuple[str, Path, bytes | None, bytes]] = []

        for rel in NEW_FILES:
            source_file = source / rel
            dest_file = dest / rel
            if not source_file.is_file():
                raise InstallError(f"Missing staging file: {rel}")
            incoming = source_file.read_bytes()
            current = dest_file.read_bytes() if dest_file.exists() else None
            if current is None:
                changes.append((rel, dest_file, None, incoming))
                print("COPY NEW:", rel)
            elif current == incoming:
                print("ALREADY INSTALLED:", rel)
            else:
                raise InstallError(f"Existing file differs, refusing to replace: {rel}")

        for rel, patch in PATCHES.items():
            path = dest / rel
            if not path.is_file():
                raise InstallError(f"Missing local navigation file: {rel}")
            original = path.read_bytes()
            updated = bytes_with_patches(original, patch)
            if updated == original:
                print("ALREADY PATCHED:", rel)
            else:
                changes.append((rel, path, original, updated))
                print("PATCH:", rel)

        print(f"Changes proposed: {len(changes)}")
        if not args.apply:
            print("DRY RUN COMPLETE: No source or services modified.")
            return 0
        if not changes:
            print("Already integrated; nothing to do.")
            return 0

        # Prevent edits when another process may be updating the same tracked files.
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--", *EDIT_FILES],
            cwd=dest, capture_output=True, text=True, check=True,
        )
        if dirty.stdout.strip():
            raise InstallError(
                "One or more existing navigation files have uncommitted edits. "
                "Review them manually before applying this guarded installer."
            )

        backup = dest.parent / (
            "PandaHub-CI-Dashboard-Backup-" +
            datetime.now().strftime("%Y%m%d-%H%M%S")
        )
        if backup.exists():
            raise InstallError("Backup path already exists")
        print("Source backup:", backup)
        for rel, path, original, _ in changes:
            if original is not None:
                target = backup / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(original)

        applied: list[tuple[Path, bytes | None]] = []
        try:
            for rel, path, original, updated in changes:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(updated)
                applied.append((path, original))
        except Exception:
            for path, original in reversed(applied):
                if original is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(original)
            raise

        print("FRONTEND SOURCE INTEGRATION COMPLETE")
        print("No database, services, Docker image, or CI settings changed.")
        print("Run frontend type-check, unit tests, lint and build before deployment.")
        return 0
    except (InstallError, OSError, subprocess.CalledProcessError, UnicodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
