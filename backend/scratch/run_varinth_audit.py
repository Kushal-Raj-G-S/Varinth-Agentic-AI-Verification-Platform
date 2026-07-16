import asyncio
import json
import os
import sys

# Ensure backend folder is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.orchestrator import VerificationOrchestrator
from app.core.config import get_settings

async def main():
    settings = get_settings()
    print("NVIDIA API BASE:", settings.nvidia_api_base_url)
    print("NVIDIA CHAT MODEL:", settings.nvidia_chat_model)
    
    orchestrator = VerificationOrchestrator()
    
    user_id = "05e8f146-71f1-4c3f-95b8-96c7d2cd43de" # Valid user from DB profiles
    question = "What review agents are included in the Phase 2 swarm check?"
    answer = (
        "The review agents included in the Phase 2 swarm check are the Critic Agent, the Verifier Agent, and the Judge Agent. "
        "The Critic Agent analyzes evidence candidates for discrepancies, the Verifier Agent checks alignment and claim grounding, "
        "and the Judge Agent generates the final verdict explanation."
    )
    
    # Use the remote repository URL for compliance
    root_path = "https://github.com/Kushal-Raj-G-S/Varinth-Agentic-AI-Verification-Platform.git"
    
    print("\nRunning Varinth verification audit...")
    result = await orchestrator.run(
        user_id=user_id,
        question=question,
        answer=answer,
        root_path=root_path,
        max_claims=3,
    )
    
    print("\n--- AUDIT RESULTS ---")
    print("Status:", result.get("status"))
    print("Global Score:", result.get("global_score"))
    print("\nClaims and Verdicts:")
    for claim in result.get("claims", []):
        print(f"\nClaim Index {claim.get('claim_index')} | Verdict: {claim.get('verdict').upper()} (Confidence: {claim.get('confidence')}%)")
        print(f"  Raw claim: {claim.get('raw_text')}")
        print(f"  Explanation: {claim.get('judge_explanation')}")
        print("  Evidence found:")
        for ev in claim.get("evidence_items", []):
            print(f"    - File: {ev.get('filepath')} L{ev.get('start_line')}-{ev.get('end_line')}")
            print(f"      Snippet: {ev.get('snippet_text')[:150].strip()}...")

if __name__ == "__main__":
    asyncio.run(main())
