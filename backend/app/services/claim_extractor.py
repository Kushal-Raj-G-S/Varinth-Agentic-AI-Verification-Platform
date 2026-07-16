"""
claim_extractor.py
------------------
Extracts atomic, auditable claims from an AI-generated answer.
Uses NVIDIA LLM with structured JSON output.
Includes:
  - Schema validation via Pydantic
  - One-shot JSON repair attempt on malformed output
  - Regex-based fallback when LLM is unavailable
"""
import re
from typing import Any

from pydantic import BaseModel, field_validator

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.prompts import (
    CLAIM_EXTRACTOR_VERSION,
    REPAIR_ASSISTANT_VERSION,
    claim_extractor_prompt,
    output_repair_prompt,
)
from app.core.security import sanitize_string
from app.services.llm_client import LLMUnavailableError, get_llm_client

settings = get_settings()
logger = get_logger("varinth.claim_extractor")

# ---------------------------------------------------------------------------
# Pydantic models for LLM output validation
# ---------------------------------------------------------------------------

VALID_CLAIM_TYPES = {"structural", "config", "guarantee", "performance", "other"}
VALID_IMPORTANCE = {"low", "medium", "high", "critical"}


class RawClaimItem(BaseModel):
    claim_index: int
    raw_text: str
    normalized_text: str
    claim_type: str
    importance: str

    @field_validator("claim_type")
    @classmethod
    def validate_claim_type(cls, v: str) -> str:
        if v not in VALID_CLAIM_TYPES:
            return "other"
        return v

    @field_validator("importance")
    @classmethod
    def validate_importance(cls, v: str) -> str:
        if v not in VALID_IMPORTANCE:
            return "medium"
        return v

    @field_validator("raw_text", "normalized_text")
    @classmethod
    def non_empty(cls, v: str) -> str:
        v = sanitize_string(v.strip())
        if not v:
            raise ValueError("Claim text cannot be empty.")
        return v[:2000]


class ClaimExtractionResult(BaseModel):
    claims: list[RawClaimItem]


# ---------------------------------------------------------------------------
# Extractor
# ---------------------------------------------------------------------------

class ClaimExtractor:
    def __init__(self) -> None:
        self._client = get_llm_client()

    async def extract(
        self,
        question: str,
        answer: str,
        max_claims: int | None = None,
    ) -> tuple[list[dict[str, Any]], str, str]:
        """
        Extract atomic claims from an AI answer.

        Returns:
            (claims: list[dict], prompt_version: str, model_status: str)
            model_status: "llm" | "fallback"
        """
        effective_max = min(
            max_claims or settings.max_claims_per_run,
            settings.max_claims_per_run,
        )

        system_prompt, user_prompt = claim_extractor_prompt(question, answer, effective_max)

        try:
            output = await self._client.complete_json(system_prompt, user_prompt)
            claims = self._validate_output(output, system_prompt, user_prompt)
            logger.info(
                "claims_extracted",
                count=len(claims),
                version=CLAIM_EXTRACTOR_VERSION,
            )
            return claims, CLAIM_EXTRACTOR_VERSION, "llm"

        except LLMUnavailableError:
            logger.warning("claim_extraction_llm_unavailable_using_fallback")
            fallback_claims = self._fallback_extract(answer, effective_max)
            return fallback_claims, "regex_fallback_v1", "fallback"

    def _validate_output(
        self,
        output: dict[str, Any],
        system_prompt: str,
        user_prompt: str,
    ) -> list[dict[str, Any]]:
        """
        Validate the LLM output against ClaimExtractionResult schema.
        On validation failure, attempt one JSON repair pass before failing.
        """
        try:
            result = ClaimExtractionResult.model_validate(output)
            return [c.model_dump() for c in result.claims]

        except Exception as first_error:
            logger.warning(
                "claim_output_invalid_attempting_repair",
                error=str(first_error),
            )

            # Attempt repair
            import json
            invalid_json_str = json.dumps(output)
            schema_desc = (
                '{"claims": [{"claim_index": int, "raw_text": str, '
                '"normalized_text": str, "claim_type": str, "importance": str}]}'
            )

            repair_system, repair_user = output_repair_prompt(
                invalid_json=invalid_json_str,
                schema_description=schema_desc,
                validation_errors=str(first_error),
            )

            import asyncio
            client = get_llm_client()

            async def _repair():
                return await client.complete_json(repair_system, repair_user)

            try:
                repaired = asyncio.get_event_loop().run_until_complete(_repair())
                result = ClaimExtractionResult.model_validate(repaired)
                logger.info("claim_output_repaired_successfully")
                return [c.model_dump() for c in result.claims]
            except Exception as repair_error:
                logger.error(
                    "claim_output_repair_failed",
                    error=str(repair_error),
                )
                return []

    def _fallback_extract(self, answer: str, max_claims: int) -> list[dict[str, Any]]:
        """
        Regex-based claim splitter used when the LLM is unavailable.
        Splits on sentence boundaries. Returns structured claim dicts
        with claim_type='other' and importance='medium'.
        """
        sentence_pattern = re.compile(
            r'(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\n+'
        )
        raw_sentences = sentence_pattern.split(answer.strip())

        claims = []
        for i, sentence in enumerate(raw_sentences[:max_claims]):
            sentence = sanitize_string(sentence.strip())
            if len(sentence) < 10:
                continue
            claims.append({
                "claim_index": i + 1,
                "raw_text": sentence,
                "normalized_text": sentence,
                "claim_type": "other",
                "importance": "medium",
            })

        return claims
