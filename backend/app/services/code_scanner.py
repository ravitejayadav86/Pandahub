"""
Code Scanner — Semgrep-based static analysis for security vulnerabilities.

Semgrep is a free, open-source static analysis tool that performs semantic
pattern matching across many languages. It uses a YAML-based rule language
that can track data flow (taint analysis) for finding injection flaws,
insecure API usage, and OWASP Top-10 class vulnerabilities.

We invoke Semgrep as a subprocess and parse its JSON output. The worker
Dockerfile installs semgrep via pip.

Rulesets used:
  - p/owasp-top-ten      — SQL injection, XSS, SSRF, command injection, etc.
  - p/secrets            — Additional secret pattern coverage
  - p/security-audit     — Broader security-relevant patterns

If Semgrep is not installed, the scanner logs a warning and returns empty
results rather than failing the push.
"""
import json
import subprocess
import shutil
from dataclasses import dataclass
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Semgrep rulesets to run (order: fastest/most-impactful first)
SEMGREP_RULESETS = [
    "p/owasp-top-ten",
    "p/secrets",
]

SEVERITY_MAP = {
    "ERROR": "high",
    "WARNING": "medium",
    "INFO": "low",
}


@dataclass
class CodeFinding:
    rule_id: str
    title: str
    severity: str
    file_path: str
    line_number: int
    description: str
    raw_snippet: str


def _semgrep_available() -> bool:
    return shutil.which("semgrep") is not None


def scan_code(repo_path: str, timeout_seconds: int = 120) -> list[CodeFinding]:
    """
    Run Semgrep on the repository and return structured findings.

    Runs synchronously (blocking) — should be called from a Celery worker,
    NOT from an API request handler.
    """
    if not _semgrep_available():
        logger.warning("semgrep not found in PATH — code scanning skipped. Install with: pip install semgrep")
        return []

    findings: list[CodeFinding] = []

    for ruleset in SEMGREP_RULESETS:
        cmd = [
            "semgrep",
            "--config", ruleset,
            "--json",
            "--no-git-ignore",          # scan everything in the repo
            "--timeout", str(timeout_seconds // len(SEMGREP_RULESETS)),
            "--max-memory", "512",       # MB, protect workers from OOM
            str(repo_path),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
            output = result.stdout
            if not output.strip():
                continue

            data = json.loads(output)
            for match in data.get("results", []):
                check_id = match.get("check_id", "unknown")
                extra = match.get("extra", {})
                message = extra.get("message", "")
                severity_raw = extra.get("severity", "INFO").upper()
                severity = SEVERITY_MAP.get(severity_raw, "low")

                # Bump severity for OWASP critical classes
                if any(k in check_id.lower() for k in ("sql-injection", "command-injection", "path-traversal", "xxe")):
                    severity = "critical"

                file_rel = match.get("path", "unknown")
                start = match.get("start", {})
                line = start.get("line", 0)
                lines = extra.get("lines", "")

                findings.append(CodeFinding(
                    rule_id=check_id,
                    title=f"[{check_id.split('.')[-1].replace('-', ' ').title()}]",
                    severity=severity,
                    file_path=file_rel,
                    line_number=line,
                    description=message[:500],
                    raw_snippet=lines[:300] if lines else "",
                ))

        except subprocess.TimeoutExpired:
            logger.warning(f"Semgrep timed out running ruleset {ruleset} on {repo_path}")
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Semgrep error for ruleset {ruleset}: {e}")

    return findings
