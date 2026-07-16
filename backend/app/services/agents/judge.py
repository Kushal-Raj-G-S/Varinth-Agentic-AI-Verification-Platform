from typing import Any, Dict, List
from app.services.agents.base import BaseAgent

class JudgeAgent(BaseAgent):
    """
    JudgeAgent generates final natural language explanations based on the verdict
    and matched evidence list.
    """
    def __init__(self) -> None:
        super().__init__("judge")

    def get_system_prompt(self, **kwargs: Any) -> str:
        return (
            "You are a Judge Agent in Varinth, an AI verification swarm.\n"
            "Your task is to write a detailed, comprehensive natural-language explanation summarizing a claim's verdict "
            "based strictly on the matched evidence and the verdict status. Do not invent any facts.\n\n"
            "Rules:\n"
            "- Explain clearly why the claim was supported, contradicted, or remains unverified based on the evidence.\n"
            "- Explicitly cite the specific files, locations, and concrete code constructs/snippets that serve as proof.\n"
            "- Keep the explanation detailed, writing a comprehensive paragraph that provides solid proof and references.\n"
            "- Return ONLY valid JSON: {\"explanation\": \"<text>\"}"
        )

    def get_user_prompt(self, claim_text: str, verdict: str, evidence_items: List[Dict[str, Any]], **kwargs: Any) -> str:
        evidence_str = ""
        if evidence_items:
            parts = []
            for ev in evidence_items[:5]:
                parts.append(
                    f"  - File: {ev.get('source_id', 'unknown')}, "
                    f"Location: {ev.get('location', 'unknown')}, "
                    f"Snippet: {ev.get('snippet', '')[:500]}"
                )
            evidence_str = "\n".join(parts)
        else:
            evidence_str = "  (none)"

        return (
            f"Claim: {claim_text}\n"
            f"Verdict: {verdict}\n"
            f"Evidence:\n{evidence_str}"
        )

    async def explain_verdict(
        self,
        claim_text: str,
        verdict: str,
        evidence_items: List[Dict[str, Any]],
    ) -> str:
        """Generate final explanation summarizing the verdict reasoning."""
        system = self.get_system_prompt()
        user = self.get_user_prompt(claim_text, verdict, evidence_items)
        
        try:
            res = await self.client.complete_json(
                system_prompt=system,
                user_prompt=user,
                temperature=0.1,
            )
            explanation = res.get("explanation", "").strip()
            if explanation:
                return explanation[:1000]
        except Exception as exc:
            self.logger.error("judge_explanation_failed", error=str(exc))

        # Fallback to deterministic template
        return self._template_explanation(verdict, evidence_items)

    @staticmethod
    def _template_explanation(
        verdict: str,
        evidence_items: List[Dict[str, Any]],
    ) -> str:
        """Deterministic fallback explanations based on verdict type."""
        if verdict == "supported":
            if evidence_items:
                top = evidence_items[0]
                location = top.get("location", "an unknown location")
                source = top.get("source_id", "the codebase")
                return f"This claim is supported by evidence found at {location} in {source}."
            return "This claim is supported by matching evidence in the source scope."
        
        if verdict == "contradicted":
            if evidence_items:
                top = evidence_items[0]
                location = top.get("location", "an unknown location")
                source = top.get("source_id", "the codebase")
                return f"This claim is contradicted by content found at {location} in {source}."
            return "This claim is contradicted by evidence in the source scope."
        
        return "No evidence was found in the configured source scope to verify or contradict this claim."
