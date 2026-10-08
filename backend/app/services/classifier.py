"""
Semi-Supervised Self-Training Classifier — Module 11 Contribution 6.

Architecture
────────────
Dual-branch feature extraction combining:
  • Character-level n-gram TF-IDF on the raw diff text
    (captures code syntax, symbols, punctuation patterns)
  • Word-level n-gram TF-IDF on normalized review comments
    (captures natural-language intent signals)

Both branches are concatenated and fed to a LinearSVC wrapped in
CalibratedClassifierCV, which gives calibrated probability estimates
needed for the confidence-gated self-training loop (τ = 0.7).

Self-Training Algorithm (semi-supervised)
─────────────────────────────────────────
1.  Train base classifier on labelled seed data (crc-py-dataset +
    any manually labelled project history rows).
2.  Apply the classifier to unlabelled diffs (PRs where the AI review
    ran but no gold category was human-confirmed).
3.  If max(class_probability) ≥ τ (confidence threshold), add the
    prediction to the training set as a pseudo-label.
4.  Retrain on original labels + pseudo-labels. Repeat for N rounds or
    until pseudo-label set stops growing by > δ%.

Context-Collapse Guard (Contribution 3)
───────────────────────────────────────
When routing to a small model (≤ 3.8B parameters), the retrieval k
is capped at K_MAX_SMALL = 3 to prevent attention saturation.
Exceeding this threshold on Phi-3-Mini was shown to increase
hallucination rate from 10.66% → 20.97% (context collapse).

Error Severity Overestimation Mitigation (Contribution 4)
──────────────────────────────────────────────────────────
Coding specialist models (Qwen2.5-Coder) systematically over-estimate
severity for documentation and discussion diffs.
Guard: if the classifier category is DOCUMENTATION or DISCUSSION,
the maximum permissible severity is clamped to 'medium' when the
request was routed to a code-reasoning model.

Public API
──────────
  SelfTrainingClassifier               — the trainable classifier
  classify_with_ml(diff, comment)      — predict category + confidence
  build_classifier(labelled)           — train from scratch
  run_self_training(clf, unlabelled)   — iterative pseudo-labelling
  clamp_severity_for_category(cat, sev, model) → str
  get_k_for_model(base_k, model_size)  → int
"""
from __future__ import annotations

import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger("app.services.classifier")

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

CONFIDENCE_THRESHOLD  = 0.70   # τ — pseudo-label gate
SELF_TRAINING_ROUNDS  = 5      # max iterations of pseudo-label expansion
GROWTH_STOP_DELTA     = 0.02   # stop early if pseudo-set grows < 2%

# Context-collapse guard: small-model k cap
K_MAX_SMALL_MODEL     = 3      # Phi-3-Mini / ≤3.8B class
SMALL_MODEL_THRESHOLD = 4_000  # million parameters cutoff (≤4B = "small")

# Severity rank used for clamping
_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
_RANK_SEVERITY = {v: k for k, v in _SEVERITY_RANK.items()}

# Doc/Discussion categories that trigger severity clamping when code models review them
_SOFT_CATEGORIES = {"documentation", "discussion"}
_CODE_REASONING_MODELS = {"qwen/qwen-2.5-coder-32b-instruct"}

CATEGORIES = ["functional", "refactoring", "documentation", "discussion", "false_positive"]

# Path for persisting the trained classifier artifact
_ARTIFACT_PATH = Path(__file__).parent.parent.parent / "data" / "classifier.pkl"


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 3 — Context-Collapse Guard
# ─────────────────────────────────────────────────────────────────────────────

def get_k_for_model(base_k: int, model_id: str, model_params_millions: int = 9999) -> int:
    """
    Apply the context-collapse guard from Contribution 3.

    For small models (≤ 3.8B parameters / SMALL_MODEL_THRESHOLD), caps the
    retrieval k at K_MAX_SMALL_MODEL (3) to prevent attention saturation.

    Larger models (Qwen2.5-Coder-32B, Mistral-7B) are unaffected.

    Research finding: Phi-3-Mini at k=5 raises hallucination rate from
    10.66% → 20.97% due to context overflow in attention mechanisms.

    Args:
        base_k              : The k value from the routing table.
        model_id            : OpenRouter model ID string.
        model_params_millions: Model parameter count (millions). Default 9999
                              means "large, no cap needed". Populate this from
                              a model registry when available.

    Returns:
        Effective k, capped if the model is small.
    """
    model_lower = model_id.lower()
    is_slm_by_name = any(tag in model_lower for tag in ["phi-3", "3.8b", "mini", "1b", "3b", "gemma-2b"])
    is_small = (model_params_millions <= SMALL_MODEL_THRESHOLD) or is_slm_by_name
    if is_small:
        effective_k = min(base_k, K_MAX_SMALL_MODEL)
        if effective_k < base_k:
            logger.info(
                "Context-collapse guard: capping k %d → %d for small model %s (prevents attention saturation and hallucination surge from 10.66%% to 20.97%%)",
                base_k, effective_k, model_id,
            )
        return effective_k
    return base_k


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 4 — Error Severity Overestimation Mitigation
# ─────────────────────────────────────────────────────────────────────────────

def clamp_severity_for_category(
    category: str,
    severity: str,
    model_used: str,
) -> str:
    """
    Clamp over-estimated severity when a code-reasoning model reviews soft content.

    Contribution 4 finding: Qwen2.5-Coder systematically misclassifies benign
    style/documentation suggestions as 'high' or 'critical' functional defects.

    Rule: if the diff category is DOCUMENTATION or DISCUSSION and the model
    that generated the review is a code-reasoning specialist, cap severity at
    'medium'.  Generalist models (Mistral, Claude) are exempt — they correctly
    calibrate severity for prose/config content.

    Args:
        category   : Classifier-assigned category string.
        severity   : Raw severity from the expert model.
        model_used : Model ID that generated the review.

    Returns:
        Corrected severity string (same or lower).
    """
    if category in _SOFT_CATEGORIES and model_used in _CODE_REASONING_MODELS:
        raw_rank   = _SEVERITY_RANK.get(severity, 1)
        capped_rank = min(raw_rank, 1)  # cap at 'medium' (rank 1)
        clamped    = _RANK_SEVERITY[capped_rank]
        if clamped != severity:
            logger.info(
                "Severity overestimation guard: clamped %s → %s "
                "(category=%s, model=%s)",
                severity, clamped, category, model_used,
            )
        return clamped
    return severity


# ─────────────────────────────────────────────────────────────────────────────
# Contribution 6 — Semi-Supervised Self-Training Classifier
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class LabelledSample:
    """A labelled training example for the classifier."""
    diff_text: str
    review_comment: str
    category: str
    confidence: float = 1.0  # 1.0 = gold label; < 1.0 = pseudo-label


@dataclass
class ClassificationResult:
    """Output of classify_with_ml()."""
    category: str
    confidence: float
    all_probs: Dict[str, float] = field(default_factory=dict)
    source: str = "ml"   # 'ml' | 'heuristic' | 'pseudolabel'


class SelfTrainingClassifier:
    """
    Dual-branch character + word n-gram LinearSVC classifier with
    calibrated probability output and iterative pseudo-label expansion.

    Usage::

        clf = SelfTrainingClassifier()
        clf.fit(labelled_samples)
        clf.self_train(unlabelled_diffs)          # optional expansion
        result = clf.predict(diff_text, comment)  # → ClassificationResult
        clf.save()  / SelfTrainingClassifier.load()
    """

    def __init__(self, confidence_threshold: float = CONFIDENCE_THRESHOLD) -> None:
        self.confidence_threshold = confidence_threshold
        self._pipeline = None  # sklearn Pipeline, built lazily
        self._fitted   = False

    def extract_features(self, diff_text: str, review_comment: str = "") -> Dict[str, Any]:
        """Dual-branch feature representation for inspection and diagnostics."""
        return {
            "code_tokens": len(diff_text.split()),
            "comment_tokens": len(review_comment.split()),
            "char_ngrams_count": len(diff_text),
            "word_ngrams_count": len(review_comment),
        }

    # ── Build the sklearn pipeline ─────────────────────────────────────────

    def _build_pipeline(self):
        """Construct the dual-branch feature → LinearSVC pipeline."""
        try:
            from sklearn.pipeline import Pipeline, FeatureUnion
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.svm import LinearSVC
            from sklearn.calibration import CalibratedClassifierCV
            from sklearn.preprocessing import LabelEncoder  # noqa: F401
        except ImportError as e:
            raise RuntimeError(
                "scikit-learn is required for the semi-supervised classifier. "
                "Run: pip install scikit-learn"
            ) from e

        # Branch A: character n-grams on the raw diff
        char_tfidf = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 5),
            max_features=30_000,
            sublinear_tf=True,
        )
        # Branch B: word n-grams on the review comment
        word_tfidf = TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 3),
            max_features=20_000,
            sublinear_tf=True,
        )

        # FeatureUnion concatenates branches — each branch gets its own input
        # via a helper that selects the correct column from (diff, comment) tuples.
        # We flatten into a single text per branch before vectorising.
        class _BranchSelector:
            def __init__(self, idx): self.idx = idx
            def fit(self, X, y=None): return self
            def transform(self, X): return [x[self.idx] for x in X]
            def get_params(self, deep=True): return {"idx": self.idx}

        from sklearn.pipeline import Pipeline as _P
        branch_a = _P([("sel", _BranchSelector(0)), ("tfidf", char_tfidf)])
        branch_b = _P([("sel", _BranchSelector(1)), ("tfidf", word_tfidf)])

        union = FeatureUnion([("diff_chars", branch_a), ("comment_words", branch_b)])

        base_svc = LinearSVC(
            C=1.0,
            max_iter=2000,
            class_weight="balanced",
        )
        calibrated = CalibratedClassifierCV(
            base_svc,
            method="sigmoid",   # Platt scaling — fast, good for SVM
            cv=5,
        )
        pipeline = Pipeline([
            ("features", union),
            ("clf", calibrated),
        ])
        return pipeline

    # ── Fit ───────────────────────────────────────────────────────────────

    def fit(self, samples: Sequence[LabelledSample]) -> "SelfTrainingClassifier":
        """
        Train on labelled samples.

        Args:
            samples: Gold-labelled or pseudo-labelled LabelledSample instances.

        Returns:
            self (fluent)
        """
        if not samples:
            logger.warning("SelfTrainingClassifier.fit() called with 0 samples.")
            return self

        X = [(s.diff_text, s.review_comment) for s in samples]
        y = [s.category for s in samples]

        self._pipeline = self._build_pipeline()
        try:
            self._pipeline.fit(X, y)
            self._fitted = True
            logger.info(
                "SelfTrainingClassifier fitted on %d samples (categories=%s)",
                len(samples),
                sorted(set(y)),
            )
        except Exception as exc:
            logger.error("Classifier fit failed: %s", exc, exc_info=True)
            raise
        return self

    # ── Predict ───────────────────────────────────────────────────────────

    def predict(self, diff_text: str, review_comment: str = "") -> ClassificationResult:
        """
        Predict category + calibrated confidence for a single sample.

        Args:
            diff_text      : Unified diff string.
            review_comment : Associated review comment (may be empty for new PRs).

        Returns:
            ClassificationResult with predicted category and class probabilities.
        """
        if not self._fitted or self._pipeline is None:
            raise RuntimeError("Classifier not fitted. Call fit() first.")

        proba = self._pipeline.predict_proba([[diff_text, review_comment]])[0]
        classes = self._pipeline.classes_
        prob_map = dict(zip(classes, proba.tolist()))

        best_idx = int(np.argmax(proba))
        best_cat = classes[best_idx]
        best_conf = float(proba[best_idx])

        return ClassificationResult(
            category=best_cat,
            confidence=best_conf,
            all_probs=prob_map,
            source="ml",
        )

    # ── Self-training loop ─────────────────────────────────────────────────

    def self_train(
        self,
        unlabelled: Sequence[Tuple[str, str]],
        base_samples: Sequence[LabelledSample] = (),
        rounds: int = SELF_TRAINING_ROUNDS,
        tau: float = CONFIDENCE_THRESHOLD,
    ) -> int:
        """
        Iteratively expand the training set with high-confidence pseudo-labels.

        Algorithm:
          For each round:
            1. Predict on all unlabelled (diff, comment) pairs.
            2. Collect predictions with confidence ≥ τ as pseudo-labels.
            3. Combine with gold labels and retrain.
            4. Stop early if pseudo-set growth < GROWTH_STOP_DELTA or
               no rounds remain.

        Args:
            unlabelled  : List of (diff_text, review_comment) tuples.
            base_samples: Original gold-labelled samples (merged into every round).
            rounds      : Maximum self-training iterations.
            tau         : Confidence threshold for pseudo-label acceptance.

        Returns:
            Total number of pseudo-labels accepted across all rounds.
        """
        if not self._fitted:
            raise RuntimeError("Fit the classifier before running self-training.")

        pseudo_labels: List[LabelledSample] = []
        total_accepted = 0

        for r in range(rounds):
            new_pseudo: List[LabelledSample] = []
            for diff_text, comment in unlabelled:
                result = self.predict(diff_text, comment)
                if result.confidence >= tau:
                    new_pseudo.append(LabelledSample(
                        diff_text=diff_text,
                        review_comment=comment,
                        category=result.category,
                        confidence=result.confidence,
                    ))

            if not new_pseudo:
                logger.info("Self-training round %d: no pseudo-labels above τ=%.2f. Done.", r + 1, tau)
                break

            prev_count = len(pseudo_labels)
            # Only keep pseudo-labels not already in our set (by diff_text)
            existing_diffs = {s.diff_text for s in pseudo_labels}
            truly_new = [s for s in new_pseudo if s.diff_text not in existing_diffs]

            if not truly_new:
                logger.info("Self-training round %d: no new pseudo-labels. Converged.", r + 1)
                break

            pseudo_labels.extend(truly_new)
            total_accepted += len(truly_new)

            # Early stop: growth fell below delta threshold
            growth = len(truly_new) / max(prev_count + len(unlabelled), 1)
            logger.info(
                "Self-training round %d: accepted %d pseudo-labels (growth=%.1f%%, total=%d)",
                r + 1, len(truly_new), growth * 100, len(pseudo_labels),
            )
            if growth < GROWTH_STOP_DELTA and r > 0:
                logger.info("Self-training converged (growth < %.1f%%).", GROWTH_STOP_DELTA * 100)
                break

            # Retrain on gold + pseudo
            all_samples = list(base_samples) + pseudo_labels
            self.fit(all_samples)

        return total_accepted

    # ── Persistence ───────────────────────────────────────────────────────

    def save(self, path: Path = _ARTIFACT_PATH) -> None:
        """Pickle the fitted pipeline to disk."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            pickle.dump(self._pipeline, f)
        logger.info("Classifier artifact saved to %s", path)

    @classmethod
    def load(cls, path: Path = _ARTIFACT_PATH) -> "SelfTrainingClassifier":
        """Load a previously saved classifier from disk."""
        if not path.exists():
            raise FileNotFoundError(f"Classifier artifact not found at {path}")
        instance = cls()
        with path.open("rb") as f:
            instance._pipeline = pickle.load(f)
        instance._fitted = True
        logger.info("Classifier loaded from %s", path)
        return instance


# ─────────────────────────────────────────────────────────────────────────────
# Convenience builders
# ─────────────────────────────────────────────────────────────────────────────

def build_classifier(labelled_records: List[Dict[str, Any]]) -> SelfTrainingClassifier:
    """
    Build and fit a SelfTrainingClassifier from raw record dicts.

    Args:
        labelled_records: List of dicts with keys:
            diff_text, review_comment, category (required)
            severity (optional)

    Returns:
        Fitted SelfTrainingClassifier.
    """
    samples = [
        LabelledSample(
            diff_text=r["diff_text"],
            review_comment=r.get("review_comment", ""),
            category=r["category"],
        )
        for r in labelled_records
        if r.get("diff_text") and r.get("category") in CATEGORIES
    ]
    clf = SelfTrainingClassifier()
    clf.fit(samples)
    return clf


def classify_with_ml(
    diff_text: str,
    review_comment: str = "",
    clf: Optional[SelfTrainingClassifier] = None,
) -> Optional[ClassificationResult]:
    """
    Classify a diff using the ML classifier if available.

    Loads the persisted artifact if no classifier is passed.
    Returns None on any error so callers fall back to the heuristic classifier.

    Args:
        diff_text      : Unified diff text.
        review_comment : Associated review comment or empty string.
        clf            : Pre-loaded classifier (optional; loaded from disk if None).

    Returns:
        ClassificationResult or None if ML is unavailable.
    """
    try:
        if clf is None:
            clf = SelfTrainingClassifier.load()
        return clf.predict(diff_text, review_comment)
    except FileNotFoundError:
        logger.debug("ML classifier artifact not found — using heuristic fallback.")
        return None
    except Exception as exc:
        logger.warning("ML classification failed (non-fatal): %s", exc)
        return None


def run_self_training(
    clf: SelfTrainingClassifier,
    unlabelled_diffs: List[Dict[str, str]],
    base_samples: List[LabelledSample] = (),
) -> int:
    """
    Convenience wrapper: run the self-training expansion loop.

    Args:
        clf              : An already-fitted SelfTrainingClassifier.
        unlabelled_diffs : List of dicts with 'diff_text' (and optionally
                           'review_comment') for pseudo-labelling.
        base_samples     : Original gold labels to include in every round.

    Returns:
        Total pseudo-labels accepted.
    """
    pairs = [
        (r.get("diff_text", ""), r.get("review_comment", ""))
        for r in unlabelled_diffs
    ]
    total = clf.self_train(pairs, base_samples=base_samples)
    clf.save()
    return total
