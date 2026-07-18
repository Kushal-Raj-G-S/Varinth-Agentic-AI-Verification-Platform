"""
retriever.py
------------
Bounded, secure evidence retriever for Varinth.

For each claim, this searches the configured SourceScope for relevant file
snippets using a two-stage strategy:

  Stage 1: Keyword scan (fast, deterministic)
    - Extract key terms from the claim text
    - Scan allowed files for lines matching those terms

  Stage 2: Semantic re-ranking (NVIDIA embedding-based cosine similarity)
    - Embed the claim and each candidate snippet
    - Re-rank by cosine similarity
    - Return top-N candidates

Security guarantees:
  - Every file path is canonicalized via os.path.realpath() before opening
  - Paths outside the configured root are rejected with SecurityViolationError
  - Only whitelisted extensions are read
  - Excluded directories are skipped
  - Max file size: configurable (default 512KB)
  - Max files scanned per run: configurable (default 500)
"""
import os
import re
import math
import sqlite3
import hashlib
import json
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import (
    SecurityViolationError,
    assert_path_in_scope,
    is_allowed_extension,
    is_excluded_dir,
)
from app.services.llm_client import LLMUnavailableError, get_llm_client

settings = get_settings()
logger = get_logger("varinth.retriever")

class EmbeddingCache:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS embeddings (
                        hash TEXT PRIMARY KEY,
                        embedding TEXT
                    )
                """)
                conn.commit()
        except Exception as e:
            logger.warning("failed_to_initialize_embedding_cache_db", error=str(e))

    def get(self, text: str) -> list[float] | None:
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT embedding FROM embeddings WHERE hash = ?", (text_hash,))
                row = cursor.fetchone()
                if row:
                    return json.loads(row[0])
        except Exception:
            pass
        return None

    def set(self, text: str, embedding: list[float]):
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO embeddings (hash, embedding) VALUES (?, ?)",
                    (text_hash, json.dumps(embedding))
                )
                conn.commit()
        except Exception:
            pass

MAX_SNIPPET_LINES = 15
MAX_EVIDENCE_PER_CLAIM = 10
SNIPPET_CONTEXT_LINES = 3     # lines of context around a match


class RetrievalScopeViolation(Exception):
    pass


# ---------------------------------------------------------------------------
# Evidence candidate (internal)
# ---------------------------------------------------------------------------

class EvidenceCandidate:
    def __init__(
        self,
        source_id: str,
        location: str,
        snippet: str,
        relevance_score: float = 0.0,
        retrieval_rank: int = 0,
    ):
        self.source_id = source_id
        self.location = location
        self.snippet = snippet
        self.relevance_score = relevance_score
        self.retrieval_rank = retrieval_rank

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "location": self.location,
            "snippet": self.snippet,
            "relevance_score": round(self.relevance_score, 4),
            "retrieval_rank": self.retrieval_rank,
            "supports_claim": None,
            "contradicts_claim": None,
        }


# ---------------------------------------------------------------------------
# Retriever
# ---------------------------------------------------------------------------

class EvidenceRetriever:
    def __init__(self) -> None:
        self._client = get_llm_client()
        services_dir = os.path.dirname(os.path.realpath(__file__))
        workspace_root = os.path.realpath(os.path.join(services_dir, "..", "..", ".."))
        cache_dir = os.path.join(workspace_root, "backend", "temp_clone")
        os.makedirs(cache_dir, exist_ok=True)
        self._cache = EmbeddingCache(os.path.join(cache_dir, "embeddings_cache.db"))

    async def retrieve(
        self,
        claim_text: str,
        root_path: str,
        scope_relative_path: str = "",
    ) -> list[dict[str, Any]]:
        """
        Retrieve evidence for a single claim from the bounded file scope.

        Args:
            claim_text: The normalized claim to verify.
            root_path: Absolute path to the SourceContext root.
            scope_relative_path: Relative path within root for the scope.
                                  Empty string means the entire root.
        Returns:
            List of evidence item dicts, ranked by relevance.
        """
        # Determine the search directory and validate it
        if scope_relative_path:
            scope_dir = os.path.join(root_path, scope_relative_path)
        else:
            scope_dir = root_path

        try:
            safe_scope_dir = assert_path_in_scope(root_path, scope_dir)
        except SecurityViolationError as exc:
            logger.error(
                "retrieval_scope_violation",
                root=root_path,
                scope=scope_dir,
                error=str(exc),
            )
            raise RetrievalScopeViolation(str(exc)) from exc

        if not os.path.isdir(safe_scope_dir):
            logger.warning(
                "retrieval_scope_not_found",
                scope_dir=safe_scope_dir,
            )
            return []

        # Stage 1: Keyword scan
        keywords = _extract_keywords(claim_text)
        candidates = self._keyword_scan(
            root_path=root_path,
            search_dir=safe_scope_dir,
            keywords=keywords,
        )

        if not candidates:
            return []

        # Stage 2: Semantic re-ranking (attempt; fallback to keyword score)
        candidates = await self._semantic_rerank(claim_text, candidates)

        # Return top-N
        results = candidates[:MAX_EVIDENCE_PER_CLAIM]
        for rank, c in enumerate(results, start=1):
            c.retrieval_rank = rank

        logger.info(
            "evidence_retrieved",
            claim_preview=claim_text[:80],
            total_candidates=len(candidates),
            returned=len(results),
        )
        return [c.to_dict() for c in results]

    # ------------------------------------------------------------------
    # Stage 1: Keyword scan
    # ------------------------------------------------------------------

    def _keyword_scan(
        self,
        root_path: str,
        search_dir: str,
        keywords: list[str],
    ) -> list[EvidenceCandidate]:
        if not keywords:
            return []

        candidates: list[EvidenceCandidate] = []
        files_scanned = 0
        max_file_bytes = settings.max_file_size_kb * 1024

        for dirpath, dirnames, filenames in os.walk(search_dir):
            # Filter out excluded directories in-place (modifies walk)
            dirnames[:] = [
                d for d in dirnames if not is_excluded_dir(d)
            ]

            for filename in filenames:
                if files_scanned >= settings.max_files_per_scope:
                    logger.warning(
                        "max_files_scanned_reached",
                        limit=settings.max_files_per_scope,
                    )
                    return candidates

                filepath = os.path.join(dirpath, filename)

                if not is_allowed_extension(filename):
                    continue

                # Security: canonicalize and validate path
                try:
                    safe_filepath = assert_path_in_scope(root_path, filepath)
                except SecurityViolationError:
                    logger.warning(
                        "retrieval_path_violation_skipped",
                        path=filepath,
                    )
                    continue

                # Skip large files
                try:
                    file_size = os.path.getsize(safe_filepath)
                    if file_size > max_file_bytes:
                        continue
                except OSError:
                    continue

                files_scanned += 1

                try:
                    file_candidates = self._scan_file(
                        root_path=root_path,
                        filepath=safe_filepath,
                        keywords=keywords,
                    )
                    candidates.extend(file_candidates)
                except (OSError, UnicodeDecodeError):
                    continue

        return candidates

    def _scan_file(
        self,
        root_path: str,
        filepath: str,
        keywords: list[str],
    ) -> list[EvidenceCandidate]:
        """Scan a single file for keyword matches. Returns candidate snippets."""
        with open(filepath, encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        relative_path = os.path.relpath(filepath, root_path).replace("\\", "/")
        candidates: list[EvidenceCandidate] = []
        seen_line_ranges: set[tuple[int, int]] = set()

        for line_num, line in enumerate(lines):
            line_lower = line.lower()
            match_count = sum(1 for kw in keywords if kw.lower() in line_lower)
            if match_count == 0:
                continue

            # Extract snippet with context
            start = max(0, line_num - SNIPPET_CONTEXT_LINES)
            end = min(len(lines), line_num + SNIPPET_CONTEXT_LINES + 1)

            # Avoid overlapping snippets
            range_key = (start, end)
            if range_key in seen_line_ranges:
                continue
            seen_line_ranges.add(range_key)

            snippet = "".join(lines[start:end]).strip()
            if not snippet:
                continue

            # Score by keyword density in snippet
            snippet_lower = snippet.lower()
            score = sum(
                snippet_lower.count(kw.lower()) for kw in keywords
            ) / max(len(keywords), 1)
            score = min(score / 3.0, 1.0)  # normalize roughly

            location = f"line {start + 1}–{end}"
            candidates.append(EvidenceCandidate(
                source_id=relative_path,
                location=location,
                snippet=snippet[:1500],  # cap snippet length
                relevance_score=score,
            ))

        return candidates

    # ------------------------------------------------------------------
    # Stage 2: Semantic re-ranking via NVIDIA embeddings
    # ------------------------------------------------------------------

    async def _semantic_rerank(
        self,
        claim_text: str,
        candidates: list[EvidenceCandidate],
    ) -> list[EvidenceCandidate]:
        """
        Compute cosine similarity between claim embedding and each candidate
        snippet embedding. Re-rank by similarity score.
        Falls back to keyword score if embedding fails.
        """
        try:
            claim_embedding = self._cache.get(claim_text)
            if not claim_embedding:
                claim_embedding = await self._client.embed(claim_text)
                self._cache.set(claim_text, claim_embedding)

            # Embed up to 30 candidates in a single batch call with cache checks
            candidates_to_embed = candidates[:30]
            uncached_candidates = []
            uncached_snippets = []
            snippet_embeddings_map = {}

            for idx, c in enumerate(candidates_to_embed):
                snippet_text = c.snippet[:512]
                cached_emb = self._cache.get(snippet_text)
                if cached_emb:
                    snippet_embeddings_map[idx] = cached_emb
                else:
                    uncached_candidates.append(idx)
                    uncached_snippets.append(snippet_text)

            if uncached_snippets:
                new_embeddings = await self._client.embed_batch(
                    uncached_snippets, input_type="passage"
                )
                for idx, emb in zip(uncached_candidates, new_embeddings):
                    snippet_embeddings_map[idx] = emb
                    self._cache.set(candidates_to_embed[idx].snippet[:512], emb)

            snippet_embeddings = [snippet_embeddings_map[idx] for idx in range(len(candidates_to_embed))]

            scored: list[tuple[float, EvidenceCandidate]] = []
            for candidate, snippet_embedding in zip(candidates_to_embed, snippet_embeddings):
                sim = _cosine_similarity(claim_embedding, snippet_embedding)
                candidate.relevance_score = sim
                scored.append((sim, candidate))

            # Apply exact token match boost to bridge semantic-lexical gaps
            tokens = re.findall(r'[a-zA-Z0-9_\-\.\/]{4,}', claim_text)
            for candidate in candidates_to_embed:
                for token in tokens:
                    if token.lower() in {
                        "project", "system", "model", "database", "backend",
                        "frontend", "server", "config", "using", "uses", "used"
                    }:
                        continue
                    if token in candidate.snippet:
                        candidate.relevance_score = min(candidate.relevance_score + 0.15, 1.0)

            # Sort by boosted relevance score descending
            scored.sort(key=lambda x: x[1].relevance_score, reverse=True)
            return [c for _, c in scored]

        except LLMUnavailableError:
            logger.warning(
                "semantic_rerank_unavailable_using_keyword_score"
            )
            # Fall back: sort by existing keyword relevance score
            candidates.sort(key=lambda c: c.relevance_score, reverse=True)
            return candidates


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def _extract_keywords(claim_text: str) -> list[str]:
    """
    Extract meaningful keywords from claim text for initial scan.
    Strips common English stopwords and returns 3-8 key terms.
    """
    stopwords = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "shall", "can",
        "to", "of", "in", "for", "on", "with", "at", "by", "from",
        "that", "this", "it", "its", "or", "and", "but", "not", "as",
        "all", "any", "each", "which", "when", "where", "how", "what",
        "if", "then", "than", "so", "also", "into", "up", "out",
        "uses", "use", "using", "used", "via", "through",
    }

    words = re.findall(r'[a-zA-Z][a-zA-Z0-9_-]{2,}', claim_text)
    seen: set[str] = set()
    keywords: list[str] = []

    for word in words:
        word_lower = word.lower()
        if word_lower not in stopwords and word_lower not in seen:
            seen.add(word_lower)
            keywords.append(word)
        if len(keywords) >= 8:
            break

    return keywords


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)
