from typing import Any
from app.services.agents.base import BaseAgent

class CriticAgent(BaseAgent):
    """
    CriticAgent analyzes retrieved evidence snippets against a technical claim.
    It attempts to find misalignments, naming collisions, or context discrepancies
    and details them in a structured list.
    """
    def __init__(self) -> None:
        super().__init__("critic")

    def get_system_prompt(self, **kwargs: Any) -> str:
        return (
            "You are a strict Critic Agent in Varinth, an AI verification swarm. "
            "Your job is to look at a technical claim and a list of code/doc evidence snippets "
            "retrieved from a codebase, and identify any discrepancies, weak matches, or misalignments.\n\n"
            "Analyze the snippets carefully:\n"
            "- Do the snippets show the exact feature, method, or config option mentioned, or is it just topical similarity?\n"
            "- Are there naming collisions or false positives (e.g. matching a helper or class in a different scope)?\n"
            "- Is the evidence insufficient to verify the claim?\n\n"
            "Format your analysis as a clear, concise bulleted list of criticisms or challenges. "
            "Be objective. If the evidence matches perfectly and there are no discrepancies, state 'None'."
        )

    def get_user_prompt(self, claim_text: str, snippets: list[str], **kwargs: Any) -> str:
        snippets_formatted = "\n\n".join(
            f"Evidence Snippet {i+1}:\n{s}" for i, s in enumerate(snippets)
        )
        return (
            f"TECHNICAL CLAIM:\n\"{claim_text}\"\n\n"
            f"EVIDENCE SNIPPETS RETRIEVED:\n{snippets_formatted}\n\n"
            f"Please identify all discrepancies, misalignments, or structural gaps between the claim and the snippets."
        )

    async def critique(self, claim_text: str, snippets: list[str]) -> str:
        """Analyze candidates and return list of challenges/gaps."""
        if not snippets:
            return "No evidence found to evaluate."
        
        system = self.get_system_prompt()
        user = self.get_user_prompt(claim_text, snippets)
        
        try:
            raw = await self.client.complete(
                system_prompt=system,
                user_prompt=user,
                temperature=0.1,
            )
            return raw.strip()
        except Exception as exc:
            self.logger.error("critic_completion_failed", error=str(exc))
            return f"Critique generation failed: {str(exc)}"
