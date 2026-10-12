"""
RAG Store — Retrieval-Augmented Generation vector database layer.

Architecture
────────────
Two Qdrant collections form a knowledge base with cold-start coverage:

  PRIMARY   collection: "pandahub_reviews"
    ─ Per-project history of real PR diffs + review comments from this
      PandaHub instance. Grows over time as PRs are merged and reviewed.
    ─ Searched first; most relevant because it mirrors the target repo's
      conventions, language, frameworks, and team style.

  SECONDARY collection: "crc_py_reviews"
    ─ Bootstrapped from the open-source crc-py-dataset (high-quality
      Python PR reviews from GitHub). Provides coverage on day-0 when a
      project has no internal review history.
    ─ Used as a fallback when the primary returns fewer than MIN_PRIMARY_K
      results, or blended in proportionally.

Embedding
─────────
  Model : sentence-transformers/all-MiniLM-L6-v2
  Dims  : 384
  Metric: Cosine similarity

  Chosen because it is:
    - Free to run locally (no API cost for embedding generation)
    - 384 dimensions — compact but expressive for code-review semantics
    - Ships in the sentence-transformers package, no extra API keys needed

Neighbor-Voting Categorization
───────────────────────────────
After retrieving the top-k neighbours for a diff, this module counts the
majority category across the returned payloads and returns it alongside
the retrieved context.  This is the "Neighbor-Voting" step described in
the research: the vote is used to cross-check the heuristic classifier's
output before building the prompt template sent to the expert model.

Public API (all async)
──────────────────────
  retrieve_context(diff_text, repo_id, k) → RAGContext
  index_review(diff_text, review_json, repo_id, category, ...)
  seed_secondary_collection(records)      → ingestion helper
  ensure_collections_exist()             → idempotent setup
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("app.services.rag_store")


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

EMBEDDING_DIM     = 384
EMBEDDING_MODEL   = "sentence-transformers/all-MiniLM-L6-v2"
PRIMARY_COLL      = "pandahub_reviews"
SECONDARY_COLL    = "crc_py_reviews"
TOP_K             = 5          # neighbours per collection
MIN_PRIMARY_K     = 2          # blend secondary if primary yields fewer results
MAX_DIFF_CHARS    = 8_000      # truncate before embedding (tokens vs cost)

# Score below which we discard a neighbour as semantically irrelevant
SCORE_THRESHOLD   = 0.35


# ─────────────────────────────────────────────────────────────────────────────
# Lazy singleton helpers (import-time safety)
# ─────────────────────────────────────────────────────────────────────────────

_encoder = None          # SentenceTransformer model
_qdrant  = None          # QdrantClient


def _get_encoder():
    """Lazy-load SentenceTransformer to avoid import-time GPU/CPU overhead."""
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer
        _encoder = SentenceTransformer(EMBEDDING_MODEL)
        logger.info("Loaded embedding model: %s (dim=%d)", EMBEDDING_MODEL, EMBEDDING_DIM)
    return _encoder


def _get_qdrant():
    """Lazy-create QdrantClient using settings."""
    global _qdrant
    if _qdrant is None:
        from qdrant_client import QdrantClient
        from app.core.config import get_settings
        s = get_settings()
        host = getattr(s, "QDRANT_HOST", "qdrant")
        port = int(getattr(s, "QDRANT_PORT", 6333))
        api_key = getattr(s, "QDRANT_API_KEY", None)
        _qdrant = QdrantClient(host=host, port=port, api_key=api_key or None)
        logger.info("Connected to Qdrant at %s:%d", host, port)
    return _qdrant


# ─────────────────────────────────────────────────────────────────────────────
# Embedding helper
# ─────────────────────────────────────────────────────────────────────────────

def _embed(text: str) -> List[float]:
    """
    Generate a 384-dimensional embedding for *text*.

    The text is truncated to MAX_DIFF_CHARS before encoding to keep inference
    fast — diffs beyond ~8 000 characters are usually repetitive (generated
    files, lock file changes) and the tail rarely contributes unique signal.
    """
    truncated = text[:MAX_DIFF_CHARS]
    encoder = _get_encoder()
    vector = encoder.encode(truncated, normalize_embeddings=True)
    return vector.tolist()


async def embed_async(text: str) -> List[float]:
    """
    Non-blocking wrapper: runs CPU-bound encoding in a thread executor
    so it does not stall the FastAPI/asyncio event loop.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _embed, text)


# ─────────────────────────────────────────────────────────────────────────────
# Collection bootstrap
# ─────────────────────────────────────────────────────────────────────────────

def ensure_collections_exist() -> None:
    """
    Idempotently create both Qdrant collections if they do not exist.

    Called once at worker startup and before the first index/retrieval.
    Safe to call multiple times — existing collections are not modified.
    """
    from qdrant_client.models import Distance, VectorParams

    client = _get_qdrant()
    existing = {c.name for c in client.get_collections().collections}

    for coll_name in (PRIMARY_COLL, SECONDARY_COLL):
        if coll_name not in existing:
            client.create_collection(
                collection_name=coll_name,
                vectors_config=VectorParams(
                    size=EMBEDDING_DIM,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("Created Qdrant collection: %s", coll_name)
        else:
            logger.debug("Qdrant collection already exists: %s", coll_name)


# ─────────────────────────────────────────────────────────────────────────────
# RAGContext dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RAGContext:
    """
    Output of retrieve_context().

    Attributes:
        neighbours          Top-k most similar past reviews, each carrying
                            diff snippet + review comment + metadata.
        voted_category      Majority category across neighbours (string), or
                            None if no clear majority.
        category_votes      Raw vote tally dict for transparency / logging.
        primary_count       Number of results from the project-specific layer.
        secondary_count     Number of results from the crc-py fallback layer.
        prompt_context      Pre-formatted string block ready to inject into
                            the LLM system prompt.
    """
    neighbours: List[Dict[str, Any]]
    voted_category: Optional[str]
    category_votes: Dict[str, int]
    primary_count: int
    secondary_count: int
    prompt_context: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Neighbour-voting categorization
# ─────────────────────────────────────────────────────────────────────────────

def _majority_vote_category(neighbours: List[Dict[str, Any]]) -> Tuple[Optional[str], Dict[str, int]]:
    """
    Compute majority-vote category from k retrieved neighbours.

    Each neighbour's payload carries a 'category' field populated at index
    time by the hybrid router's classifier.  We count votes and return the
    winner, along with the full tally for logging / debugging.

    Returns:
        (winning_category or None, {category: count, ...})
    """
    votes: Dict[str, int] = {}
    for nb in neighbours:
        cat = nb.get("payload", {}).get("category", "")
        if cat:
            votes[cat] = votes.get(cat, 0) + 1

    if not votes:
        return None, {}

    max_count = max(votes.values())
    winners = [c for c, n in votes.items() if n == max_count]
    # Deterministic tie-break: alphabetical
    return sorted(winners)[0], votes


# ─────────────────────────────────────────────────────────────────────────────
# Retrieval
# ─────────────────────────────────────────────────────────────────────────────

def _search_collection(
    client,
    collection: str,
    vector: List[float],
    repo_id: Optional[str],
    k: int,
    score_threshold: float,
) -> List[Dict[str, Any]]:
    """
    Search one Qdrant collection and return scored hit dicts.

    For the PRIMARY collection, we apply an optional repo_id filter so that
    only reviews from the same project are returned (project-specific context).
    For the SECONDARY collection no filter is applied (global dataset).
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    query_filter = None
    if collection == PRIMARY_COLL and repo_id:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="repo_id",
                    match=MatchValue(value=str(repo_id)),
                )
            ]
        )

    hits = client.search(
        collection_name=collection,
        query_vector=vector,
        limit=k,
        score_threshold=score_threshold,
        query_filter=query_filter,
        with_payload=True,
    )
    return [
        {
            "id": str(hit.id),
            "score": round(hit.score, 4),
            "source": collection,
            "payload": hit.payload or {},
        }
        for hit in hits
    ]


async def retrieve_context(
    diff_text: str,
    repo_id: Optional[str] = None,
    k: int = TOP_K,
) -> RAGContext:
    """
    Two-layer RAG retrieval with neighbour-voting categorization.

    Algorithm:
      1. Embed the incoming diff (384-dim, cosine).
      2. Query PRIMARY collection filtered by repo_id.
      3. If primary results < MIN_PRIMARY_K, also query SECONDARY.
      4. Merge and rank by cosine score descending.
      5. Majority-vote the 'category' field across top-k hits.
      6. Format a prompt_context block for injection into the LLM prompt.

    Args:
        diff_text : Unified diff text of the pull request.
        repo_id   : UUID of the target repository (for primary layer filter).
        k         : Number of neighbours to retrieve per layer.

    Returns:
        RAGContext with neighbours, category vote, and formatted prompt block.
    """
    if not diff_text.strip():
        return RAGContext(
            neighbours=[],
            voted_category=None,
            category_votes={},
            primary_count=0,
            secondary_count=0,
            prompt_context="",
        )

    # ── Embed in thread pool ──
    try:
        vector = await embed_async(diff_text)
    except Exception as exc:
        logger.warning("Embedding failed, skipping RAG retrieval: %s", exc)
        return RAGContext(
            neighbours=[],
            voted_category=None,
            category_votes={},
            primary_count=0,
            secondary_count=0,
            prompt_context="",
        )

    client = _get_qdrant()
    loop   = asyncio.get_running_loop()

    # ── Layer 1: Primary (project-specific) ──
    primary_hits = await loop.run_in_executor(
        None,
        _search_collection,
        client, PRIMARY_COLL, vector, repo_id, k, SCORE_THRESHOLD,
    )

    # ── Layer 2: Secondary (crc-py-dataset fallback) ──
    secondary_hits: List[Dict[str, Any]] = []
    if len(primary_hits) < MIN_PRIMARY_K:
        secondary_hits = await loop.run_in_executor(
            None,
            _search_collection,
            client, SECONDARY_COLL, vector, None, k, SCORE_THRESHOLD,
        )
        logger.debug(
            "Primary returned %d hits (< %d), pulled %d secondary hits",
            len(primary_hits), MIN_PRIMARY_K, len(secondary_hits),
        )

    # ── Merge and rank ──
    all_hits = primary_hits + secondary_hits
    all_hits.sort(key=lambda h: h["score"], reverse=True)
    top_hits = all_hits[:k]

    # ── Neighbour-voting categorization ──
    voted_category, category_votes = _majority_vote_category(top_hits)

    logger.info(
        "RAG retrieved %d neighbours (primary=%d, secondary=%d) "
        "voted_category=%s votes=%s",
        len(top_hits),
        len(primary_hits),
        len(secondary_hits),
        voted_category,
        category_votes,
    )

    # ── Format prompt context block ──
    prompt_context = _format_prompt_context(top_hits)

    return RAGContext(
        neighbours=top_hits,
        voted_category=voted_category,
        category_votes=category_votes,
        primary_count=len(primary_hits),
        secondary_count=len(secondary_hits),
        prompt_context=prompt_context,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Prompt context formatting
# ─────────────────────────────────────────────────────────────────────────────

def _format_prompt_context(hits: List[Dict[str, Any]]) -> str:
    """
    Format retrieved neighbours into a prompt-injectable context block.

    Each hit is rendered as a numbered example with the original diff snippet
    and the associated review comment.  The block is prefixed with a
    section header that instructs the model to use these as style/convention
    references, not to copy them verbatim.
    """
    if not hits:
        return ""

    lines = [
        "## Similar Historical Reviews (use as style/convention reference only)\n"
    ]
    for i, hit in enumerate(hits, 1):
        payload  = hit.get("payload", {})
        snippet  = payload.get("diff_snippet", "")[:600]
        comment  = payload.get("review_comment", "")[:400]
        category = payload.get("category", "unknown")
        source   = "project history" if hit["source"] == PRIMARY_COLL else "open-source dataset"
        score    = hit["score"]

        lines.append(
            f"### Example {i} (category={category}, similarity={score:.2f}, source={source})\n"
            f"**Diff snippet:**\n```diff\n{snippet}\n```\n"
            f"**Review comment:** {comment}\n"
        )

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Indexing
# ─────────────────────────────────────────────────────────────────────────────

def _make_point_id(diff_text: str, repo_id: Optional[str]) -> str:
    """
    Deterministic UUID from diff content + repo_id.

    Using a content hash means re-indexing the same diff is idempotent —
    Qdrant upsert will overwrite rather than duplicate.
    """
    raw = f"{repo_id or ''}::{diff_text[:2000]}"
    h   = hashlib.sha256(raw.encode()).hexdigest()
    return str(uuid.UUID(h[:32]))


async def index_review(
    diff_text: str,
    review_comment: str,
    repo_id: Optional[str],
    category: str,
    severity: str = "medium",
    pr_id: Optional[str] = None,
    collection: str = PRIMARY_COLL,
) -> bool:
    """
    Embed and upsert a (diff, review) pair into the specified Qdrant collection.

    Args:
        diff_text      : Unified diff text of the pull request.
        review_comment : Merged review comment / summary text to store.
        repo_id        : UUID of the repository (for primary layer filtering).
        category       : Classifier-assigned category (functional, refactoring…).
        severity       : Review severity level.
        pr_id          : Optional PR UUID for traceability.
        collection     : Which Qdrant collection to upsert into.

    Returns:
        True on success, False on failure.
    """
    from qdrant_client.models import PointStruct

    try:
        ensure_collections_exist()
        vector    = await embed_async(diff_text)
        point_id  = _make_point_id(diff_text, repo_id)

        payload = {
            "repo_id":        str(repo_id) if repo_id else None,
            "pr_id":          str(pr_id)   if pr_id   else None,
            "category":       category,
            "severity":       severity,
            "diff_snippet":   diff_text[:1000],
            "review_comment": review_comment[:800],
            "indexed_at":     int(time.time()),
        }

        client = _get_qdrant()
        loop   = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: client.upsert(
                collection_name=collection,
                points=[PointStruct(id=point_id, vector=vector, payload=payload)],
            ),
        )
        logger.debug(
            "Indexed review point %s into %s (category=%s, repo=%s)",
            point_id, collection, category, repo_id,
        )
        return True

    except Exception as exc:
        logger.error("Failed to index review into Qdrant: %s", exc, exc_info=True)
        return False


async def seed_secondary_collection(
    records: List[Dict[str, Any]],
    batch_size: int = 64,
) -> int:
    """
    Bulk-upsert open-source review records into the SECONDARY collection.

    Each record dict must have:
        diff_text      : str  — the code diff
        review_comment : str  — the review text
        category       : str  — the semantic category label
        severity       : str  — 'low' | 'medium' | 'high' | 'critical'

    Returns:
        Number of successfully upserted records.
    """
    from qdrant_client.models import PointStruct

    ensure_collections_exist()
    client  = _get_qdrant()
    loop    = asyncio.get_running_loop()
    success = 0

    for i in range(0, len(records), batch_size):
        batch  = records[i : i + batch_size]
        points = []

        for rec in batch:
            try:
                diff_text      = rec.get("diff_text", "")
                review_comment = rec.get("review_comment", "")
                category       = rec.get("category", "functional")
                severity       = rec.get("severity", "medium")

                vector   = _embed(diff_text)
                point_id = _make_point_id(diff_text, None)

                points.append(
                    PointStruct(
                        id=point_id,
                        vector=vector,
                        payload={
                            "repo_id":        None,
                            "pr_id":          None,
                            "category":       category,
                            "severity":       severity,
                            "diff_snippet":   diff_text[:1000],
                            "review_comment": review_comment[:800],
                            "indexed_at":     int(time.time()),
                            "source_dataset": "crc-py-dataset",
                        },
                    )
                )
            except Exception as exc:
                logger.warning("Skipping record due to embed error: %s", exc)

        if points:
            await loop.run_in_executor(
                None,
                lambda pts=points: client.upsert(
                    collection_name=SECONDARY_COLL,
                    points=pts,
                ),
            )
            success += len(points)
            logger.info(
                "Seeded batch %d-%d into %s (%d/%d total)",
                i, i + len(batch), SECONDARY_COLL, success, len(records),
            )

    return success
