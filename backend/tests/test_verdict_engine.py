import pytest
from app.services.verdict_engine import VerdictEngine, compute_global_score

def test_verdict_supported():
    engine = VerdictEngine()
    
    claims = [{"claim_index": 1, "raw_text": "Claim 1", "normalized_text": "Claim 1", "importance": "high"}]
    evidence_map = {
        1: [
            {
                "source_id": "test.py",
                "location": "line 10",
                "snippet": "def assert_path_in_scope():",
                "relevance_score": 0.85,
                "supports_claim": True,
                "contradicts_claim": False,
            }
        ]
    }
    
    verdicts = engine.assign_verdicts(claims, evidence_map)
    assert verdicts[0]["verdict"] == "supported"
    assert verdicts[0]["confidence"] >= 0.8

def test_verdict_contradicted():
    engine = VerdictEngine()
    
    claims = [{"claim_index": 2, "raw_text": "Claim 2", "normalized_text": "Claim 2", "importance": "high"}]
    evidence_map = {
        2: [
            {
                "source_id": "test.py",
                "location": "line 12",
                "snippet": "sqlite = False",
                "relevance_score": 0.90,
                "supports_claim": False,
                "contradicts_claim": True,
            }
        ]
    }
    
    verdicts = engine.assign_verdicts(claims, evidence_map)
    assert verdicts[0]["verdict"] == "contradicted"

def test_verdict_unverified():
    engine = VerdictEngine()
    
    claims = [{"claim_index": 3, "raw_text": "Claim 3", "normalized_text": "Claim 3", "importance": "high"}]
    evidence_map = {3: []}
    
    verdicts = engine.assign_verdicts(claims, evidence_map)
    assert verdicts[0]["verdict"] == "unverified"
    assert verdicts[0]["confidence"] == 0.0

def test_compute_global_score():
    claims = [
        {"verdict": "supported", "importance": "critical"},
        {"verdict": "supported", "importance": "high"},
        {"verdict": "contradicted", "importance": "medium"},
        {"verdict": "unverified", "importance": "low"},
    ]
    score = compute_global_score(claims)
    assert 0.0 <= score <= 1.0
