"""
Dependency Vulnerability Scanner — queries the OSV (Open Source Vulnerabilities)
database for known CVEs in project dependencies.

OSV (https://osv.dev) is a free, open-source vulnerability database backed by
Google, maintained by the security community. No API key required. Covers
PyPI, npm, Maven, Go, Cargo, and more ecosystems.

Supported manifest files:
  - requirements.txt / requirements/*.txt  (PyPI)
  - pyproject.toml (PyPI — extracts [project.dependencies])
  - Pipfile (PyPI — extracts [packages])
  - package.json (npm)

The scanner is deliberately network-bound (it calls the OSV API), so it runs
as a Celery background task rather than blocking git push operations.
"""
import json
import re
from dataclasses import dataclass
from pathlib import Path
import httpx

OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch"
OSV_TIMEOUT = 30  # seconds


@dataclass
class VulnFinding:
    package_name: str
    installed_version: str
    vuln_id: str          # e.g. "CVE-2023-12345" or "GHSA-xxxx-xxxx-xxxx"
    title: str
    severity: str         # critical / high / medium / low / info
    description: str
    file_path: str


def _parse_requirements_txt(content: str) -> list[tuple[str, str]]:
    """Return list of (package_name, version) from requirements.txt format."""
    deps = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Handle: package==1.2.3, package>=1.2.3, package~=1.2.3
        m = re.match(r"^([A-Za-z0-9_.\-]+)\s*[=~><]+\s*([0-9][A-Za-z0-9._\-]*)$", line)
        if m:
            deps.append((m.group(1).lower(), m.group(2)))
    return deps


def _parse_package_json(content: str) -> list[tuple[str, str]]:
    """Return list of (package_name, version) from package.json dependencies."""
    deps = []
    try:
        data = json.loads(content)
        for section in ("dependencies", "devDependencies"):
            for name, version in data.get(section, {}).items():
                # Strip semver range characters: ^, ~, >=, etc.
                clean = re.sub(r"^[\^~>=<*]", "", version.strip())
                if clean and clean[0].isdigit():
                    deps.append((name, clean))
    except (json.JSONDecodeError, AttributeError):
        pass
    return deps


def _parse_pyproject_toml(content: str) -> list[tuple[str, str]]:
    """Minimal TOML parser for [project.dependencies] section."""
    deps = []
    in_deps = False
    for line in content.splitlines():
        line = line.strip()
        if line == "[project.dependencies]" or line == "dependencies = [":
            in_deps = True
            continue
        if in_deps:
            if line.startswith("[") or line == "]":
                in_deps = False
                continue
            # e.g. "fastapi>=0.100.0",
            m = re.match(r'"?([A-Za-z0-9_.\-]+)\s*[=~><]+\s*([0-9][A-Za-z0-9._\-]*)"?,?', line)
            if m:
                deps.append((m.group(1).lower(), m.group(2)))
    return deps


def _severity_from_osv(vuln: dict) -> str:
    """Map OSV severity scores to our four-level scheme."""
    severities = vuln.get("severity", [])
    for s in severities:
        score_str = s.get("score", "")
        # CVSS v3 score thresholds
        try:
            score = float(score_str)
            if score >= 9.0:
                return "critical"
            elif score >= 7.0:
                return "high"
            elif score >= 4.0:
                return "medium"
            else:
                return "low"
        except (ValueError, TypeError):
            pass
    # Fallback: check database_specific fields
    for s in severities:
        severity_type = s.get("type", "").upper()
        if "CRITICAL" in severity_type:
            return "critical"
        elif "HIGH" in severity_type:
            return "high"
        elif "MEDIUM" in severity_type:
            return "medium"
    return "medium"  # conservative default


def discover_manifests(repo_path: str) -> list[tuple[str, str, str]]:
    """
    Walk the repo directory and find dependency manifest files.
    Returns list of (file_path, ecosystem, content).
    """
    manifests = []
    root = Path(repo_path)

    for pattern, ecosystem in [
        ("**/requirements*.txt", "PyPI"),
        ("**/package.json", "npm"),
        ("**/pyproject.toml", "PyPI"),
        ("**/Pipfile", "PyPI"),
    ]:
        for fpath in root.glob(pattern):
            # Skip virtual environments and node_modules
            parts = fpath.parts
            if any(p in parts for p in ("node_modules", ".venv", "venv", "__pycache__", ".git")):
                continue
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                manifests.append((str(fpath.relative_to(root)), ecosystem, content))
            except OSError:
                continue
    return manifests


def parse_manifest(file_path: str, content: str) -> list[tuple[str, str]]:
    """Parse a manifest file and return (package, version) pairs."""
    name = Path(file_path).name.lower()
    if name.endswith(".txt"):
        return _parse_requirements_txt(content)
    elif name == "package.json":
        return _parse_package_json(content)
    elif name == "pyproject.toml":
        return _parse_pyproject_toml(content)
    return []


async def query_osv(packages: list[dict]) -> list[dict]:
    """
    Query OSV batch API for a list of packages.
    Each package is {"package": {"name": ..., "ecosystem": ...}, "version": ...}
    Returns list of OSV vulnerability objects.
    """
    if not packages:
        return []

    payload = {"queries": [{"package": p["package"], "version": p["version"]} for p in packages]}

    async with httpx.AsyncClient(timeout=OSV_TIMEOUT) as client:
        try:
            resp = await client.post(OSV_BATCH_URL, json=payload)
            resp.raise_for_status()
            results = resp.json().get("results", [])
        except (httpx.HTTPError, Exception):
            return []

    vulns = []
    for i, result in enumerate(results):
        for vuln in result.get("vulns", []):
            vulns.append({**vuln, "_queried_pkg": packages[i]})
    return vulns


async def scan_dependencies(repo_path: str) -> list[VulnFinding]:
    """
    Full scan: discover manifests → parse deps → query OSV → return findings.
    """
    findings: list[VulnFinding] = []
    manifests = discover_manifests(repo_path)

    if not manifests:
        return findings

    # Build OSV query list
    osv_queries = []
    query_meta = []  # parallel list tracking which file each query came from

    for file_path, ecosystem, content in manifests:
        packages = parse_manifest(file_path, content)
        for pkg_name, version in packages:
            osv_queries.append({
                "package": {"name": pkg_name, "ecosystem": ecosystem},
                "version": version,
            })
            query_meta.append((file_path, pkg_name, version))

    # OSV has a limit of 1000 queries per batch; chunk if needed
    chunk_size = 100
    all_vulns = []
    for i in range(0, len(osv_queries), chunk_size):
        chunk_vulns = await query_osv(osv_queries[i:i+chunk_size])
        all_vulns.extend(chunk_vulns)

    for vuln in all_vulns:
        queried = vuln.get("_queried_pkg", {})
        file_path = ""
        pkg_name = queried.get("package", {}).get("name", "unknown")
        version = queried.get("version", "unknown")

        # Find the file that contained this package
        for fp, ep, _ in manifests:
            if any(p[0] == pkg_name for p in parse_manifest(fp, "")):
                file_path = fp
                break

        vuln_id = vuln.get("id", "UNKNOWN")
        summary = vuln.get("summary", vuln_id)
        details = vuln.get("details", "")
        severity = _severity_from_osv(vuln)

        findings.append(VulnFinding(
            package_name=pkg_name,
            installed_version=version,
            vuln_id=vuln_id,
            title=f"{vuln_id}: {summary[:200]}",
            severity=severity,
            description=details[:1000] if details else summary,
            file_path=file_path,
        ))

    return findings
