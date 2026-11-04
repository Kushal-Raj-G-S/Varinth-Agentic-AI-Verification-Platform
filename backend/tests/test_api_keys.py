import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.core.security import (
    generate_api_key,
    hash_api_key,
    is_api_key,
    verify_api_key,
)
from app.models.schemas import AuditRunCreate


def test_generate_api_key_shape():
    full_key, key_prefix, key_hash = generate_api_key()
    assert full_key.startswith("vrth_")
    assert is_api_key(full_key)
    assert key_prefix.startswith("vrth_")
    assert key_hash == hash_api_key(full_key)
    # Hash must not leak the raw key
    assert full_key not in key_hash


def test_is_api_key_distinguishes_from_jwt():
    assert is_api_key("vrth_abc123") is True
    # A Supabase JWT looks nothing like our prefix
    assert is_api_key("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz") is False


def test_verify_api_key_unknown_key_rejected():
    with patch("app.core.database.get_supabase") as mock_get_supabase:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_get_supabase.return_value = mock_db

        with pytest.raises(HTTPException) as exc:
            verify_api_key("vrth_doesnotexist")
        assert exc.value.status_code == 401


def test_verify_api_key_revoked_key_rejected():
    with patch("app.core.database.get_supabase") as mock_get_supabase:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"api_key_id": "k1", "user_id": "u1", "revoked_at": "2026-01-01T00:00:00Z"}
        ]
        mock_get_supabase.return_value = mock_db

        with pytest.raises(HTTPException) as exc:
            verify_api_key("vrth_revoked")
        assert exc.value.status_code == 401


def test_verify_api_key_valid_key_resolves_user():
    with patch("app.core.database.get_supabase") as mock_get_supabase:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"api_key_id": "k1", "user_id": "u1", "revoked_at": None}
        ]
        mock_get_supabase.return_value = mock_db

        claims = verify_api_key("vrth_validkey")
        assert claims.user_id == "u1"
        assert claims.auth_method == "api_key"


# ---------------------------------------------------------------------------
# AuditRunCreate.ref validation — a malicious ref is passed to
# `git fetch origin <ref>` as a subprocess argument, so anything shaped
# like a CLI flag must be rejected before it ever reaches orchestrator.py.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_ref", [
    "--upload-pack=touch /tmp/pwned",
    "-x",
    "a..b",
    "",
])
def test_audit_run_create_rejects_dangerous_ref(bad_ref):
    if bad_ref == "":
        # Empty string normalizes to None rather than raising.
        model = AuditRunCreate(question="q", ref=bad_ref)
        assert model.ref is None
        return
    with pytest.raises(ValueError):
        AuditRunCreate(question="q", ref=bad_ref)


@pytest.mark.parametrize("good_ref", [
    "main",
    "feature/my-branch",
    "a1b2c3d4e5f6",
    "refs/pull/42/head",
])
def test_audit_run_create_accepts_normal_ref(good_ref):
    model = AuditRunCreate(question="q", ref=good_ref)
    assert model.ref == good_ref
