from typing import Any, Dict, List
from app.services.agents.base import BaseAgent
from app.services.agents.schemas import VerifierOutput

class VerifierAgent(BaseAgent):
    """
    VerifierAgent maps evidence candidates to binary (supports_claim, contradicts_claim)
    indicators, taking into account Critic criticisms.
    Returns a structured mapping corresponding to each evidence snippet index.
    """
    def __init__(self) -> None:
        super().__init__("verifier")

    def get_system_prompt(self, **kwargs: Any) -> str:
        return (
            "You are a meticulous Verifier Agent in Varinth, an AI verification swarm.\n"
            "Your job is to look at a technical claim, a list of evidence snippets, and a Critic Agent's analysis, "
            "and determine for EACH evidence snippet whether it explicitly supports or contradicts the claim.\n\n"
            "Rules for evaluation:\n"
            "1. An evidence snippet SUPPORTS the claim if it clearly proves the claim to be true (e.g. contains the exact configuration, code paths, or behavior mentioned).\n"
            "2. An evidence snippet CONTRADICTS the claim if it proves the claim is false (e.g. claim says 'uses sqlite' but snippet shows database setup for postgres).\n"
            "3. If a snippet is unrelated or neutral, both supports_claim and contradicts_claim must be false.\n\n"
            "You must return a JSON object with a single key 'verdict_map', which is a list of objects matching the requested schema."
        )

    def get_user_prompt(self, claim_text: str, snippets: List[str], critic_feedback: str, **kwargs: Any) -> str:
        snippets_formatted = "\n\n".join(
            f"Evidence Snippet {i}:\n{s}" for i, s in enumerate(snippets)
        )
        return (
            f"TECHNICAL CLAIM:\n\"{claim_text}\"\n\n"
            f"CRITIC AGENT DISCREPANCIES LIST:\n{critic_feedback}\n\n"
            f"EVIDENCE SNIPPETS:\n{snippets_formatted}\n\n"
            f"Evaluate each snippet index and output the JSON verdict map."
        )

    async def verify(
        self,
        claim_text: str,
        evidence_items: List[Dict[str, Any]],
        critic_feedback: str,
    ) -> List[Dict[str, Any]]:
        """
        Evaluate candidates and return a list of mappings with boolean flags.
        Example return: [{'evidence_index': 0, 'supports_claim': True, 'contradicts_claim': False}, ...]
        """
        if not evidence_items:
            return []
        
        snippets = [item.get("snippet", "") for item in evidence_items]
        system = self.get_system_prompt()
        user = self.get_user_prompt(claim_text, snippets, critic_feedback)
        
        try:
            res: VerifierOutput = await self.client.complete_json_validated(
                system_prompt=system,
                user_prompt=user,
                response_model=VerifierOutput,
                temperature=0.0,
            )
            return [item.model_dump() for item in res.verdict_map]
        except Exception as exc:
            self.logger.error("verifier_completion_failed", error=str(exc))
            # Safe default fallback: mark all as None/False
            return [
                {
                    "evidence_index": i,
                    "supports_claim": False,
                    "contradicts_claim": False,
                }
                for i in range(len(evidence_items))
            ]
