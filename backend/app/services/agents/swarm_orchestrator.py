import asyncio
from typing import Any, Dict, List
from app.services.agents.critic import CriticAgent
from app.services.agents.verifier import VerifierAgent
from app.services.agents.judge import JudgeAgent
from app.services.verdict_engine import VerdictEngine
from app.core.logging import get_logger

logger = get_logger("varinth.agents.swarm_orchestrator")

class SwarmOrchestrator:
    """
    SwarmOrchestrator coordinates the Critic, Verifier, and Judge agents
    in parallel across all claims.
    """
    def __init__(self) -> None:
        self.critic = CriticAgent()
        self.verifier = VerifierAgent()
        self.judge = JudgeAgent()
        self.verdict_engine = VerdictEngine()

    async def verify_claim_agentic(
        self,
        claim: Dict[str, Any],
        evidence_list: List[Dict[str, Any]],
        memory: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Run the agentic verification pipeline for a single claim.
        1. Run CriticAgent to critique the raw retrieved evidence candidates.
        2. Run VerifierAgent to classify supports/contradicts boolean flags.
        3. Run VerdictEngine to assign deterministic supported/contradicted/unverified verdict.
        4. Run JudgeAgent to generate explanation.
        """
        claim_text = claim["normalized_text"]
        claim_index = claim["claim_index"]

        if memory:
            # Memory hit: bypass agent execution
            verdict = self.verdict_engine._assign_single(claim, evidence_list)
            verdict["verdict"] = memory["verdict"]
            verdict["explanation"] = memory["explanation"]
            if "rule_trace" not in verdict or not isinstance(verdict["rule_trace"], dict):
                verdict["rule_trace"] = {}
            verdict["rule_trace"]["memory_hit"] = True
            verdict["rule_trace"]["memory_similarity"] = memory["similarity"]
            return verdict

        if not evidence_list:
            # Handle empty evidence immediately to save model calls
            verdict = self.verdict_engine._assign_single(claim, [])
            verdict["explanation"] = self.judge._template_explanation("unverified", [])
            return verdict

        try:
            # 1. Critic phase
            snippets = [ev.get("snippet", "") for ev in evidence_list]
            critic_feedback = await self.critic.critique(claim_text, snippets)

            # 2. Verifier phase
            verification_results = await self.verifier.verify(
                claim_text=claim_text,
                evidence_items=evidence_list,
                critic_feedback=critic_feedback,
            )

            # Map the verifier flags back into the evidence dictionaries
            verdict_by_index = {v["evidence_index"]: v for v in verification_results}
            for idx, ev in enumerate(evidence_list):
                v_res = verdict_by_index.get(idx, {})
                ev["supports_claim"] = v_res.get("supports_claim", False)
                ev["contradicts_claim"] = v_res.get("contradicts_claim", False)

            # 3. Verdict phase
            verdict = self.verdict_engine._assign_single(claim, evidence_list)

            # Add structured rule trace details from Critic Agent
            if "rule_trace" not in verdict or not isinstance(verdict["rule_trace"], dict):
                verdict["rule_trace"] = {}
            verdict["rule_trace"]["critic_feedback"] = critic_feedback

            # 4. Judge phase
            explanation = await self.judge.explain_verdict(
                claim_text=claim_text,
                verdict=verdict["verdict"],
                evidence_items=evidence_list,
            )
            verdict["explanation"] = explanation

            return verdict

        except Exception as exc:
            logger.error(
                "swarm_verification_failed",
                claim_index=claim_index,
                error=str(exc),
            )
            # Safe deterministic fallback
            verdict = self.verdict_engine._assign_single(claim, evidence_list)
            verdict["explanation"] = self.judge._template_explanation(verdict["verdict"], evidence_list)
            return verdict

    async def run_swarm(
        self,
        claims: List[Dict[str, Any]],
        evidence_map: Dict[int, List[Dict[str, Any]]],
        memory_context: Dict[int, Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute agentic verification concurrently for all claims.
        Returns list of verdict results.
        """
        if memory_context is None:
            memory_context = {}

        tasks = []
        for claim in claims:
            claim_index = claim["claim_index"]
            evidence = evidence_map.get(claim_index, [])
            mem = memory_context.get(claim_index)
            tasks.append(self.verify_claim_agentic(claim, evidence, mem))

        results = await asyncio.gather(*tasks)
        
        logger.info(
            "swarm_verdicts_completed",
            total=len(results),
            supported=sum(1 for r in results if r["verdict"] == "supported"),
            contradicted=sum(1 for r in results if r["verdict"] == "contradicted"),
            unverified=sum(1 for r in results if r["verdict"] == "unverified"),
        )
        return list(results)
