"""
api_keys.py
-----------
CRUD endpoints for user-issued API keys.

API keys let a headless/CI caller (e.g. the GitHub Action integration)
authenticate without an interactive Supabase login. They carry the same
authority as the issuing user's JWT — see app.core.security.verify_api_key.

POST   /api/v1/api-keys       – create a key (raw value returned once)
GET    /api/v1/api-keys       – list the current user's keys (no raw values)
DELETE /api/v1/api-keys/{id}  – revoke a key
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_supabase
from app.core.logging import get_logger
from app.core.rate_limiter import check_rate_limit
from app.core.security import UserClaims, generate_api_key, require_authenticated_user
from app.models.schemas import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse

logger = get_logger("varinth.api.api_keys")
router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])

MAX_ACTIVE_KEYS_PER_USER = 20


@router.post(
    "",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new API key",
)
async def create_api_key(
    payload: ApiKeyCreate,
    user: UserClaims = Depends(require_authenticated_user),
):
    """
    Generates a new API key for the current user. The raw key is returned
    exactly once, in this response — it is never stored and can never be
    retrieved again. If it's lost, revoke it and create a new one.
    """
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    existing = (
        db.table("api_keys")
        .select("api_key_id", count="exact")
        .eq("user_id", user.user_id)
        .is_("revoked_at", "null")
        .execute()
    )
    if (existing.count or 0) >= MAX_ACTIVE_KEYS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Maximum of {MAX_ACTIVE_KEYS_PER_USER} active API keys reached. "
            "Revoke an unused key before creating another.",
        )

    full_key, key_prefix, key_hash = generate_api_key()

    result = db.table("api_keys").insert({
        "user_id": user.user_id,
        "label": payload.label,
        "key_prefix": key_prefix,
        "key_hash": key_hash,
    }).execute()

    row = result.data[0]
    logger.info("api_key_created", user_id=user.user_id, api_key_id=row["api_key_id"])

    return {
        "api_key_id": row["api_key_id"],
        "label": row["label"],
        "key_prefix": row["key_prefix"],
        "api_key": full_key,
        "created_at": row["created_at"],
    }


@router.get(
    "",
    response_model=list[ApiKeyResponse],
    summary="List the current user's API keys",
)
async def list_api_keys(
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    result = (
        db.table("api_keys")
        .select("api_key_id,label,key_prefix,created_at,last_used_at")
        .eq("user_id", user.user_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.delete(
    "/{api_key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an API key",
)
async def revoke_api_key(
    api_key_id: str,
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    existing = (
        db.table("api_keys")
        .select("api_key_id")
        .eq("api_key_id", api_key_id)
        .eq("user_id", user.user_id)
        .is_("revoked_at", "null")
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="API key not found.")

    from datetime import datetime, timezone
    db.table("api_keys").update({
        "revoked_at": datetime.now(timezone.utc).isoformat(),
    }).eq("api_key_id", api_key_id).execute()

    logger.info("api_key_revoked", user_id=user.user_id, api_key_id=api_key_id)
