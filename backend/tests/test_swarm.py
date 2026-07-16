import pytest
from unittest.mock import AsyncMock, patch
from app.services.agents.critic import CriticAgent
from app.services.agents.verifier import VerifierAgent
from app.services.agents.judge import JudgeAgent
from app.services.agents.swarm_orchestrator import SwarmOrchestrator

@pytest.mark.asyncio
async def test_critic_agent():
    critic = CriticAgent()
    
    with patch.object(critic.client, "complete", new_callable=AsyncMock) as mock_complete:
        mock_complete.return_value = "Criticism: The snippet is from a test file, not source."
        
        feedback = await critic.critique(
            claim_text="Uses a security guard",
            snippets=["def test_guard(): pass"]
        )
        
        assert "Criticism:" in feedback
        mock_complete.assert_called_once()

@pytest.mark.asyncio
async def test_verifier_agent():
    verifier = VerifierAgent()
    
    with patch.object(verifier.client, "complete_json", new_callable=AsyncMock) as mock_complete_json:
        mock_complete_json.return_value = {
            "verdict_map": [
                {
                    "evidence_index": 0,
                    "supports_claim": True,
                    "contradicts_claim": False
                }
            ]
        }
        
        results = await verifier.verify(
            claim_text="Uses assert_path_in_scope",
            evidence_items=[{"snippet": "assert_path_in_scope()"}],
            critic_feedback="None"
        )
        
        assert len(results) == 1
        assert results[0]["supports_claim"] is True
        assert results[0]["evidence_index"] == 0

@pytest.mark.asyncio
async def test_judge_agent():
    judge = JudgeAgent()
    
    # 1. Test LLM completion
    with patch.object(judge.client, "complete_json", new_callable=AsyncMock) as mock_complete_json:
        mock_complete_json.return_value = {"explanation": "Matches the codebase exactly."}
        
        explanation = await judge.explain_verdict(
            claim_text="Uses PostgreSQL",
            verdict="supported",
            evidence_items=[{"source_id": "db.py", "location": "line 10", "snippet": "postgres://"}]
        )
        
        assert explanation == "Matches the codebase exactly."
    
    # 2. Test template fallback by forcing an LLM error
    with patch.object(judge.client, "complete_json", new_callable=AsyncMock) as mock_complete_json:
        mock_complete_json.side_effect = Exception("LLM connection timed out")
        
        explanation_fallback = await judge.explain_verdict(
            claim_text="Uses SQLite",
            verdict="contradicted",
            evidence_items=[{"source_id": "db.py", "location": "line 5"}]
        )
        assert "contradicted by content found at line 5 in db.py" in explanation_fallback

@pytest.mark.asyncio
async def test_swarm_orchestrator():
    orchestrator = SwarmOrchestrator()
    
    # Mock both complete and complete_json calls
    with patch.object(orchestrator.critic.client, "complete", new_callable=AsyncMock) as mock_complete, \
         patch.object(orchestrator.verifier.client, "complete_json", new_callable=AsyncMock) as mock_complete_json:
        
        mock_complete.return_value = "No discrepancies found."
        mock_complete_json.side_effect = [
            # First call for VerifierAgent
            {
                "verdict_map": [
                    {
                        "evidence_index": 0,
                        "supports_claim": True,
                        "contradicts_claim": False
                    }
                ]
            },
            # Second call for JudgeAgent
            {
                "explanation": "Claim is fully supported."
            }
        ]
        
        claims = [{"claim_index": 1, "raw_text": "Claim", "normalized_text": "Claim", "importance": "high"}]
        evidence_map = {
            1: [
                {
                    "source_id": "app.py",
                    "location": "line 1",
                    "snippet": "verified_code",
                    "relevance_score": 0.90
                }
            ]
        }
        
        results = await orchestrator.run_swarm(claims, evidence_map)
        
        assert len(results) == 1
        assert results[0]["verdict"] == "supported"
        assert results[0]["explanation"] == "Claim is fully supported."
