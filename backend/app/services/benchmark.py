import asyncio
import time
from app.services.orchestrator import VerificationOrchestrator
from app.core.logging import get_logger

logger = get_logger("varinth.benchmark")

TEST_CASES = [
    {
        "question": "What database does Varinth use?",
        "answer": "Varinth uses Supabase PostgreSQL for storing audit runs, claims, evidence items, and event logs. It does not use SQLite.",
    },
    {
        "question": "Does Varinth check for path traversal?",
        "answer": "Yes, Varinth checks for path traversal using assert_path_in_scope to ensure search directories stay strictly within the root context.",
    }
]

async def run_benchmark(root_path: str) -> None:
    print("=" * 60)
    print("VARINTH BENCHMARK HARNESS")
    print("=" * 60)
    
    orchestrator = VerificationOrchestrator()
    start_total = time.monotonic()
    
    for idx, case in enumerate(TEST_CASES, start=1):
        print(f"\nRunning Case {idx}: '{case['question']}'")
        start_case = time.monotonic()
        
        result = await orchestrator.run(
            user_id=None,
            question=case["question"],
            answer=case["answer"],
            root_path=root_path,
            scope_relative_path="backend",
        )
        
        duration = (time.monotonic() - start_case)
        print(f"Status: {result.get('status')}")
        print(f"Global Trust Score: {result.get('global_score')}")
        print(f"Claims Extracted: {len(result.get('claims', []))}")
        print(f"Latency: {duration:.2f} seconds")
        
        for claim in result.get("claims", []):
            print(f"  - Claim: '{claim['normalized_text'][:60]}...' -> Verdict: {claim['verdict'].upper()} (Confidence: {claim['confidence']})")
            
    total_duration = time.monotonic() - start_total
    print("\n" + "=" * 60)
    print(f"Benchmark completed in {total_duration:.2f} seconds.")
    print("=" * 60)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m app.services.benchmark <root_path>")
        sys.exit(1)
        
    path = sys.argv[1]
    asyncio.run(run_benchmark(path))
