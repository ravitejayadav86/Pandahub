"""
Secret Scanner — regex-based detection of hardcoded secrets in git diffs.

Patterns cover the most impactful credential types (high signal-to-noise).
Each pattern includes a severity, a human-readable title, and whether to
partially mask the raw finding before storage (to avoid storing live secrets
in the DB verbatim).

Design principle: false positives cost developer trust; false negatives cost
security. These patterns are deliberately high-precision (anchored, length-
bounded) rather than broad — better to miss an obscure format than to flood
the UI with noise.
"""
import re
from dataclasses import dataclass

SECRET_PATTERNS = [
    {
        "rule_id": "aws-access-key-id",
        "title": "AWS Access Key ID",
        "severity": "critical",
        "pattern": re.compile(r"(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])"),
        "mask": True,
    },
    {
        "rule_id": "aws-secret-access-key",
        "title": "AWS Secret Access Key",
        "severity": "critical",
        "pattern": re.compile(r"(?i)aws[_\-\s]?secret[_\-\s]?(?:access[_\-\s]?)?key[\s:=\"']+([A-Za-z0-9/+]{40})"),
        "mask": True,
    },
    {
        "rule_id": "github-personal-access-token",
        "title": "GitHub Personal Access Token",
        "severity": "critical",
        "pattern": re.compile(r"(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})"),
        "mask": True,
    },
    {
        "rule_id": "stripe-live-secret-key",
        "title": "Stripe Live Secret Key",
        "severity": "critical",
        "pattern": re.compile(r"(sk_live_[A-Za-z0-9]{24,})"),
        "mask": True,
    },
    {
        "rule_id": "stripe-restricted-key",
        "title": "Stripe Restricted Key",
        "severity": "high",
        "pattern": re.compile(r"(rk_live_[A-Za-z0-9]{24,})"),
        "mask": True,
    },
    {
        "rule_id": "private-key-header",
        "title": "Private Key (RSA/EC/PEM)",
        "severity": "critical",
        "pattern": re.compile(r"-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----"),
        "mask": False,
    },
    {
        "rule_id": "google-api-key",
        "title": "Google API Key",
        "severity": "high",
        "pattern": re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
        "mask": True,
    },
    {
        "rule_id": "slack-token",
        "title": "Slack Bot/API Token",
        "severity": "high",
        "pattern": re.compile(r"xox[baprs]-[0-9A-Za-z\-]{10,}"),
        "mask": True,
    },
    {
        "rule_id": "sendgrid-api-key",
        "title": "SendGrid API Key",
        "severity": "high",
        "pattern": re.compile(r"SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}"),
        "mask": True,
    },
    {
        "rule_id": "jwt-secret-assignment",
        "title": "Hardcoded JWT Secret",
        "severity": "high",
        "pattern": re.compile(r'(?i)jwt[_\-]?secret[\s]*[=:]["\'`\s]+([A-Za-z0-9+/=_\-]{32,})'),
        "mask": True,
    },
    {
        "rule_id": "password-in-url",
        "title": "Password in Connection URL",
        "severity": "high",
        "pattern": re.compile(r"(?i)(postgres|mysql|redis|mongodb)://[^:]+:([^@\s]{8,})@"),
        "mask": True,
    },
]

# Lines in binary-looking context or test files are less likely to be real secrets
TEST_FILE_PATTERN = re.compile(r"test[s]?[/_]|spec[/_]|mock|fixture|\.test\.|\.spec\.", re.IGNORECASE)


@dataclass
class SecretFinding:
    rule_id: str
    title: str
    severity: str
    file_path: str
    line_number: int
    raw_finding: str


def _mask(value: str) -> str:
    """Partially mask a secret for safe storage — keep prefix and suffix only."""
    if len(value) <= 8:
        return "***"
    return value[:4] + "*" * (len(value) - 8) + value[-4:]


def scan_diff(diff_text: str) -> list[SecretFinding]:
    """
    Scan a unified git diff for secret patterns.

    Returns a list of SecretFinding for every match found on added lines (+).
    Skipped for lines in test/fixture files (lower false positive risk
    but we still want to catch them — callers can adjust severity).
    """
    findings: list[SecretFinding] = []
    current_file = "unknown"
    current_line = 0

    for raw_line in diff_text.splitlines():
        # Track which file we're in
        if raw_line.startswith("diff --git"):
            parts = raw_line.split(" b/")
            if len(parts) > 1:
                current_file = parts[1]
            current_line = 0
            continue

        # Track line numbers from hunk headers: @@ -a,b +c,d @@
        if raw_line.startswith("@@"):
            m = re.search(r"\+(\d+)", raw_line)
            if m:
                current_line = int(m.group(1)) - 1
            continue

        if raw_line.startswith("+") and not raw_line.startswith("+++"):
            current_line += 1
            line_content = raw_line[1:]  # strip leading +

            for spec in SECRET_PATTERNS:
                match = spec["pattern"].search(line_content)
                if match:
                    raw_value = match.group(1) if match.lastindex else match.group(0)
                    display_value = _mask(raw_value) if spec["mask"] else raw_value
                    findings.append(SecretFinding(
                        rule_id=spec["rule_id"],
                        title=spec["title"],
                        severity=spec["severity"],
                        file_path=current_file,
                        line_number=current_line,
                        raw_finding=f"{display_value} in `{current_file}:{current_line}`",
                    ))
        elif raw_line.startswith(" ") or raw_line.startswith("-"):
            # Context and removed lines still advance line counter (for + lines)
            if not raw_line.startswith("-"):
                current_line += 1

    return findings
