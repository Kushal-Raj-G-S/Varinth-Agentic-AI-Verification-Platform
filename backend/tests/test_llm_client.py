import pytest
import httpx
from unittest.mock import AsyncMock, patch

from app.services.llm_client import LLMClient, LLMUnavailableError


@pytest.mark.asyncio
async def test_embed_raises_after_retries_exhausted():
    """
    Regression test: embed() previously fell off the end of its retry loop
    silently, returning None instead of raising, when every attempt failed.
    Callers (retriever.py, memory.py) rely on LLMUnavailableError being
    raised to trigger their keyword/no-op fallback paths; a None return
    instead crashed those callers with an unrelated TypeError.
    """
    client = LLMClient()

    with patch("app.services.llm_client._acquire_token"):
        with patch.object(
            httpx.AsyncClient, "post",
            new_callable=AsyncMock,
            side_effect=httpx.RequestError("connection failed"),
        ):
            with pytest.raises(LLMUnavailableError):
                await client.embed("some claim text")
