import abc
from typing import Any
from app.services.llm_client import get_llm_client
from app.core.logging import get_logger

class BaseAgent(abc.ABC):
    """
    Abstract base class for all swarm agents.
    Provides standard logging, access to the LLM client, and prompt structure definitions.
    """
    def __init__(self, role_name: str) -> None:
        self.role_name = role_name
        self.logger = get_logger(f"varinth.agents.{role_name}")
        self.client = get_llm_client()

    @abc.abstractmethod
    def get_system_prompt(self, **kwargs: Any) -> str:
        """Return the system instructions for this agent's role."""
        pass

    @abc.abstractmethod
    def get_user_prompt(self, **kwargs: Any) -> str:
        """Return the user query/context for the agent."""
        pass
