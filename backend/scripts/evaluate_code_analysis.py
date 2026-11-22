"""Evaluate deterministic code-analysis rules against a labelled JSON dataset.

This script reports static-rule metrics only. It does not claim to measure LLM
quality or model accuracy. Keep near-duplicate source files in one split.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.code_analysis_service import analyze_source  # noqa: E402


def _metrics(tp: int, fp: int, fn: int, tn: int) -> dict[str, float | None]:
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and precision + recall
        else None
    )
    accuracy = (tp + tn) / (tp + fp + fn + tn) if tp + fp + fn + tn else 0.0
    return {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=str(BACKEND_ROOT / "data" / "code_analysis_benchmark.json"))
    parser.add_argument("--split", choices=["train", "validation", "test", "all"], default="test")
    args = parser.parse_args()

    dataset = json.loads(Path(args.dataset).read_text(encoding="utf-8"))
    cases = dataset["cases"]
    label_space = set(dataset["label_space"])

    # Reject accidental leakage: identical normalized source cannot be in more
    # than one split. Hash uses language + code, not filename.
    hash_splits: dict[str, set[str]] = defaultdict(set)
    for case in cases:
        digest = hashlib.sha256((case["language"] + "\0" + case["source_code"].strip()).encode()).hexdigest()
        hash_splits[digest].add(case["split"])
    leaked = [digest for digest, splits in hash_splits.items() if len(splits) > 1]
    if leaked:
        raise SystemExit(f"Dataset leakage: {len(leaked)} identical source fingerprints cross splits.")

    selected = [c for c in cases if args.split == "all" or c["split"] == args.split]
    if not selected:
        raise SystemExit(f"No benchmark cases in split: {args.split}")

    tp = fp = fn = tn = 0
    per_rule: dict[str, list[int]] = {rule: [0, 0, 0, 0] for rule in sorted(label_space)}
    failures = []
    for case in selected:
        result = analyze_source(case["source_code"], case["language"], case["filename"])
        predicted = {
            item["rule_id"] for item in result["findings"]
            if item.get("severity") != "info" and item["rule_id"] in label_space
        }
        expected = set(case["expected_rule_ids"])
        if not expected <= label_space:
            raise SystemExit(f"Unknown labels in case {case['case_id']}: {expected - label_space}")
        for label in label_space:
            if label in predicted and label in expected:
                tp += 1; per_rule[label][0] += 1
            elif label in predicted:
                fp += 1; per_rule[label][1] += 1
            elif label in expected:
                fn += 1; per_rule[label][2] += 1
            else:
                tn += 1; per_rule[label][3] += 1
        if predicted != expected:
            failures.append({"case_id": case["case_id"], "expected": sorted(expected), "predicted": sorted(predicted)})

    per_rule_output = {}
    for rule, counts in per_rule.items():
        per_rule_output[rule] = {
            "counts": dict(zip(("tp", "fp", "fn", "tn"), counts)),
            "positive_support": counts[0] + counts[2],
            "predicted_positive": counts[0] + counts[1],
            "metrics": _metrics(*counts),
        }

    print(json.dumps({
        "dataset_version": dataset.get("version"),
        "split": args.split,
        "case_count": len(selected),
        "split_counts": dict(Counter(c["split"] for c in cases)),
        "confusion_counts": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "metrics": _metrics(tp, fp, fn, tn),
        "per_rule": per_rule_output,
        "mismatches": failures,
        "limitations": [
            "This is a small seed benchmark, not a statistically sufficient evaluation set.",
            "Metrics evaluate deterministic static rule IDs only, not AI-generated review quality.",
            "Expand and independently label the holdout set before making accuracy claims.",
        ],
    }, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
