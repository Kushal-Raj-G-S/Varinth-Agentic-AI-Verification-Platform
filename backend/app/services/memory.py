import math
from typing import Any, Dict, List, Optional
from app.core.logging import get_logger
from app.core.database import get_supabase
from app.services.llm_client import get_llm_client

logger = get_logger("varinth.memory")

def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)

class MemoryService:
    """
    MemoryService provides semantic episodic memory.
    It retrieves historical verdicts using cosine similarity of NVIDIA embeddings.
    """
    def __init__(self) -> None:
        self._db = get_supabase()
        self._client = get_llm_client()

    async def get_semantic_memory(
        self,
        project_slug: str,
        claim_text: str,
        threshold: float = 0.85,
    ) -> Optional[Dict[str, Any]]:
        """
        Query previous runs for similar verified claims.
        Returns matching memory if similarity is above threshold.
        """
        try:
            claim_emb = await self._client.embed(claim_text)

            res = self._db.table("memories").select("*").eq("project_slug", project_slug).execute()
            candidates = res.data or []

            best_match = None
            best_score = 0.0

            for cand in candidates:
                properties = cand.get("properties_json", {})
                emb = properties.get("embedding")
                if not emb:
                    continue
                
                score = _cosine_similarity(claim_emb, emb)
                if score > best_score:
                    best_score = score
                    best_match = cand

            if best_score >= threshold and best_match:
                logger.info("memory_hit", claim_text=claim_text[:50], score=best_score)
                return {
                    "verdict": best_match["verdict"],
                    "explanation": best_match["explanation"],
                    "similarity": best_score,
                }

        except Exception as exc:
            logger.error("memory_query_failed", error=str(exc))
        return None

    async def add_memory(
        self,
        project_slug: str,
        claim_text: str,
        verdict: str,
        explanation: str,
    ) -> None:
        """Cache a verified claim with its embedding."""
        try:
            emb = await self._client.embed(claim_text)
            self._db.table("memories").insert({
                "project_slug": project_slug,
                "claim_text": claim_text,
                "verdict": verdict,
                "explanation": explanation,
                "properties_json": {"embedding": emb},
            }).execute()
            logger.info("memory_saved", claim_text=claim_text[:50])
        except Exception as exc:
            logger.error("memory_save_failed", error=str(exc))
