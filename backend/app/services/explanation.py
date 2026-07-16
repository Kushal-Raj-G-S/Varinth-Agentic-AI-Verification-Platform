"""
explanation.py
--------------
Generates concise natural-language explanations for each verdict.
Uses NVIDIA LLM with strict non-invention constraints.
On failure, generates a rule-based explanation from the verdict data.
"""
from typing import Any

from app.core.logging import get_logger
from app.core.prompts import (
    EXPLANATION_FORMATTER_VERSION,
    explanation_formatter_prompt,
)
from app.services.llm_client import LLMUnavailableError, get_llm_client

logger = get_logger("varinth.explanation")


class ExplanationService:
    def __init__(self) -> None:
        self._client = get_llm_client()

    async def explain_verdict(
        self,
        claim_text: str,
        verdict: str,
        evidence_items: list[dict[str, Any]],
    ) -> str:
        """
        Generate a concise explanation for a single claim verdict.
        Falls back to template-based explanation if LLM is unavailable.
        """
        system, user = explanation_formatter_prompt(claim_text, verdict, evidence_items)

        try:
            output = await self._client.complete_json(system, user)
            explanation = output.get("explanation", "").strip()
            if explanation:
                return explanation[:500]
        except (LLMUnavailableError, ValueError):
            logger.warning(
                "explanation_llm_unavailable_using_template",
                verdict=verdict,
            )

        return self._template_explanation(verdict, evidence_items)

    @staticmethod
    def _template_explanation(
        verdict: str,
        evidence_items: list[dict[str, Any]],
    ) -> str:
        """Deterministic fallback explanations based on verdict type."""
        if verdict == "supported":
            if evidence_items:
                top = evidence_items[0]
                location = top.get("location", "an unknown location")
                source = top.get("source_id", "the codebase")
                return (
                    f"This claim is supported by evidence found at {location} "
                    f"in {source}."
                )
            return "This claim is supported by matching evidence in the source scope."

        if verdict == "contradicted":
            if evidence_items:
                top = evidence_items[0]
                location = top.get("location", "an unknown location")
                source = top.get("source_id", "the codebase")
                return (
                    f"This claim is contradicted by content found at {location} "
                    f"in {source}."
                )
            return "This claim is contradicted by evidence in the source scope."

        return (
            "No evidence was found in the configured source scope to verify "
            "or contradict this claim."
        )
