"""
Unit tests for the pure-logic pieces of the GitHub Action script: slug
derivation and PR comment formatting. No network access.

Run from the repo root:
    python -m pytest integrations/github-action/test_varinth_pr_audit.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import varinth_pr_audit as m  # noqa: E402

SLUG_PATTERN = re.compile(r'^[a-z0-9_-]{1,64}$')


def test_repo_slug_matches_backend_slug_pattern():
    slug = m._repo_slug("Kushal-Raj-G-S", "Varinth-Agentic-AI-Verification-Platform")
    assert SLUG_PATTERN.match(slug)
    assert slug == "kushal-raj-g-s-varinth-agentic-ai-verification-platform"


def test_repo_slug_sanitizes_invalid_characters():
    slug = m._repo_slug("Acme_Corp", "My.Repo!!")
    assert SLUG_PATTERN.match(slug)
    assert slug == "acme_corp-my-repo"


def test_repo_slug_truncates_to_64_chars():
    slug = m._repo_slug("a" * 50, "b" * 50)
    assert len(slug) <= 64
    assert SLUG_PATTERN.match(slug)


def test_format_comment_includes_marker_and_score():
    result = {
        "global_score": 0.75,
        "claims": [
            {
                "raw_text": "Uses Postgres via Supabase",
                "verdict": "supported",
                "confidence": 0.9,
                "evidence": [{"source_id": "backend/app/core/database.py", "location": "line 10-14"}],
            },
            {
                "raw_text": "Uses SQLite for caching",
                "verdict": "contradicted",
                "confidence": 0.8,
                "evidence": [],
            },
        ],
        "warnings": [{"warning_code": "LLM_FALLBACK_USED", "message": "fallback"}],
    }
    comment = m.format_comment(result, "abcdef1234567890")

    assert m.COMMENT_MARKER in comment
    assert "75%" in comment
    assert "abcdef1" in comment  # truncated head sha
    assert "Uses Postgres via Supabase" in comment
    assert "LLM_FALLBACK_USED" in comment


def test_format_comment_handles_no_claims():
    comment = m.format_comment({"global_score": 0.0, "claims": []}, "abc1234")
    assert "No verifiable claims" in comment
