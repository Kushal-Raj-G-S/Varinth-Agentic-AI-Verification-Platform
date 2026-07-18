"""
swarm_orchestrator.py
----------------------
Coordinates the Critic, Verifier, and Judge agents across all claims.

CHANGELOG (v1 -> v2):
- The "thorough" (non-fast_mode) path previously ran Critic, Verifier, and
  Judge concurrently via asyncio.gather. That broke the actual data
  dependency: the Verifier is supposed to receive the Critic's real
  feedback, and the Judge is supposed to explain the real, already-computed
  verdict against already-annotated evidence. Concurrently, the Verifier
  only ever saw a placeholder feedback string, and the Judge only ever saw
  a placeholder verdict ("determined from evidence") and unannotated
  evidence. This version runs the chain in its real dependency order:
  Critic -> Verifier -> VerdictEngine -> Judge. This costs latency
  (sequential instead of concurrent LLM calls per claim) but the previous
  "fast" version wasn't actually doing the adversarial-critique-informed
  verification it claimed to — the speed was bought by silently skipping
  the thing the extra calls were for. Concurrency across different claims
  (already present via run_swarm's gather) is unaffected.
- Every branch in verify_claim_agentic is now covered by exception
  handling (previously the memory-hit and empty-evidence branches were
  unguarded), and run_swarm's gather now uses return_exceptions=True with
  a safe per-claim fallback, so one malformed claim can no longer take
  down verdicts for the whole batch.
- Added a semaphore bounding concurrent claim verifications, since an
  unbounded batch can fan out to up to 3 LLM calls per claim with no
  throttling otherwise.
"""
import asyncio
from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.services.agents.critic import CriticAgent
from app.services.agents.judge import JudgeAgent
from app.services.agents.verifier import VerifierAgent
from app.services.verdict_engine import VerdictEngine

logger = get_logger("varinth.agents.swarm_orchestrator")

DEFAULT_MAX_CONCURRENT_CLAIMS = 8


class SwarmOrchestrator:
    """
    SwarmOrchestrator coordinates the Critic, Verifier, and Judge agents,
    running each claim's Critic->Verifier->Verdict->Judge chain in its
    correct dependency order, with different claims verified concurrently
    (bounded by a semaphore) rather than the stages within one claim.
    """

    def __init__(self, max_concurrent_claims: int = DEFAULT_MAX_CONCURRENT_CLAIMS) -> None:
        self.critic = CriticAgent()
        self.verifier = VerifierAgent()
        self.judge = JudgeAgent()
        self.verdict_engine = VerdictEngine()
        self._claim_semaphore = asyncio.Semaphore(max_concurrent_claims)

    # ------------------------------------------------------------------
    # Per-claim verification
    # ------------------------------------------------------------------

    async def verify_claim_agentic(
        self,
        claim: Dict[str, Any],
        evidence_list: List[Dict[str, Any]],
        memory: Optional[Dict[str, Any]] = None,
        fast_mode: bool = False,
    ) -> Dict[str, Any]:
        """
        Run the agentic verification pipeline for a single claim. Never
        raises — any unexpected failure at any stage falls back to a safe
        deterministic verdict via _safe_fallback_verdict.
        """
        claim_index = claim.get("claim_index")
        try:
            if memory:
                return self._resolve_from_memory(claim, evidence_list, memory)

            if not evidence_list:
                verdict = self.verdict_engine._assign_single(claim, [])
                verdict["explanation"] = self.judge._template_explanation("unverified", [])
                return verdict

            if fast_mode:
                return await self._verify_fast(claim, evidence_list)

            return await self._verify_thorough(claim, evidence_list)

        except Exception as exc:
            reason = str(exc)[:300]
            logger.error("claim_verification_unexpected_error", claim_index=claim_index, error=reason)
            return self._safe_fallback_verdict(claim, evidence_list, reason=reason)

    def _resolve_from_memory(
        self,
        claim: Dict[str, Any],
        evidence_list: List[Dict[str, Any]],
        memory: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Memory hit: bypass agent execution. Note: verdict/explanation
        come from the cached memory record; confidence and rule_trace come
        from _assign_single against the CURRENT evidence_list, which can in
        principle tell a different story than the cached verdict — this is
        an existing design choice, not something this fix changes."""
        verdict = self.verdict_engine._assign_single(claim, evidence_list)
        verdict["verdict"] = memory.get("verdict", verdict.get("verdict", "unverified"))
        verdict["explanation"] = memory.get("explanation", verdict.get("explanation"))
        if not isinstance(verdict.get("rule_trace"), dict):
            verdict["rule_trace"] = {}
        verdict["rule_trace"]["memory_hit"] = True
        verdict["rule_trace"]["memory_similarity"] = memory.get("similarity")
        return verdict

    async def _verify_fast(
        self,
        claim: Dict[str, Any],
        evidence_list: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Fast mode: skip Critic and the Judge explanation LLM call;
        Verifier runs directly with no critic feedback. This ordering was
        already correct in the previous version (verdict computed before
        any verdict-dependent step), so the sequence is unchanged here."""
        claim_text = claim["normalized_text"]
        verification_results = await self.verifier.verify(
            claim_text=claim_text,
            evidence_items=evidence_list,
            critic_feedback="Fast mode enabled. Skip adversarial critic.",
        )
        self._annotate_evidence(evidence_list, verification_results)

        verdict = self.verdict_engine._assign_single(claim, evidence_list)
        verdict["explanation"] = self.judge._template_explanation(verdict["verdict"], evidence_list)

        if verdict["verdict"] in {"contradicted", "unverified"}:
            await self._attach_correction(verdict, claim_text, evidence_list)

        return verdict

    async def _verify_thorough(
        self,
        claim: Dict[str, Any],
        evidence_list: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Real Critic -> Verifier -> VerdictEngine -> Judge dependency chain,
        run in order (see module CHANGELOG for why this is sequential
        rather than concurrent).
        """
        claim_text = claim["normalized_text"]
        claim_index = claim["claim_index"]
        snippets = [ev.get("snippet", "") for ev in evidence_list]

        critic_feedback = await self.critic.critique(claim_text, snippets)

        verification_results = await self.verifier.verify(
            claim_text=claim_text,
            evidence_items=evidence_list,
            critic_feedback=critic_feedback,
        )
        self._annotate_evidence(evidence_list, verification_results, claim_index=claim_index)

        # Verdict computed from real, critic-informed, now-annotated evidence.
        verdict = self.verdict_engine._assign_single(claim, evidence_list)
        if not isinstance(verdict.get("rule_trace"), dict):
            verdict["rule_trace"] = {}
        verdict["rule_trace"]["critic_feedback"] = critic_feedback

        # Judge explains the REAL verdict against the REAL annotated evidence.
        explanation = await self.judge.explain_verdict(
            claim_text=claim_text,
            verdict=verdict["verdict"],
            evidence_items=evidence_list,
        )
        verdict["explanation"] = explanation

        if verdict["verdict"] in {"contradicted", "unverified"}:
            await self._attach_correction(verdict, claim_text, evidence_list)

        return verdict

    async def _attach_correction(
        self,
        verdict: Dict[str, Any],
        claim_text: str,
        evidence_list: List[Dict[str, Any]],
    ) -> None:
        correction = await self.judge.generate_grounded_correction(
            claim_text=claim_text,
            verdict=verdict["verdict"],
            evidence_items=evidence_list,
        )
        if correction:
            if not isinstance(verdict.get("rule_trace"), dict):
                verdict["rule_trace"] = {}
            verdict["rule_trace"]["suggested_correction"] = correction

    @staticmethod
    def _annotate_evidence(
        evidence_list: List[Dict[str, Any]],
        verification_results: List[Dict[str, Any]],
        claim_index: Any = None,
    ) -> None:
        if len(verification_results) != len(evidence_list):
            logger.warning(
                "verifier_result_count_mismatch",
                claim_index=claim_index,
                expected=len(evidence_list),
                got=len(verification_results),
            )
        verdict_by_index = {v.get("evidence_index"): v for v in verification_results}
        for idx, ev in enumerate(evidence_list):
            v_res = verdict_by_index.get(idx, {})
            ev["supports_claim"] = v_res.get("supports_claim", False)
            ev["contradicts_claim"] = v_res.get("contradicts_claim", False)

    def _safe_fallback_verdict(
        self,
        claim: Dict[str, Any],
        evidence_list: List[Dict[str, Any]],
        reason: str,
    ) -> Dict[str, Any]:
        """
        Last-resort verdict construction, used when a claim's verification
        raised unexpectedly. Never raises itself — if even the deterministic
        engine or the template explanation blow up, falls back to a fully
        hardcoded minimal verdict, so one broken claim can never take down
        the rest of the batch (see run_swarm).
        """
        try:
            verdict = self.verdict_engine._assign_single(claim, evidence_list)
        except Exception:
            verdict = {
                "claim_index": claim.get("claim_index"),
                "verdict": "unverified",
                "confidence": 0.0,
                "rule_trace": {},
            }
        try:
            verdict["explanation"] = self.judge._template_explanation(
                verdict.get("verdict", "unverified"), evidence_list
            )
        except Exception:
            verdict["explanation"] = (
                "Verification could not be completed for this claim due to an internal error."
            )
        if not isinstance(verdict.get("rule_trace"), dict):
            verdict["rule_trace"] = {}
        verdict["rule_trace"]["fallback_reason"] = reason
        return verdict

    # ------------------------------------------------------------------
    # Batch entry point
    # ------------------------------------------------------------------

    async def run_swarm(
        self,
        claims: List[Dict[str, Any]],
        evidence_map: Dict[int, List[Dict[str, Any]]],
        memory_context: Optional[Dict[int, Dict[str, Any]]] = None,
        fast_mode: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Execute agentic verification concurrently across claims (bounded by
        self._claim_semaphore), sequentially within each claim. Returns a
        list of verdict results — always the same length as `claims`, even
        if individual claims fail unexpectedly.
        """
        if memory_context is None:
            memory_context = {}

        async def _bounded(claim: Dict[str, Any]) -> Dict[str, Any]:
            async with self._claim_semaphore:
                claim_index = claim["claim_index"]
                evidence = evidence_map.get(claim_index, [])
                mem = memory_context.get(claim_index)
                return await self.verify_claim_agentic(claim, evidence, mem, fast_mode)

        raw_results = await asyncio.gather(
            *(_bounded(c) for c in claims), return_exceptions=True
        )

        results: List[Dict[str, Any]] = []
        for claim, result in zip(claims, raw_results):
            if isinstance(result, Exception):
                reason = str(result)[:300]
                logger.error(
                    "swarm_task_unexpected_failure",
                    claim_index=claim.get("claim_index"),
                    error=reason,
                )
                results.append(
                    self._safe_fallback_verdict(
                        claim, evidence_map.get(claim["claim_index"], []), reason=reason
                    )
                )
            else:
                results.append(result)

        logger.info(
            "swarm_verdicts_completed",
            total=len(results),
            supported=sum(1 for r in results if r["verdict"] == "supported"),
            contradicted=sum(1 for r in results if r["verdict"] == "contradicted"),
            unverified=sum(1 for r in results if r["verdict"] == "unverified"),
        )
        return results
