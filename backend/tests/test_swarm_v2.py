import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from pydantic import BaseModel, Field
from typing import Literal

from app.services.llm_client import LLMClient
from app.services.agents.critic import CriticAgent
from app.services.agents.verifier import VerifierAgent
from app.services.agents.judge import JudgeAgent
from app.services.agents.swarm_orchestrator import SwarmOrchestrator
from app.services.agents.schemas import GroundedCorrection

class DummySchema(BaseModel):
    name: str
    value: int
    category: Literal["a", "b"]

@pytest.mark.asyncio
async def test_llm_client_validated_json_success():
    client = LLMClient()
    
    with patch.object(client, "complete_json", new_callable=AsyncMock) as mock_complete_json:
        mock_complete_json.return_value = {
            "name": "test",
            "value": 42,
            "category": "a"
        }
        
        res = await client.complete_json_validated(
            system_prompt="sys",
            user_prompt="user",
            response_model=DummySchema
        )
        
        assert res.name == "test"
        assert res.value == 42
        assert res.category == "a"
        mock_complete_json.assert_called_once()

@pytest.mark.asyncio
async def test_llm_client_validated_json_repair_success():
    client = LLMClient()
    
    with patch.object(client, "complete_json", new_callable=AsyncMock) as mock_complete_json:
        # First call returns invalid payload category="invalid", second returns category="b"
        mock_complete_json.side_effect = [
            {"name": "test", "value": 42, "category": "invalid"},
            {"name": "test", "value": 42, "category": "b"}
        ]
        
        res = await client.complete_json_validated(
            system_prompt="sys",
            user_prompt="user",
            response_model=DummySchema,
            repair_attempts=1
        )
        
        assert res.category == "b"
        assert mock_complete_json.call_count == 2

@pytest.mark.asyncio
async def test_judge_agent_generate_grounded_correction():
    judge = JudgeAgent()
    
    with patch.object(judge.client, "complete_json_validated", new_callable=AsyncMock) as mock_validated:
        mock_validated.return_value = GroundedCorrection(
            statement="Uses port 5432 for Postgres.",
            file_references=["db.py:L10"],
            confidence="strong"
        )
        
        res = await judge.generate_grounded_correction(
            claim_text="Uses local SQLite db.",
            verdict="contradicted",
            evidence_items=[{"source_id": "db.py", "location": "line 10", "snippet": "postgres://localhost"}]
        )
        
        assert res is not None
        assert res["statement"] == "Uses port 5432 for Postgres."
        assert res["file_references"] == ["db.py:L10"]
        assert res["confidence"] == "strong"

@pytest.mark.asyncio
async def test_swarm_orchestrator_grounded_correction_injection():
    orchestrator = SwarmOrchestrator()
    
    from app.services.agents.schemas import CriticOutput, VerifierOutput, EvidenceVerdict, JudgeOutput
    
    # Use a type-aware side effect to prevent race conditions on shared client singleton
    def side_effect_fn(system_prompt, user_prompt, response_model, **kwargs):
        if response_model == CriticOutput:
            return CriticOutput(
                criticisms=["Snippet contradicts SQLite claim"],
                has_discrepancies=True
            )
        elif response_model == VerifierOutput:
            return VerifierOutput(
                verdict_map=[
                    EvidenceVerdict(
                        evidence_index=0,
                        supports_claim=False,
                        contradicts_claim=True
                    )
                ]
            )
        elif response_model == JudgeOutput:
            return JudgeOutput(explanation="Claim contradicts postgres snippet.")
        elif response_model == GroundedCorrection:
            return GroundedCorrection(
                statement="Correct setup is Postgres.",
                file_references=["config.py:L10"],
                confidence="strong"
            )
        raise ValueError(f"Unknown mock type: {response_model}")

    with patch.object(orchestrator.critic.client, "complete_json_validated", new_callable=AsyncMock) as mock_validated:
        mock_validated.side_effect = side_effect_fn
        
        claims = [{"claim_index": 0, "normalized_text": "Uses SQLite", "raw_text": "Uses SQLite", "claim_type": "config"}]
        evidence_map = {0: [{"source_id": "config.py", "location": "line 10", "snippet": "postgres://db", "relevance_score": 0.9}]}
        
        results = await orchestrator.run_swarm(claims, evidence_map)
        
        assert len(results) == 1
        verdict = results[0]
        assert verdict["verdict"] == "contradicted"
        assert "suggested_correction" in verdict["rule_trace"]
        assert verdict["rule_trace"]["suggested_correction"]["statement"] == "Correct setup is Postgres."
