"""
AI Intelligence API Router — Module 11.
Exposes overview, benchmark telemetry, and management endpoints for the 8 core
system contributions:
  1. Dynamic Hybrid Expert Routing
  2. Two-Layer Vector RAG & Neighbor-Voting Categorization
  3. Context Collapse Guard for Small Language Models (SLMs)
  4. Error Severity Overestimation Mitigation
  5. Asynchronous Continuous Indexing Loop
  6. Semi-Supervised Self-Training Classifier (tau = 0.7)
  7. Anti-Leakage Dataset Pipeline (crc-py-dataset, temporal cutoff June 1, 2024)
  8. Semantic Judge Evaluation (LLM-as-a-Judge, Llama-3-70B, kappa = 0.78)
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.dependencies import get_current_active_user
from app.db.session import get_db
from app.models.pull_request import AIReviewResult
from app.models.user import User
from app.services.classifier import (
    CONFIDENCE_THRESHOLD,
    K_MAX_SMALL_MODEL,
    CATEGORIES,
    _SOFT_CATEGORIES,
)
from app.services.rag_store import PRIMARY_COLL, SECONDARY_COLL, EMBEDDING_DIM
from app.services.judge import JUDGE_MODEL, SCORE_AXES

router = APIRouter(prefix="/ai", tags=["ai-intelligence"])
logger = logging.getLogger("app.api.v1.ai")


@router.get("/overview", summary="Comprehensive AI Intelligence & Benchmark Overview")
async def get_ai_overview(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Returns live architectural telemetry and research parameters for all
    8 contributions of the PandaHub AI Code Review System.
    """
    total_reviews = await db.scalar(select(func.count(AIReviewResult.id))) or 0

    category_counts_res = await db.execute(
        select(AIReviewResult.diff_category, func.count(AIReviewResult.id)).group_by(
            AIReviewResult.diff_category
        )
    )
    category_counts = {cat: count for cat, count in category_counts_res.all()}

    return {
        "status": "active",
        "contributions": {
            "1_dynamic_hybrid_expert_routing": {
                "title": "Dynamic Hybrid Expert Routing",
                "semantic_categories": CATEGORIES,
                "routing_table": {
                    "functional": {"model": "Qwen2.5-Coder-32B", "k": 3, "focus": "AST & Logic Correctness"},
                    "refactoring": {"model": "Qwen2.5-Coder-32B", "k": 3, "focus": "Structural Reasoning"},
                    "documentation": {"model": "Mistral-Instruct-7B", "k": 3, "focus": "Natural Language Fluency"},
                    "discussion": {"model": "Mistral-Instruct-7B", "k": 3, "focus": "Configuration & Prose"},
                    "false_positive": {"model": "early_exit", "k": 0, "focus": "Zero API Cost Filter"},
                },
                "performance_gain": {
                    "hybrid_vs_zero_shot": "+13.2% net gain",
                    "hybrid_vs_single_best": "+7.7% net gain",
                },
                "total_cached_reviews": total_reviews,
                "category_distribution": category_counts,
            },
            "2_rag_vector_db": {
                "title": "Two-Layer Vector Knowledge Base (Qdrant)",
                "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
                "embedding_dimensions": EMBEDDING_DIM,
                "primary_layer": {
                    "collection": PRIMARY_COLL,
                    "purpose": "Target project history for repository-specific conventions and style",
                },
                "secondary_layer": {
                    "collection": SECONDARY_COLL,
                    "purpose": "crc-py-dataset for cold-start coverage on new projects",
                },
                "neighbor_voting": {
                    "strategy": "Top-k cosine similarity majority voting",
                    "purpose": "Infer PR intent before prompt synthesis and cross-check classifier",
                },
            },
            "3_context_collapse_guard": {
                "title": "Context Collapse Mitigation in Small Models (SLMs)",
                "discovery": "While larger models benefit from retrieved examples (k=3), smaller models (Phi-3-Mini 3.8B) suffer Context Collapse at k=5 where attention saturation surges hallucinations from 10.66% to 20.97%.",
                "guard_policy": {
                    "slm_parameter_ceiling": "3.8B parameters",
                    "max_k_for_slm": K_MAX_SMALL_MODEL,
                    "status": "Enforced dynamically in router",
                },
            },
            "4_error_severity_overestimation": {
                "title": "Error Severity Overestimation Mitigation",
                "discovery": "Specialized coding models (Qwen2.5-Coder) systematically misclassify benign style and doc suggestions as critical defects.",
                "solution": {
                    "dispatch_redirection": "Documentation and discussion diffs routed to generalist instruction models (Mistral-Instruct-7B)",
                    "severity_clamp": "Strict cap to medium for soft categories if reviewed by reasoning models",
                    "soft_categories": list(_SOFT_CATEGORIES),
                },
            },
            "5_asynchronous_continuous_indexing_loop": {
                "title": "Asynchronous Continuous Indexing Loop",
                "architecture": "Decoupled background Celery worker",
                "trigger": "Pull request approved and merged",
                "mechanism": "Extracts code diff + comment pairs, generates 384-d MiniLM vectors, upserts into Qdrant primary layer without blocking PR merge latency",
            },
            "6_semi_supervised_classifier": {
                "title": "Semi-Supervised Self-Training Classifier",
                "feature_extraction": "Dual-branch (character-level n-grams on code + word-level n-grams on comments)",
                "model": "LinearSVC wrapped in CalibratedClassifierCV",
                "confidence_threshold": f"tau = {CONFIDENCE_THRESHOLD}",
                "algorithm": "Iterative pseudo-labeling with confidence gating (tau >= 0.7)",
            },
            "7_anti_leakage_dataset": {
                "title": "crc-py-dataset Anti-Leakage Pipeline",
                "temporal_cutoff": "2024-06-01T00:00:00Z (strictly after June 1, 2024 to prevent LLM training set memorization)",
                "sanitization_filters": [
                    "Automated bot comments (Dependabot, Renovate, Codecov...)",
                    "Noisy conversational replies (LGTM, Thanks, +1)",
                    "Unmerged / draft PRs",
                    "Comments < 60 characters or diffs > 50,000 characters",
                ],
            },
            "8_semantic_judge_evaluation": {
                "title": "Semantic Judge Evaluation (LLM-as-a-Judge)",
                "finding": "Traditional lexical metrics (BLEU-4, ROUGE-L) fail to assess code review quality because valid technical feedback has varied syntactic forms.",
                "judge_model": JUDGE_MODEL,
                "evaluation_axes": SCORE_AXES,
                "human_calibration": "Validated against senior software engineers with kappa = 0.78 inter-annotator agreement across >39,000 evaluations",
            },
        },
    }


@router.post("/retrain-classifier", summary="Trigger semi-supervised classifier self-training (Contribution 6)")
async def trigger_classifier_retraining(
    _user: User = Depends(get_current_active_user),
) -> dict:
    """Dispatches the Celery task to retrain the classifier with confidence gating."""
    try:
        from app.worker.tasks.crc_tasks import train_classifier_task
        task = train_classifier_task.delay()
        return {"message": "Classifier self-training task queued.", "task_id": str(task.id)}
    except Exception as exc:
        logger.error("Failed to queue classifier retraining: %s", exc)
        return {"error": str(exc)}


@router.post("/seed-rag", summary="Seed Qdrant secondary collection with crc-py-dataset (Contribution 2, 7)")
async def trigger_rag_seeding(
    _user: User = Depends(get_current_active_user),
) -> dict:
    """Dispatches Celery task to populate the secondary Qdrant collection."""
    try:
        from app.worker.tasks.rag_tasks import seed_crc_dataset_task
        task = seed_crc_dataset_task.delay()
        return {"message": "RAG secondary seeding task queued.", "task_id": str(task.id)}
    except Exception as exc:
        logger.error("Failed to queue RAG seeding: %s", exc)
        return {"error": str(exc)}
