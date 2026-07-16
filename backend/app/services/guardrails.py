import re
from app.core.logging import get_logger

logger = get_logger("varinth.guardrails")

# Signature patterns for simple prompt injection attempts
INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"system\s+prompt\s+bypass", re.IGNORECASE),
    re.compile(r"you\s+must\s+override", re.IGNORECASE),
    re.compile(r"reveal\s+your\s+instructions", re.IGNORECASE),
]

class PolicyViolationError(Exception):
    """Raised when a policy violation occurs."""
    pass

class GuardrailsService:
    """
    GuardrailsService enforces input and output policy validation rules,
    filtering malicious instructions and blocking restricted path scopes.
    """
    def __init__(self) -> None:
        self.prohibited_scopes = {".git", "node_modules", "venv", ".venv", ".env"}

    def evaluate_input(self, question: str, answer: str) -> None:
        """
        Scan input text for safety policies and prompt injections.
        Raises PolicyViolationError if violation is detected.
        """
        combined = f"{question} {answer}"
        
        for pattern in INJECTION_PATTERNS:
            if pattern.search(combined):
                logger.warning("policy_violation_prompt_injection", pattern=pattern.pattern)
                raise PolicyViolationError("Input rejected: Prompt injection pattern detected.")

    def validate_scope(self, scope_relative_path: str) -> None:
        """Ensure the target scope path doesn't hit forbidden system directories."""
        if not scope_relative_path:
            return
        
        segments = set(re.split(r'[\\/]', scope_relative_path.lower()))
        forbidden = segments.intersection(self.prohibited_scopes)
        if forbidden:
            logger.warning("policy_violation_scope_restricted", scope=scope_relative_path)
            raise PolicyViolationError(
                f"Input rejected: Scope targets restricted directory segments: {list(forbidden)}."
            )

    def evaluate_output(self, explanation: str) -> str:
        """Filter or sanitize output explanation fields."""
        if not explanation:
            return ""
        return explanation.strip()
