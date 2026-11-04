"""
verdict_engine.py
-----------------
Rule-based verdict assignment for Varinth.
No LLM in the verdict loop — verdicts are deterministic and auditable.

Verdict rules:
  supported    — at least 1 evidence item with relevance_score >= 0.5
                 AND supports_claim is True
  contradicted — at least 1 evidence item with relevance_score >= 0.5
                 AND contradicts_claim is True, AND at least one literal
                 claim keyword appears in the snippet (see
                 _snippet_contains_keyword below)
  unverified   — all other cases (no evidence, or evidence too weak)

Integrity guarantee:
  A 'supported' verdict without any attached evidence raises
  VerdictIntegrityError — this is a hard invariant.
"""
import re
from typing import Any

from app.core.logging import get_logger

logger = get_logger("varinth.verdict_engine")

# Thresholds
SUPPORT_THRESHOLD = 0.5      # minimum relevance to count as support
CONTRADICT_THRESHOLD = 0.5   # minimum relevance to count as contradiction (raised from 0.3 to match support threshold)
# Raised from 0.3: a low-relevance snippet labeled contradicts_claim=True by the verifier LLM was
# producing false-positive contradictions (e.g. main.py router imports flagging a port-routing claim).
# At 0.5, both support and contradiction require the same quality of evidence.

VALID_VERDICTS = {"supported", "contradicted", "unverified"}

# Keyword sanity-check stopwords for the contradiction gate below. Module
# level so it isn't rebuilt on every single claim verdict.
_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "that", "this", "it", "its",
    "or", "and", "but", "not", "as", "all", "any", "each", "which",
    "when", "where", "how", "what", "if", "then", "than", "so", "also",
    "into", "up", "out", "uses", "use", "using", "used", "via", "through",
    "does", "script", "code", "file", "system", "backend", "app",
}


class VerdictIntegrityError(Exception):
    """
    Raised if the engine would emit 'supported' without evidence.
    This is a programming error, not a user error.
    """


class VerdictEngine:

    def assign_verdicts(
        self,
        claims: list[dict[str, Any]],
        evidence_map: dict[int, list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        """
        Assign verdicts to all claims.

        Args:
            claims: List of claim dicts (each has 'claim_index').
            evidence_map: Maps claim_index → list of evidence item dicts.

        Returns:
            List of verdict result dicts.
        """
        verdicts = []

        for claim in claims:
            claim_index = claim["claim_index"]
            evidence = evidence_map.get(claim_index, [])
            verdict_dict = self._assign_single(claim, evidence)
            verdicts.append(verdict_dict)

        logger.info(
            "verdicts_assigned",
            total=len(verdicts),
            supported=sum(1 for v in verdicts if v["verdict"] == "supported"),
            contradicted=sum(1 for v in verdicts if v["verdict"] == "contradicted"),
            unverified=sum(1 for v in verdicts if v["verdict"] == "unverified"),
        )
        return verdicts

    def _assign_single(
        self,
        claim: dict[str, Any],
        evidence: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Assign a verdict to a single claim based on its evidence."""
        claim_index = claim["claim_index"]

        if not evidence:
            return self._make_verdict(
                claim_index=claim_index,
                verdict="unverified",
                confidence=0.0,
                evidence_count=0,
                rule_trace={
                    "rule": "no_evidence",
                    "reason": "No evidence candidates found in the scope.",
                },
            )

        # Find strongest supporting evidence
        supporting = [
            ev for ev in evidence
            if ev.get("relevance_score", 0) >= SUPPORT_THRESHOLD
            and ev.get("supports_claim") is True
        ]

        # Find contradicting evidence
        # Keyword sanity check: at least one non-trivial claim keyword must appear literally
        # in the evidence snippet before we trust a contradiction verdict from the verifier LLM.
        # This prevents false positives where a semantically adjacent but topically unrelated
        # snippet is incorrectly labeled contradicts_claim=True (e.g. router imports != port routing).
        _claim_keywords = [
            w for w in re.findall(r'[a-zA-Z0-9_:/.\-]{3,}', claim["normalized_text"])
            if w.lower() not in _STOPWORDS
        ]

        def _snippet_contains_keyword(snippet: str) -> bool:
            """Return True if at least one claim keyword appears literally in the snippet."""
            if not _claim_keywords:
                return True  # no keywords to check — trust the LLM verdict
            snippet_lower = snippet.lower()
            return any(kw.lower() in snippet_lower for kw in _claim_keywords)

        contradicting = [
            ev for ev in evidence
            if ev.get("relevance_score", 0) >= CONTRADICT_THRESHOLD
            and ev.get("contradicts_claim") is True
            and _snippet_contains_keyword(ev.get("snippet", ""))  # sanity gate
        ]

        if contradicting:
            # Contradiction takes priority
            top = max(contradicting, key=lambda e: e.get("relevance_score", 0))
            verdict = "contradicted"
            confidence = round(min(top.get("relevance_score", 0) * 1.1, 1.0), 3)
            rule_trace = {
                "rule": "explicit_contradiction",
                "top_evidence_location": top.get("location"),
                "top_evidence_score": top.get("relevance_score"),
            }

        elif supporting:
            verdict = "supported"
            top = max(supporting, key=lambda e: e.get("relevance_score", 0))
            confidence = round(min(top.get("relevance_score", 0), 1.0), 3)
            rule_trace = {
                "rule": "evidence_threshold_met",
                "threshold": SUPPORT_THRESHOLD,
                "top_evidence_location": top.get("location"),
                "top_evidence_score": top.get("relevance_score"),
            }

        else:
            # Evidence found but below threshold
            best_score = max(
                (ev.get("relevance_score", 0) for ev in evidence), default=0
            )
            verdict = "unverified"
            confidence = round(best_score * 0.5, 3)
            rule_trace = {
                "rule": "evidence_below_threshold",
                "threshold": SUPPORT_THRESHOLD,
                "best_score": best_score,
            }

        # Integrity check — can never emit 'supported' without evidence
        if verdict == "supported" and not supporting:
            raise VerdictIntegrityError(
                f"Verdict 'supported' attempted on claim_index={claim_index} "
                "with no supporting evidence. This is a bug."
            )

        return self._make_verdict(
            claim_index=claim_index,
            verdict=verdict,
            confidence=confidence,
            evidence_count=len(evidence),
            rule_trace=rule_trace,
        )

    @staticmethod
    def _make_verdict(
        claim_index: int,
        verdict: str,
        confidence: float,
        evidence_count: int,
        rule_trace: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "claim_index": claim_index,
            "verdict": verdict,
            "confidence": confidence,
            "evidence_count": evidence_count,
            "rule_trace": rule_trace,
            "explanation": None,    # filled in by explanation.py
        }


def compute_global_score(verdicts: list[dict[str, Any]]) -> float:
    """
    Compute a weighted global trust score for the audit run.
    Score = (weighted supported) / (total weighted claims)

    Importance weights:
      critical → 4, high → 3, medium → 2, low → 1

    Range: 0.0 (all contradicted/unverified) to 1.0 (all supported).
    """
    WEIGHTS = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    total_weight = 0.0
    supported_weight = 0.0

    for verdict in verdicts:
        importance = verdict.get("importance", "medium")
        weight = WEIGHTS.get(importance, 2)
        total_weight += weight
        if verdict.get("verdict") == "supported":
            supported_weight += weight

    if total_weight == 0:
        return 0.0

    return round(supported_weight / total_weight, 3)
