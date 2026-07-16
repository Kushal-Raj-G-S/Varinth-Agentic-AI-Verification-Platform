"""
contexts.py
-----------
CRUD endpoints for SourceContext and SourceScope.

POST /api/v1/contexts                          – create context
GET  /api/v1/contexts                          – list user contexts
GET  /api/v1/contexts/{context_slug}           – get context detail
DELETE /api/v1/contexts/{context_slug}         – deactivate context
POST /api/v1/contexts/{context_slug}/scopes    – add scope to context
GET  /api/v1/contexts/{context_slug}/scopes    – list scopes
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_supabase
from app.core.logging import get_logger
from app.core.rate_limiter import check_rate_limit
from app.core.security import UserClaims, require_authenticated_user
from app.models.schemas import (
    SourceContextCreate,
    SourceContextResponse,
    SourceScopeCreate,
    SourceScopeResponse,
)

logger = get_logger("varinth.api.contexts")
router = APIRouter(prefix="/api/v1/contexts", tags=["contexts"])


@router.post(
    "",
    response_model=SourceContextResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a source context",
)
async def create_context(
    payload: SourceContextCreate,
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    # Check slug uniqueness
    existing = (
        db.table("source_contexts")
        .select("source_context_id")
        .eq("user_id", user.user_id)
        .eq("slug", payload.slug)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A context with slug '{payload.slug}' already exists.",
        )

    result = db.table("source_contexts").insert({
        "user_id": user.user_id,
        "name": payload.name,
        "slug": payload.slug,
        "root_path": payload.root_path,
        "description": payload.description,
    }).execute()

    return result.data[0]


@router.get(
    "",
    response_model=list[SourceContextResponse],
    summary="List source contexts for the current user",
)
async def list_contexts(
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    result = (
        db.table("source_contexts")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get(
    "/{context_slug}",
    response_model=SourceContextResponse,
    summary="Get a specific source context",
)
async def get_context(
    context_slug: str,
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    result = (
        db.table("source_contexts")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("slug", context_slug)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Context not found.")
    return result.data[0]


@router.delete(
    "/{context_slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a source context",
)
async def deactivate_context(
    context_slug: str,
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    result = (
        db.table("source_contexts")
        .select("source_context_id")
        .eq("user_id", user.user_id)
        .eq("slug", context_slug)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Context not found.")

    db.table("source_contexts").update({"is_active": False}).eq(
        "source_context_id", result.data[0]["source_context_id"]
    ).execute()


@router.post(
    "/{context_slug}/scopes",
    response_model=SourceScopeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a scope to a source context",
)
async def create_scope(
    context_slug: str,
    payload: SourceScopeCreate,
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    ctx_result = (
        db.table("source_contexts")
        .select("source_context_id")
        .eq("user_id", user.user_id)
        .eq("slug", context_slug)
        .eq("is_active", True)
        .execute()
    )
    if not ctx_result.data:
        raise HTTPException(status_code=404, detail="Context not found.")

    source_context_id = ctx_result.data[0]["source_context_id"]

    result = db.table("source_scopes").insert({
        "source_context_id": source_context_id,
        "user_id": user.user_id,
        "name": payload.name,
        "slug": payload.slug,
        "relative_path": payload.relative_path,
        "scope_type": payload.scope_type,
    }).execute()

    return result.data[0]


@router.get(
    "/{context_slug}/scopes",
    response_model=list[SourceScopeResponse],
    summary="List scopes for a source context",
)
async def list_scopes(
    context_slug: str,
    user: UserClaims = Depends(require_authenticated_user),
):
    check_rate_limit(user.user_id, "DEFAULT")
    db = get_supabase()

    ctx_result = (
        db.table("source_contexts")
        .select("source_context_id")
        .eq("user_id", user.user_id)
        .eq("slug", context_slug)
        .execute()
    )
    if not ctx_result.data:
        raise HTTPException(status_code=404, detail="Context not found.")

    source_context_id = ctx_result.data[0]["source_context_id"]

    result = (
        db.table("source_scopes")
        .select("*")
        .eq("source_context_id", source_context_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data
