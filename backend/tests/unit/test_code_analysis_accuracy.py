from app.services.code_analysis_service import analyze_source


def test_python_division_by_zero_has_evidence_confidence():
    result = analyze_source("a = 10\nb = 0\nc = a / b\n", "python", "main.py")
    finding = next(item for item in result["findings"] if item["rule_id"] == "PY-DIV-ZERO")
    assert finding["line"] == 3
    assert finding["confidence_score"] == 99
    assert finding["confidence_level"] == "high"
    assert "AST proves" in finding["confidence_basis"]


def test_python_safe_division_has_no_division_finding():
    result = analyze_source("divisor = 2\nprint(10 / divisor)\n", "python", "main.py")
    assert "PY-DIV-ZERO" not in {item["rule_id"] for item in result["findings"]}


def test_security_api_pattern_requires_context_review():
    result = analyze_source("payload = input()\nvalue = eval(payload)\n", "python", "main.py")
    finding = next(item for item in result["findings"] if item["rule_id"] == "PY-EVAL")
    assert finding["verification_status"] == "pattern_detected_context_review_required"


def test_java_missing_semicolon_is_medium_confidence():
    source = 'class Main { void run() { System.out.println("x") } }'
    result = analyze_source(source, "java", "Main.java")
    finding = next(item for item in result["findings"] if item["rule_id"] == "JAVA-MISSING-SEMICOLON")
    assert finding["confidence_score"] == 74
    assert finding["confidence_level"] == "medium"
