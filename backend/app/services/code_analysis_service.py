"""Deterministic Python/Java analysis with evidence-labelled confidence scores.

Confidence values are rule-based triage scores, not calibrated probabilities.
They must be calibrated against a labelled holdout dataset before being
reported as statistical probabilities or used as a release gate.
"""
from __future__ import annotations

import ast
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

MAX_SOURCE_CHARS = 100_000

# Confidence is tied to the kind of evidence behind each rule. Exact compiler
# and parser diagnostics are stronger than lightweight lexical heuristics.
_RULE_EVIDENCE: dict[str, tuple[int, str, str]] = {
    "PY-SYNTAX": (99, "high", "Python AST parser returned a syntax diagnostic."),
    "PY-DIV-ZERO": (99, "high", "AST proves the divisor is the literal zero or a statically assigned zero."),
    "PY-INPUT-COMPARE": (82, "medium", "AST identifies comparison against the input function object; a local variable can shadow the built-in."),
    "PY-EVAL": (96, "high", "AST identifies a direct eval() call; exploitability depends on input trust."),
    "PY-EXEC": (96, "high", "AST identifies a direct exec() call; exploitability depends on input trust."),
    "PY-BARE-EXCEPT": (98, "high", "AST identifies an exception handler without an exception type."),
    "JAVA-BRACES": (78, "medium", "Opening/closing brace count differs; comments and strings can affect this heuristic."),
    "JAVA-MISSING-SEMICOLON": (74, "medium", "A lightweight print-statement pattern suggests a missing terminator; compiler confirmation is preferred."),
    "JAVA-RUNTIME-EXEC": (91, "high", "A Runtime.exec() call is present; exploitability depends on how arguments are constructed."),
    "JAVA-COMPILE": (99, "high", "javac emitted a compiler error for this source file."),
    "JAVA-COMPILE-TIMEOUT": (60, "needs_review", "Compiler invocation exceeded its time limit."),
    "JAVA-COMPILER-MISSING": (99, "high", "The environment does not have javac on PATH; this is a coverage notice, not a code defect."),
}


def _finding(
    rule: str,
    title: str,
    severity: str,
    line: int,
    explanation: str,
    suggestion: str = "",
) -> dict[str, Any]:
    return {
        "rule_id": rule,
        "title": title,
        "severity": severity,
        "line": max(1, int(line or 1)),
        "explanation": explanation,
        "suggestion": suggestion,
    }


def _python_analysis(source: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return [_finding(
            "PY-SYNTAX", "Python syntax error", "error", exc.lineno or 1,
            exc.msg, "Correct the syntax at this line and run the analysis again.",
        )]

    constant_values: dict[str, Any] = {}
    for candidate in ast.walk(tree):
        if (
            isinstance(candidate, ast.Assign)
            and len(candidate.targets) == 1
            and isinstance(candidate.targets[0], ast.Name)
            and isinstance(candidate.value, ast.Constant)
            and isinstance(candidate.value.value, (int, float, str, bool, type(None)))
        ):
            constant_values[candidate.targets[0].id] = candidate.value.value

    for node in ast.walk(tree):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Div, ast.FloorDiv, ast.Mod)):
            divisor_is_zero = (
                isinstance(node.right, ast.Constant) and node.right.value == 0
            ) or (
                isinstance(node.right, ast.Name)
                and constant_values.get(node.right.id, object()) == 0
            )
            if divisor_is_zero:
                findings.append(_finding(
                    "PY-DIV-ZERO", "Division by zero", "error", node.lineno,
                    "This expression divides by the numeric value zero and will raise ZeroDivisionError.",
                    "Check that the divisor is non-zero before performing the operation.",
                ))

        if isinstance(node, ast.Compare) and any(isinstance(op, (ast.Eq, ast.Is)) for op in node.ops):
            if isinstance(node.left, ast.Name) and node.left.id == "input":
                findings.append(_finding(
                    "PY-INPUT-COMPARE", "Possible input function comparison", "low", node.lineno,
                    "This compares the input function object rather than a value returned by input().",
                    "Call input() and compare its returned string.",
                ))

        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id == "eval":
                findings.append(_finding(
                    "PY-EVAL", "Use of eval()", "high", node.lineno,
                    "eval() executes dynamically constructed Python expressions and can execute untrusted input.",
                    "Prefer a safe parser or an explicit mapping of allowed operations.",
                ))
            elif node.func.id == "exec":
                findings.append(_finding(
                    "PY-EXEC", "Use of exec()", "high", node.lineno,
                    "exec() executes dynamically constructed Python code and can be dangerous with untrusted input.",
                    "Avoid dynamic execution or strictly constrain and validate the input.",
                ))

        if isinstance(node, ast.ExceptHandler) and node.type is None:
            findings.append(_finding(
                "PY-BARE-EXCEPT", "Bare except clause", "medium", node.lineno,
                "A bare except catches almost every exception, including system-exiting exceptions.",
                "Catch the specific exception types that the code can handle.",
            ))

    return findings


def _ruff_analysis(source: str, filename: str) -> tuple[list[dict[str, Any]], bool]:
    """Run Ruff as a fast lint/quality pass when available in the backend image."""
    executable = shutil.which("ruff")
    if not executable:
        return [], False
    safe_name = Path(filename).name
    if not safe_name.endswith(".py") or not re.fullmatch(r"[A-Za-z0-9_.-]+\.py", safe_name):
        safe_name = "pandahub_input.py"
    with tempfile.TemporaryDirectory(prefix="pandahub-ruff-") as temp_dir:
        source_path = Path(temp_dir) / safe_name
        source_path.write_text(source, encoding="utf-8")
        try:
            completed = subprocess.run(
                [executable, "check", "--output-format", "json", str(source_path)],
                capture_output=True, text=True, timeout=10, cwd=temp_dir, check=False,
            )
        except subprocess.TimeoutExpired:
            return [_finding(
                "RUFF-TIMEOUT", "Ruff scan timed out", "medium", 1,
                "Ruff did not finish within the 10-second analysis limit.",
            )], True
        try:
            diagnostics = json.loads(completed.stdout or "[]")
        except json.JSONDecodeError:
            return [_finding(
                "RUFF-OUTPUT", "Ruff output could not be parsed", "info", 1,
                "Ruff ran but returned an unreadable response; its diagnostics were not imported.",
            )], True
        findings: list[dict[str, Any]] = []
        for item in diagnostics:
            code = str(item.get("code") or "UNKNOWN")
            if code == "E999":  # The AST parser already reports syntax errors.
                continue
            location = item.get("location") or {}
            line = int(location.get("row") or 1)
            message = str(item.get("message") or "Ruff reported a lint finding.")
            severity = "high" if code == "F821" else "error" if code.startswith("E9") else "low"
            finding = _finding(
                f"RUFF-{code}", f"Ruff {code}", severity, line, message,
                "Review the Ruff diagnostic and apply an appropriate source-level fix.",
            )
            finding.update({
                "confidence_score": 95,
                "confidence_level": "high",
                "confidence_basis": f"Ruff emitted deterministic diagnostic {code}.",
                "verification_status": "static_lint_diagnostic",
                "evidence_source": "ruff",
            })
            findings.append(finding)
        return findings, True


def _bandit_analysis(source: str, filename: str) -> tuple[list[dict[str, Any]], bool]:
    """Run Bandit safely as a static scanner when installed; never execute source."""
    executable = shutil.which("bandit")
    if not executable:
        return [], False

    safe_name = Path(filename).name
    if not safe_name.endswith(".py") or not re.fullmatch(r"[A-Za-z0-9_.-]+\.py", safe_name):
        safe_name = "pandahub_input.py"

    with tempfile.TemporaryDirectory(prefix="pandahub-bandit-") as temp_dir:
        source_path = Path(temp_dir) / safe_name
        source_path.write_text(source, encoding="utf-8")
        try:
            completed = subprocess.run(
                [executable, "-f", "json", "-q", str(source_path)],
                capture_output=True,
                text=True,
                timeout=15,
                cwd=temp_dir,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return [_finding(
                "BANDIT-TIMEOUT", "Bandit scan timed out", "medium", 1,
                "Bandit did not finish within the 15-second analysis limit.",
                "Review the file size and rerun analysis.",
            )], True

        try:
            payload = json.loads(completed.stdout or "{}")
        except json.JSONDecodeError:
            # A non-zero return code is normal when findings are present. A
            # malformed response is an integration/tool error, not a code flaw.
            return [_finding(
                "BANDIT-OUTPUT", "Bandit output could not be parsed", "info", 1,
                "Bandit ran but did not return parseable JSON; its findings were not imported.",
            )], True

        findings: list[dict[str, Any]] = []
        for item in payload.get("results", []):
            bandit_severity = str(item.get("issue_severity", "LOW")).upper()
            bandit_confidence = str(item.get("issue_confidence", "LOW")).upper()
            severity = {"HIGH": "high", "MEDIUM": "medium", "LOW": "low"}.get(bandit_severity, "low")
            confidence_score = {"HIGH": 94, "MEDIUM": 80, "LOW": 65}.get(bandit_confidence, 65)
            level = "high" if confidence_score >= 90 else "medium" if confidence_score >= 70 else "needs_review"
            rule_id = f"BANDIT-{item.get('test_id', 'UNKNOWN')}"
            finding = _finding(
                rule_id,
                str(item.get("test_name") or "Bandit security finding"),
                severity,
                int(item.get("line_number") or 1),
                str(item.get("issue_text") or "Bandit detected a potentially unsafe code pattern."),
                "Review the Bandit rule documentation and verify the data flow and runtime context.",
            )
            finding.update({
                "confidence_score": confidence_score,
                "confidence_level": level,
                "confidence_basis": f"Bandit {item.get('test_id', 'rule')} reported {bandit_confidence.lower()} confidence.",
                "verification_status": "static_pattern_detected_context_review_required",
                "evidence_source": "bandit",
            })
            findings.append(finding)

        return findings, True


def _attach_confidence(finding: dict[str, Any]) -> dict[str, Any]:
    rule_id = finding.get("rule_id", "")
    score, level, basis = _RULE_EVIDENCE.get(
        rule_id,
        (60, "needs_review", "No rule-specific confidence calibration is available; manual verification is recommended."),
    )
    finding.update({
        "confidence_score": score,
        "confidence_level": level,
        "confidence_basis": basis,
        "verification_status": (
            "manual_review_recommended" if level == "needs_review"
            else "pattern_detected_context_review_required"
            if rule_id in {"PY-EVAL", "PY-EXEC", "JAVA-RUNTIME-EXEC"}
            else "static_rule_match"
        ),
        "evidence_source": "python_ast" if rule_id.startswith("PY-") else "javac_or_lexical_rule",
    })
    return finding


def _java_analysis(source: str, filename: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    if source.count("{") != source.count("}"):
        findings.append(_finding(
            "JAVA-BRACES", "Unbalanced braces", "error", 1,
            "The number of opening and closing braces does not match.",
            "Match each opening brace with a closing brace.",
        ))

    for match in re.finditer(r"\bSystem\.out\.print(?:ln)?\s*\([^;]*\)\s*(?!;)", source):
        line = source.count("\n", 0, match.start()) + 1
        findings.append(_finding(
            "JAVA-MISSING-SEMICOLON", "Possible missing semicolon", "error", line,
            "This print statement appears not to end with a semicolon.",
            "Add a semicolon after the statement.",
        ))

    runtime_match = re.search(r"\bRuntime\s*\.\s*getRuntime\s*\(\s*\)\s*\.\s*exec\s*\(", source)
    if runtime_match:
        line = source.count("\n", 0, runtime_match.start()) + 1
        findings.append(_finding(
            "JAVA-RUNTIME-EXEC", "Process execution", "high", line,
            "Runtime.exec() launches an operating-system process; avoid passing untrusted input.",
            "Use a fixed command and pass arguments separately after validating them.",
        ))

    javac = shutil.which("javac")
    if javac:
        safe_name = Path(filename).name
        if not safe_name.endswith(".java") or not re.fullmatch(r"[A-Za-z_$][\w$]*\.java", safe_name):
            safe_name = "PandaHubInput.java"
        with tempfile.TemporaryDirectory(prefix="pandahub-java-") as temp_dir:
            source_path = Path(temp_dir) / safe_name
            source_path.write_text(source, encoding="utf-8")
            try:
                result = subprocess.run(
                    [javac, "-proc:none", "-Xlint:none", str(source_path)],
                    capture_output=True, text=True, timeout=12, cwd=temp_dir,
                )
                if result.returncode:
                    for line in result.stderr.splitlines():
                        match = re.search(r":(\d+):\s*error:\s*(.*)", line)
                        if match:
                            findings.append(_finding(
                                "JAVA-COMPILE", "Java compilation error", "error",
                                int(match.group(1)), match.group(2)[:400],
                                "Fix the compiler diagnostic and compile the source again.",
                            ))
            except subprocess.TimeoutExpired:
                findings.append(_finding(
                    "JAVA-COMPILE-TIMEOUT", "Java compilation timed out", "medium", 1,
                    "The Java compiler did not finish within the 12-second analysis limit.",
                ))
    else:
        findings.append(_finding(
            "JAVA-COMPILER-MISSING", "Java compiler unavailable", "info", 1,
            "JDK javac was not found. Only lightweight Java checks were performed.",
            "Install a JDK and add its bin directory to PATH for compiler diagnostics.",
        ))
    return findings


def analyze_source(source: str, language: str, filename: str) -> dict[str, Any]:
    if not source.strip():
        raise ValueError("Source code cannot be empty.")
    if len(source) > MAX_SOURCE_CHARS:
        raise ValueError(f"Source code exceeds the {MAX_SOURCE_CHARS:,}-character limit.")

    normalized = language.strip().lower()
    tools_used: list[str] = []
    if normalized == "python":
        findings = _python_analysis(source)
        tools_used.append("python_ast")
        ruff_findings, ruff_available = _ruff_analysis(source, filename)
        if ruff_available:
            tools_used.append("ruff")
            findings.extend(ruff_findings)
        bandit_findings, bandit_available = _bandit_analysis(source, filename)
        if bandit_available:
            tools_used.append("bandit")
            findings.extend(bandit_findings)
    elif normalized == "java":
        findings = _java_analysis(source, filename)
        tools_used.append("java_lexical_checks")
        if shutil.which("javac"):
            tools_used.append("javac")
    else:
        raise ValueError("Supported languages are Python and Java.")

    # Avoid counting informational environment notices as defect findings.
    for finding in findings:
        if "confidence_score" not in finding:
            _attach_confidence(finding)

    weights = {"error": 25, "high": 20, "medium": 10, "low": 5, "info": 0}
    defect_findings = [item for item in findings if item["severity"] != "info"]
    score = max(0, min(100, 100 - sum(weights.get(item["severity"], 0) for item in defect_findings)))
    confidence_counts = {
        "high": sum(1 for item in defect_findings if item["confidence_level"] == "high"),
        "medium": sum(1 for item in defect_findings if item["confidence_level"] == "medium"),
        "needs_review": sum(1 for item in defect_findings if item["confidence_level"] == "needs_review"),
    }
    return {
        "language": normalized,
        "filename": filename,
        "quality_score": score,
        "issue_count": len(defect_findings),
        "findings": findings,
        "confidence_summary": confidence_counts,
        "analysis_tools": tools_used,
        "analysis_scope": (
            "Python AST, Ruff and Bandit when installed; Java lexical checks and javac diagnostics when available. "
            "Confidence values are rule-based triage scores, not calibrated probabilities."
        ),
    }
