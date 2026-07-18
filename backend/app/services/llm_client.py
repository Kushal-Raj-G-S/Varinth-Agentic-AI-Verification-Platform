"""
llm_client.py
-------------
Provider-agnostic LLM wrapper for Varinth.
Default provider: NVIDIA API (OpenAI-compatible endpoint).
Includes:
  - Token bucket to stay under NVIDIA's 40 req/min limit
  - Exponential backoff with jitter (3 retries max)
  - Structured JSON output enforcement
  - Graceful degradation on failure
"""
import asyncio
import json
import random
import time
import threading
from typing import Any

from pydantic import BaseModel, ValidationError
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("varinth.llm_client")

# ---------------------------------------------------------------------------
# Token bucket: max 38 req/min (buffer under NVIDIA's 40 rpm cap)
# ---------------------------------------------------------------------------
_BUCKET_CAPACITY = 38
_REFILL_RATE = 38 / 60.0      # tokens per second

_bucket_lock = threading.Lock()
_bucket_tokens: float = _BUCKET_CAPACITY
_last_refill: float = time.monotonic()


def _acquire_token(timeout: float = 30.0) -> None:
    """Block until a token is available in the bucket or timeout expires."""
    global _bucket_tokens, _last_refill
    deadline = time.monotonic() + timeout

    while True:
        with _bucket_lock:
            now = time.monotonic()
            elapsed = now - _last_refill
            _bucket_tokens = min(_BUCKET_CAPACITY, _bucket_tokens + elapsed * _REFILL_RATE)
            _last_refill = now

            if _bucket_tokens >= 1.0:
                _bucket_tokens -= 1.0
                return

        if time.monotonic() > deadline:
            raise TimeoutError("LLM token bucket timeout — too many concurrent requests.")

        time.sleep(0.5)


class LLMUnavailableError(Exception):
    """Raised when the LLM provider is unavailable after all retries."""


# ---------------------------------------------------------------------------
# Core LLM client
# ---------------------------------------------------------------------------

class LLMClient:
    """
    Async HTTP client for NVIDIA API (OpenAI-compatible).
    Provider-agnostic: swap base_url and model to switch providers.
    """

    def __init__(self) -> None:
        if settings.nemoclaw_enabled:
            self._base_url = settings.nemoclaw_url.rstrip("/")
            self._chat_model = settings.nemoclaw_chat_model
            self._embed_model = settings.nemoclaw_embed_model
        else:
            self._base_url = settings.nvidia_api_base_url.rstrip("/")
            self._chat_model = settings.nvidia_chat_model
            self._embed_model = settings.nvidia_embed_model
        self._api_key = settings.nvidia_api_key
        self._max_retries = 3

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> str:
        """
        Send a chat completion request and return the raw text response.
        Applies token bucket, retries with exponential backoff + jitter.
        """
        payload = {
            "model": self._chat_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        last_error: Exception | None = None

        for attempt in range(self._max_retries):
            try:
                # Acquire token before sending (rate limit enforcement) - skip for local NemoClaw
                if not settings.nemoclaw_enabled:
                    await asyncio.get_event_loop().run_in_executor(None, _acquire_token)

                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self._base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    )

                if response.status_code == 429:
                    wait = _backoff_seconds(attempt)
                    logger.warning(
                        "llm_rate_limited",
                        attempt=attempt + 1,
                        wait_seconds=wait,
                    )
                    await asyncio.sleep(wait)
                    continue

                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]

            except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as exc:
                last_error = exc
                wait = _backoff_seconds(attempt)
                logger.warning(
                    "llm_request_failed",
                    attempt=attempt + 1,
                    error=str(exc),
                    wait_seconds=wait,
                )
                await asyncio.sleep(wait)

        raise LLMUnavailableError(
            f"LLM unavailable after {self._max_retries} retries. "
            f"Last error: {last_error}"
        )

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """
        Same as complete() but parses and returns a JSON object.
        Strips markdown code fences if the model wraps the output.
        Raises ValueError if the output cannot be parsed as JSON.
        """
        raw = await self.complete(system_prompt, user_prompt, temperature, max_tokens)

        # Strip markdown code fences if present
        stripped = raw.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            # Remove first and last fence lines
            inner = "\n".join(lines[1:-1]) if len(lines) > 2 else ""
            stripped = inner.strip()

        try:
            return json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"LLM returned non-JSON output. "
                f"Raw (first 500 chars): {raw[:500]}"
            ) from exc

    async def complete_json_validated(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
        temperature: float = 0.0,
        max_tokens: int = 2048,
        repair_attempts: int = 1,
    ) -> BaseModel:
        """
        Same as complete_json() but validates output against a Pydantic model.
        If validation fails, it performs a self-repair loop by resubmitting the
        validation error stack trace to the LLM to get a corrected schema format.
        """
        schema_json = json.dumps(response_model.model_json_schema(), indent=2)
        validation_system_prompt = (
            f"{system_prompt}\n\n"
            f"You MUST respond ONLY with a raw JSON object matching this schema:\n"
            f"{schema_json}\n"
            "Do not include any conversational text before or after the JSON."
        )

        current_user_prompt = user_prompt

        for attempt in range(repair_attempts + 1):
            try:
                raw_json_dict = await self.complete_json(
                    system_prompt=validation_system_prompt,
                    user_prompt=current_user_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                validated_model = response_model.model_validate(raw_json_dict)
                return validated_model

            except (ValueError, ValidationError) as exc:
                if attempt >= repair_attempts:
                    logger.error(
                        "validation_repair_failed_max_attempts",
                        model=response_model.__name__,
                        error=str(exc),
                    )
                    raise

                error_trace = str(exc)
                logger.warning(
                    "validation_failed_initiating_repair",
                    model=response_model.__name__,
                    error=error_trace,
                    attempt=attempt + 1,
                )
                
                current_user_prompt = (
                    f"{user_prompt}\n\n"
                    f"--- REPAIR REQUEST ---\n"
                    f"Your previous JSON output failed validation with the following error:\n"
                    f"{error_trace}\n\n"
                    f"Please output a corrected, valid JSON matching the schema precisely."
                )

        raise ValueError("JSON validation repair loop failed to return a validated model.")

    async def embed(self, text: str) -> list[float]:
        """
        Generate a text embedding using the NVIDIA embedding model.
        Returns a float vector (e.g. 1024-dimensional for nv-embedqa-e5-v5).
        """
        payload = {
            "model": self._embed_model,
            "input": [text],
            "input_type": "query",
            "encoding_format": "float",
        }

        for attempt in range(self._max_retries):
            try:
                if not settings.nemoclaw_enabled:
                    await asyncio.get_event_loop().run_in_executor(None, _acquire_token)

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{self._base_url}/embeddings",
                        headers=self._headers(),
                        json=payload,
                    )

                if response.status_code == 429:
                    await asyncio.sleep(_backoff_seconds(attempt))
                    continue

                response.raise_for_status()
                data = response.json()
                return data["data"][0]["embedding"]

            except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as exc:
                logger.warning(
                    "embed_request_failed",
                    attempt=attempt + 1,
                    error=str(exc),
                )
                await asyncio.sleep(_backoff_seconds(attempt))

    async def embed_batch(self, texts: list[str], input_type: str = "query") -> list[list[float]]:
        """
        Generate text embeddings in batch using the NVIDIA embedding model.
        Returns a list of float vectors.
        """
        if not texts:
            return []

        payload = {
            "model": self._embed_model,
            "input": texts,
            "input_type": input_type,
            "encoding_format": "float",
        }

        for attempt in range(self._max_retries):
            try:
                if not settings.nemoclaw_enabled:
                    await asyncio.get_event_loop().run_in_executor(None, _acquire_token)

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{self._base_url}/embeddings",
                        headers=self._headers(),
                        json=payload,
                    )

                if response.status_code == 429:
                    await asyncio.sleep(_backoff_seconds(attempt))
                    continue

                response.raise_for_status()
                data = response.json()
                return [item["embedding"] for item in data["data"]]

            except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as exc:
                logger.warning(
                    "embed_batch_request_failed",
                    attempt=attempt + 1,
                    error=str(exc),
                )
                await asyncio.sleep(_backoff_seconds(attempt))

        raise LLMUnavailableError("Embedding API unavailable after retries.")





def _backoff_seconds(attempt: int) -> float:
    """Exponential backoff with jitter: 2^attempt ± random jitter."""
    base = 2 ** attempt
    jitter = random.uniform(0, 1)
    return min(base + jitter, 30.0)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client
