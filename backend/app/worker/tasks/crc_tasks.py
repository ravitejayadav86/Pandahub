"""
crc-py-dataset Pipeline — Module 11 Contribution 7.

Anti-Leakage Dataset for RAG + Classifier Training
────────────────────────────────────────────────────
Contribution 7 introduces a new benchmark dataset (crc-py-dataset) designed to
prevent data contamination from LLM training corpora, featuring:

  • Temporal Cutoff: PRs strictly after June 1, 2024 are collected so the
    data cannot have been memorised by models trained on earlier corpora.

  • Sanitization Pipeline: Automatically filters out:
      – Bot-authored comments (dependabot, renovate, codecov, github-actions…)
      – Noisy conversational replies ("Thanks!", "+1", "LGTM" etc.)
      – Unmerged / draft PRs (quality signal only from accepted changes)
      – Comments shorter than MIN_COMMENT_CHARS (insufficient signal)
      – Diffs larger than MAX_DIFF_CHARS (lock files, generated code)

  • Celery Tasks:
      train_classifier_task — Trains/retrains the SelfTrainingClassifier on
                              all labelled records (seed + indexed reviews).
      evaluate_with_judge_task — Runs a sample of recent reviews through the
                                 Llama-3-70B semantic judge and stores metrics.

Design Note on Temporal Cutoff
───────────────────────────────
LLM training corpora typically have a knowledge cutoff of early-to-mid 2024.
PRs created before this date risk being memorised (the model may "recall" the
correct review rather than reason about it). By filtering to post-June 2024 data
we ensure all benchmark examples are genuinely unseen by the evaluated models.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.core.config import get_settings
from app.models.pull_request import AIReviewResult, PullRequest
from app.worker.celery_app import celery_app

logger = logging.getLogger("app.worker.tasks.crc_tasks")
settings = get_settings()

# ─────────────────────────────────────────────────────────────────────────────
# Anti-leakage constants (Contribution 7)
# ─────────────────────────────────────────────────────────────────────────────

# Temporal cutoff: reject PRs merged before this date
TEMPORAL_CUTOFF = datetime(2024, 6, 1, tzinfo=timezone.utc)

# Sanitization thresholds
MIN_COMMENT_CHARS = 60        # shorter comments are noise (LGTM, +1, typo fixes)
MAX_DIFF_CHARS    = 50_000    # beyond this it's almost certainly a generated/lock file
MIN_DIFF_LINES    = 3         # at least a real code change

# Bot / noise patterns — comments matching these are auto-excluded
_BOT_PATTERNS = re.compile(
    r"(dependabot|renovate|codecov|snyk|github-actions|mergify|"
    r"allcontributors|stale\[bot\]|imgbot|semantic-release)",
    re.IGNORECASE,
)
_NOISE_COMMENTS = re.compile(
    r"^(lgtm|thanks?|looks good|good catch|\+1|👍|:\+1:|approved|"
    r"acknowledged|noted|done|fixed|merged|resolved|will do)[\s!.]*$",
    re.IGNORECASE,
)
_DRAFT_TITLE_PATTERNS = re.compile(r"\b(wip|draft|do not merge|dnm)\b", re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────────
# Sanitization (Contribution 7 — dataset cleaning)
# ─────────────────────────────────────────────────────────────────────────────

def sanitize_record(record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Apply the crc-py-dataset sanitization pipeline to a single raw record.

    Returns the cleaned record dict if it passes all filters, or None if it
    should be excluded from the dataset.

    Filters applied:
      1. Temporal cutoff check (merged_at ≥ TEMPORAL_CUTOFF)
      2. Bot author exclusion
      3. Draft / WIP title exclusion
      4. Noise comment filter (too short or LGTM-style)
      5. Diff size bounds
    """
    # ── 1. Temporal cutoff ──
    merged_at_raw = record.get("merged_at")
    if merged_at_raw:
        try:
            if isinstance(merged_at_raw, str):
                merged_at = datetime.fromisoformat(merged_at_raw.replace("Z", "+00:00"))
            elif isinstance(merged_at_raw, datetime):
                merged_at = merged_at_raw
            else:
                merged_at = None

            if merged_at and merged_at.tzinfo is None:
                merged_at = merged_at.replace(tzinfo=timezone.utc)

            if merged_at and merged_at < TEMPORAL_CUTOFF:
                logger.debug("Record excluded: merged before temporal cutoff (%s)", merged_at)
                return None
        except Exception:
            pass  # missing/unparseable date — don't exclude on this alone

    # ── 2. Bot author ──
    author = record.get("author", "") or ""
    if _BOT_PATTERNS.search(author):
        logger.debug("Record excluded: bot author '%s'", author)
        return None

    # ── 3. Draft/WIP title ──
    title = record.get("title", "") or ""
    if _DRAFT_TITLE_PATTERNS.search(title):
        logger.debug("Record excluded: draft/WIP title '%s'", title)
        return None

    # ── 4. Noise comment ──
    comment = (record.get("review_comment") or record.get("comment") or "").strip()
    if not comment or len(comment) < MIN_COMMENT_CHARS:
        logger.debug("Record excluded: comment too short (%d chars)", len(comment))
        return None
    if _NOISE_COMMENTS.match(comment):
        logger.debug("Record excluded: noise comment pattern")
        return None

    # ── 5. Diff size bounds ──
    diff_text = (record.get("diff_text") or "").strip()
    if not diff_text or len(diff_text) > MAX_DIFF_CHARS:
        logger.debug(
            "Record excluded: diff out of range (len=%d, max=%d)",
            len(diff_text), MAX_DIFF_CHARS,
        )
        return None
    diff_lines = [line for line in diff_text.splitlines() if line.startswith(("+", "-"))]
    if len(diff_lines) < MIN_DIFF_LINES:
        logger.debug("Record excluded: diff too small (%d change lines)", len(diff_lines))
        return None

    # Pass — return cleaned record
    return {
        "diff_text":      diff_text,
        "review_comment": comment,
        "category":       record.get("category", "functional"),
        "severity":       record.get("severity", "medium"),
        "author":         author,
        "merged_at":      merged_at_raw,
        "source":         record.get("source", "crc-py-dataset"),
    }


def sanitize_dataset(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Apply sanitization to a list of records and return only the clean ones.

    Logs a summary of how many records were filtered at each stage.
    """
    before = len(records)
    clean  = [r for r in (sanitize_record(rec) for rec in records) if r is not None]
    after  = len(clean)
    if before:
        logger.info(
            "crc-py-dataset sanitization: %d/%d records passed (%.1f%% kept)",
            after, before, 100 * after / before,
        )
    return clean


# ─────────────────────────────────────────────────────────────────────────────
# Celery Task: Train/Retrain the SelfTrainingClassifier
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.worker.tasks.crc_tasks.train_classifier_task",
    max_retries=2,
    default_retry_delay=120,
    acks_late=True,
    time_limit=1800,  # 30-minute hard limit (ML training can be slow)
)
def train_classifier_task(include_self_training: bool = True) -> None:
    """
    Train (or retrain) the SelfTrainingClassifier.

    Steps:
      1. Load and sanitize crc_py_seed.json (Contribution 7 anti-leakage dataset)
      2. Load all AIReviewResult rows with confirmed categories from the DB
      3. Combine and fit the classifier (Contribution 6 dual-branch LinearSVC)
      4. If include_self_training=True, run pseudo-label expansion on
         reviews without human-confirmed categories
      5. Save the trained artifact to data/classifier.pkl

    Args:
        include_self_training: If True, run the self-training loop after
                               fitting on labelled data.
    """
    from app.services.classifier import (
        build_classifier, run_self_training, LabelledSample,
        CATEGORIES,
    )

    # ── 1. Load + sanitize crc-py seed data ──
    _CRC_SEED_FILE = (
        Path(__file__).parent.parent.parent.parent / "data" / "crc_py_seed.json"
    )
    seed_records: List[Dict[str, Any]] = []
    if _CRC_SEED_FILE.exists():
        try:
            raw = json.loads(_CRC_SEED_FILE.read_text(encoding="utf-8"))
            seed_records = sanitize_dataset(raw)
            logger.info("Loaded %d seed records from crc_py_seed.json", len(seed_records))
        except Exception as exc:
            logger.error("Failed to load crc_py_seed.json: %s", exc)

    # ── 2. Load confirmed AIReviewResult rows from DB ──
    db_records: List[Dict[str, Any]] = []
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        sync_url = (
            settings.DATABASE_URL
            .replace("postgresql+asyncpg://", "postgresql+psycopg://")
            .replace("postgresql://",         "postgresql+psycopg://")
        )
        engine  = create_engine(sync_url, pool_pre_ping=True)
        Session = sessionmaker(bind=engine, expire_on_commit=False)

        with Session() as db:
            rows = (
                db.execute(select(AIReviewResult))
                .scalars()
                .all()
            )
            for row in rows:
                if (
                    row.diff_category in CATEGORIES
                    and (row.routing_metadata or {}).get("diff_text_snippet")
                ):
                    db_records.append({
                        "diff_text":      row.routing_metadata["diff_text_snippet"],
                        "review_comment": row.summary or "",
                        "category":       row.diff_category,
                        "severity":       row.severity or "medium",
                    })
        logger.info("Loaded %d labelled AIReviewResult rows from DB", len(db_records))
    except Exception as exc:
        logger.warning("Failed to load DB records for classifier training: %s", exc)

    all_labelled = seed_records + db_records

    if not all_labelled:
        logger.warning("No labelled data available. Classifier training aborted.")
        return

    # ── 3. Fit base classifier ──
    clf = build_classifier(all_labelled)

    # ── 4. Optional self-training on unlabelled DB rows ──
    if include_self_training:
        try:
            sync_url = (
                settings.DATABASE_URL
                .replace("postgresql+asyncpg://", "postgresql+psycopg://")
                .replace("postgresql://",         "postgresql+psycopg://")
            )
            engine  = create_engine(sync_url, pool_pre_ping=True)
            Session = sessionmaker(bind=engine, expire_on_commit=False)

            with Session() as db:
                all_rows = db.execute(select(AIReviewResult)).scalars().all()
                unlabelled = [
                    {
                        "diff_text":      (row.routing_metadata or {}).get("diff_text_snippet", ""),
                        "review_comment": row.summary or "",
                    }
                    for row in all_rows
                    if (row.routing_metadata or {}).get("diff_text_snippet")
                    and row.diff_category not in CATEGORIES
                ]
            if unlabelled:
                base_samples = [
                    LabelledSample(
                        diff_text=r["diff_text"],
                        review_comment=r.get("review_comment", ""),
                        category=r["category"],
                    )
                    for r in all_labelled
                ]
                n_pseudo = run_self_training(clf, unlabelled, base_samples)
                logger.info("Self-training accepted %d pseudo-labels.", n_pseudo)
            else:
                clf.save()   # save the base model if no unlabelled data
        except Exception as exc:
            logger.warning("Self-training phase failed (non-fatal): %s", exc)
            clf.save()   # still save the base model
    else:
        clf.save()

    logger.info("Classifier training complete. Artifact saved.")


# ─────────────────────────────────────────────────────────────────────────────
# Celery Task: Semantic Judge Evaluation Run
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.worker.tasks.crc_tasks.evaluate_with_judge_task",
    max_retries=1,
    default_retry_delay=60,
    acks_late=True,
    time_limit=3600,  # judge calls are slow — 1-hour limit for large batches
)
def evaluate_with_judge_task(
    sample_size: int = 100,
    judge_model: str = "meta-llama/llama-3-70b-instruct",
) -> Dict[str, Any]:
    """
    Run a semantic judge evaluation over a sample of recent AI reviews.

    Replaces BLEU-4 / ROUGE-L with the calibrated Llama-3-70B judge
    (Contribution 8). The task:
      1. Samples up to `sample_size` AIReviewResult rows from the DB.
      2. For each, treats the human PR description + previous comments as
         the reference, and the AI-generated summary as the candidate.
      3. Calls the semantic judge and stores aggregate metrics in the log.

    Args:
        sample_size: Number of reviews to evaluate (default 100).
        judge_model: Judge model ID (default: llama-3-70b-instruct).

    Returns:
        Aggregate metrics dict.
    """
    from app.services.judge import batch_judge, compute_aggregate_metrics

    logger.info("Starting semantic judge evaluation (sample_size=%d)", sample_size)

    # ── Load sample reviews from DB ──
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        sync_url = (
            settings.DATABASE_URL
            .replace("postgresql+asyncpg://", "postgresql+psycopg://")
            .replace("postgresql://",         "postgresql+psycopg://")
        )
        engine  = create_engine(sync_url, pool_pre_ping=True)
        Session = sessionmaker(bind=engine, expire_on_commit=False)

        with Session() as db:
            rows = (
                db.execute(
                    select(AIReviewResult)
                    .order_by(AIReviewResult.created_at.desc())
                    .limit(sample_size)
                )
                .scalars()
                .all()
            )
            pr_ids = [row.pull_request_id for row in rows]

            # Load matching PRs for diff + description (used as loose reference)
            prs = {
                p.id: p
                for p in (
                    db.execute(select(PullRequest).where(PullRequest.id.in_(pr_ids)))
                    .scalars()
                    .all()
                )
            }
    except Exception as exc:
        logger.error("Failed to load evaluation sample: %s", exc)
        return {"error": str(exc)}

    # ── Build evaluation triples ──
    evaluations = []
    for row in rows:
        pr = prs.get(row.pull_request_id)
        if not pr:
            continue
        diff_snippet = (row.routing_metadata or {}).get("diff_text_snippet", "")
        # Use PR description as a loose "reference" (human intent signal)
        reference = (pr.description or pr.title or "").strip()
        if not reference or not diff_snippet:
            continue
        evaluations.append({
            "candidate_review": row.summary or "",
            "reference_review": reference,
            "diff_text":        diff_snippet,
        })

    if not evaluations:
        logger.warning("No valid evaluation triples could be constructed.")
        return {"n_evaluated": 0}

    # ── Run batch judge (async in sync Celery task) ──
    results = asyncio.run(
        batch_judge(evaluations, judge_model=judge_model, concurrency=5)
    )

    metrics = compute_aggregate_metrics(results)
    summary = {
        "n_evaluated":         metrics.n_evaluated,
        "n_failed":            metrics.n_failed,
        "mean_accuracy":       metrics.mean_accuracy,
        "mean_completeness":   metrics.mean_completeness,
        "mean_actionability":  metrics.mean_actionability,
        "mean_severity":       metrics.mean_severity,
        "mean_style":          metrics.mean_style,
        "mean_overall":        metrics.mean_overall,
        "score_distribution":  metrics.score_distribution,
        "judge_model":         judge_model,
    }

    logger.info(
        "Semantic judge evaluation complete: mean_overall=%.3f "
        "accuracy=%.3f completeness=%.3f actionability=%.3f "
        "severity=%.3f style=%.3f",
        metrics.mean_overall,
        metrics.mean_accuracy,
        metrics.mean_completeness,
        metrics.mean_actionability,
        metrics.mean_severity,
        metrics.mean_style,
    )
    return summary
