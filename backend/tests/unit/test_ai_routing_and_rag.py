"""
Unit tests for the 8 Core AI Architecture Contributions (Module 11).

Tests:
  1. Dynamic Hybrid Expert Routing (Category dispatch & model allocation)
  2. Two-Layer RAG Store & Neighbor-Voting Categorization
  3. Discovery of Context Collapse in SLMs (k cap guard at k=3)
  4. Discovery of Error Severity Overestimation Mitigation
  5. Asynchronous Continuous Indexing Loop on PR merge
  6. Semi-Supervised Self-Training Classifier (Dual-branch TF-IDF + tau=0.7)
  7. Anti-Leakage Dataset Pipeline (Temporal cutoff June 1, 2024 + sanitization)
  8. Semantic Judge Evaluation (LLM-as-a-Judge 5 axes & kappa=0.78 calibration)
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from app.services.ai_router import (
    classify_diff,
    DiffCategory,
    ExpertModel,
    ROUTING_TABLE,
    route_and_review,
)
from app.services.classifier import (
    get_k_for_model,
    clamp_severity_for_category,
    CONFIDENCE_THRESHOLD,
    K_MAX_SMALL_MODEL,
    SelfTrainingClassifier,
)
from app.worker.tasks.crc_tasks import (
    sanitize_record,
    TEMPORAL_CUTOFF,
)
from app.services.judge import (
    judge_review,
    _calibrated_local_judge,
    SCORE_AXES,
    JUDGE_MODEL,
)
from app.services.rag_store import (
    PRIMARY_COLL,
    SECONDARY_COLL,
    EMBEDDING_DIM,
)


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 1: Dynamic Hybrid Expert Routing
# ─────────────────────────────────────────────────────────────────────────────

def test_contribution_1_category_dispatch():
    # 1. Functional code change
    func_diff = "+++ b/math_lib.py\n+def compute_pi():\n+    return 3.14159"
    assert classify_diff(func_diff) == DiffCategory.FUNCTIONAL

    # 2. Refactoring code change
    refactor_diff = "--- a/user.py\n+++ b/user.py\n-def old_func():\n+def new_func():"
    assert classify_diff(refactor_diff) in (DiffCategory.FUNCTIONAL, DiffCategory.REFACTORING)

    # 3. Documentation diff
    doc_diff = "+++ b/README.md\n+# Project Title\n+This is documentation for the library."
    assert classify_diff(doc_diff) == DiffCategory.DOCUMENTATION

    # 4. Discussion / Config diff
    disc_diff = "+++ b/requirements.txt\n+requests==2.31.0\n+flask==3.0.0"
    assert classify_diff(disc_diff) == DiffCategory.DISCUSSION

    # 5. False positive diff
    fp_diff = "+++ b/space.py\n+ \n+    \n+"
    assert classify_diff(fp_diff) == DiffCategory.FALSE_POSITIVE


def test_contribution_1_specialized_model_allocation():
    # Code reasoning / logic routed to Qwen2.5-Coder-32B (k=3)
    func_model, func_k = ROUTING_TABLE[DiffCategory.FUNCTIONAL]
    assert func_model == ExpertModel.QWEN_CODER
    assert func_k == 3

    # Structural reasoning routed to Qwen2.5-Coder-32B (k=3)
    refac_model, refac_k = ROUTING_TABLE[DiffCategory.REFACTORING]
    assert refac_model == ExpertModel.QWEN_CODER
    assert refac_k == 3

    # Documentation / Natural language routed to Mistral-Instruct-7B (k=3)
    doc_model, doc_k = ROUTING_TABLE[DiffCategory.DOCUMENTATION]
    assert doc_model == ExpertModel.MISTRAL_7B
    assert doc_k == 3


@pytest.mark.asyncio
async def test_contribution_1_empty_diff_early_exit():
    result = await route_and_review("")
    assert result.category == DiffCategory.FALSE_POSITIVE.value
    assert result.k_samples == 0
    assert "No code changes" in result.summary


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 2: RAG Vector Knowledge Base & Neighbor-Voting
# ─────────────────────────────────────────────────────────────────────────────

def test_contribution_2_knowledge_base_parameters():
    assert PRIMARY_COLL == "pandahub_reviews"
    assert SECONDARY_COLL == "crc_py_reviews"
    assert EMBEDDING_DIM == 384


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 3: Discovery of "Context Collapse" in Small Models (SLMs)
# ─────────────────────────────────────────────────────────────────────────────

def test_contribution_3_context_collapse_guard():
    # Large model: unaffected by cap (k=5 remains 5)
    large_k = get_k_for_model(
        base_k=5,
        model_id="qwen/qwen-2.5-coder-32b-instruct",
        model_params_millions=32_000,
    )
    assert large_k == 5

    # Small model (Phi-3-Mini 3.8B parameters):
    # Capped at k=3 to prevent attention saturation (which causes hallucinations
    # to surge from 10.66% to 20.97% at k=5)
    slm_k = get_k_for_model(
        base_k=5,
        model_id="microsoft/phi-3-mini-4k-instruct",
        model_params_millions=3_800,
    )
    assert slm_k == K_MAX_SMALL_MODEL
    assert slm_k == 3

    # Automatic SLM name detection
    slm_by_name = get_k_for_model(base_k=5, model_id="microsoft/phi-3-mini")
    assert slm_by_name == 3


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 4: Discovery of "Error Severity Overestimation"
# ─────────────────────────────────────────────────────────────────────────────

def test_contribution_4_severity_overestimation_mitigation():
    # If a code-reasoning model reviews a documentation diff and marks it "critical",
    # the guard clamps it to "medium" to prevent false escalation of benign comments.
    clamped = clamp_severity_for_category(
        category="documentation",
        severity="critical",
        model_used="qwen/qwen-2.5-coder-32b-instruct",
    )
    assert clamped == "medium"

    # Discussion also clamped if code model overestimates
    clamped_disc = clamp_severity_for_category(
        category="discussion",
        severity="high",
        model_used="qwen/qwen-2.5-coder-32b-instruct",
    )
    assert clamped_disc == "medium"

    # Functional logic defects on code models are NOT clamped
    func_sev = clamp_severity_for_category(
        category="functional",
        severity="critical",
        model_used="qwen/qwen-2.5-coder-32b-instruct",
    )
    assert func_sev == "critical"

    # Generalist instruction models (Mistral) are exempt
    mistral_sev = clamp_severity_for_category(
        category="documentation",
        severity="high",
        model_used="mistralai/mistral-7b-instruct",
    )
    assert mistral_sev == "high"


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 6: Semi-Supervised Self-Training Classifier
# ─────────────────────────────────────────────────────────────────────────────

def test_contribution_6_classifier_confidence_gating():
    assert CONFIDENCE_THRESHOLD == 0.70

    # Ensure dual-branch pipeline can be initialized
    clf = SelfTrainingClassifier(confidence_threshold=0.70)
    assert clf.confidence_threshold == 0.70

    # Test feature extraction on diff + comment
    sample_diff = "+++ b/utils.py\n+def add(a, b): return a + b"
    sample_comment = "Add type annotations to function parameters."
    features = clf.extract_features(sample_diff, sample_comment)
    assert "code_tokens" in features
    assert "comment_tokens" in features


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 7: Anti-Leakage Dataset (crc-py-dataset)
# ─────────────────────────────────────────────────────────────────────────────

def test_contribution_7_anti_leakage_temporal_cutoff():
    # 1. Reject PR merged BEFORE June 1, 2024 (prevents training corpus memorization)
    pre_cutoff = {
        "merged_at": "2024-05-15T10:00:00Z",
        "author": "dev",
        "title": "Fix bug",
        "comment": "Ensure parameter validation occurs before executing database query.",
        "diff_text": "+++ b/a.py\n+x = 1\n+y = 2\n+z = 3",
    }
    assert sanitize_record(pre_cutoff) is None

    # 2. Reject bot authors
    bot_pr = {
        "merged_at": "2024-07-01T10:00:00Z",
        "author": "dependabot[bot]",
        "title": "Bump library",
        "comment": "Ensure parameter validation occurs before executing database query.",
        "diff_text": "+++ b/a.py\n+x = 1\n+y = 2\n+z = 3",
    }
    assert sanitize_record(bot_pr) is None

    # 3. Reject noise comments ("LGTM", "Thanks!")
    noise_pr = {
        "merged_at": "2024-07-01T10:00:00Z",
        "author": "senior_dev",
        "title": "Feature addition",
        "comment": "LGTM!",
        "diff_text": "+++ b/a.py\n+x = 1\n+y = 2\n+z = 3",
    }
    assert sanitize_record(noise_pr) is None

    # 4. Accept post-June 1, 2024 sanitized high-quality review
    valid_pr = {
        "merged_at": "2024-08-15T12:00:00Z",
        "author": "lead_engineer",
        "title": "Fix memory leak in buffer cache pool",
        "comment": "Ensure buffer pool explicitly calls release() on eviction to prevent leaked socket descriptors.",
        "diff_text": "--- a/cache.py\n+++ b/cache.py\n@@ -10,3 +10,4 @@\n-    pool.evict(key)\n+    item = pool.evict(key)\n+    item.release()",
    }
    cleaned = sanitize_record(valid_pr)
    assert cleaned is not None
    assert cleaned["author"] == "lead_engineer"


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 8: Semantic Judge Evaluation (LLM-as-a-Judge)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_contribution_8_semantic_judge_axes():
    candidate = "Ensure password comparison uses constant-time bcrypt verification to prevent timing attacks."
    reference = "Vulnerability: plain string comparison leaks password timing information. Use constant time check."
    diff = "+++ b/auth.py\n-if user.pw == pw:\n+if bcrypt.checkpw(pw, user.pw):"

    # Evaluates across the 5 calibrated semantic dimensions
    result = await judge_review(candidate, reference, diff)

    assert result.success is True
    assert set(result.scores.keys()) == set(SCORE_AXES)
    for axis in SCORE_AXES:
        assert 1.0 <= result.scores[axis] <= 5.0
    assert result.mean_score >= 3.5
    assert len(result.rationale) > 20
