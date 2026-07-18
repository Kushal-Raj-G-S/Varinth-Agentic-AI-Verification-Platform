"""
verdict_engine.py
-----------------
Rule-based verdict assignment for Varinth.
No LLM in the verdict loop — verdicts are deterministic and auditable.

Verdict rules:
  supported    — at least 1 evidence item with relevance_score >= 0.5
                 AND supports_claim is True
  contradicted — at least 1 evidence item with relevance_score >= 0.3
                 AND contradicts_claim is True
  unverified   — all other cases (no evidence, or evidence too weak)

Integrity guarantee:
  A 'supported' verdict without any attached evidence raises
  VerdictIntegrityError — this is a hard invariant.
"""
from typing import Any

from app.core.logging import get_logger

logger = get_logger("varinth.verdict_engine")

# Thresholds
SUPPORT_THRESHOLD = 0.5      # minimum relevance to count as support
CONTRADICT_THRESHOLD = 0.3   # minimum relevance to count as contradiction

VALID_VERDICTS = {"supported", "contradicted", "unverified"}


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
        contradicting = [
            ev for ev in evidence
            if ev.get("relevance_score", 0) >= CONTRADICT_THRESHOLD
            and ev.get("contradicts_claim") is True
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
