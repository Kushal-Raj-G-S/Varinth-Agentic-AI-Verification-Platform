"""
audits.py
---------
POST /api/v1/audits        – submit a new audit run
GET  /api/v1/audits        – list audit runs for the authenticated user
GET  /api/v1/audits/{id}  – get a specific audit run with full claims + evidence
"""
from fastapi import APIRouter, Depends, HTTPException, status
import re

from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.logging import get_logger
from app.core.rate_limiter import check_rate_limit
from app.core.security import UserClaims, require_authenticated_user
from app.models.schemas import AuditRunCreate, AuditRunResponse, AuditRunSummary
from app.services.orchestrator import VerificationOrchestrator

settings = get_settings()
logger = get_logger("varinth.api.audits")
router = APIRouter(prefix="/api/v1/audits", tags=["audits"])


def parse_line_range(location_str: str) -> tuple[int, int]:
    if not location_str:
        return 1, 1
    match = re.search(r"line\s+(\d+)[\u2013-](\d+)", location_str, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    return 1, 1


def detect_language(filepath: str) -> str:
    if not filepath:
        return "text"
    ext = filepath.split(".")[-1].lower()
    mapping = {
        "py": "python",
        "js": "javascript",
        "jsx": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "json": "json",
        "html": "html",
        "css": "css",
        "md": "markdown",
        "sh": "shell",
        "yml": "yaml",
        "yaml": "yaml",
    }
    return mapping.get(ext, "text")


def _map_to_response(run_dict: dict, claims_list: list, warnings_list: list) -> dict:
    claims_out = []
    for c in claims_list:
        claim_id = c.get("claim_id", "")
        # Extract evidence
        raw_evidence = c.get("evidence") or c.get("evidence_items") or []
        evidence_out = []
        for idx, ev in enumerate(raw_evidence):
            start_line, end_line = parse_line_range(ev.get("location", ""))
            filepath = ev.get("source_id") or ev.get("filepath", "")
            evidence_out.append({
                "evidence_id": ev.get("evidence_id") or f"ev-{claim_id}-{idx}",
                "claim_id": claim_id,
                "filepath": filepath,
                "start_line": start_line,
                "end_line": end_line,
                "snippet_text": ev.get("snippet") or ev.get("snippet_text", ""),
                "relevance_score": ev.get("relevance_score"),
                "retrieval_method": ev.get("retrieval_method") or "semantic",
                "source_commit": ev.get("source_commit") or "main",
                "source_branch": ev.get("source_branch") or "main",
                "language": detect_language(filepath),
                "rank": ev.get("retrieval_rank") or ev.get("rank") or idx
            })
            
        claims_out.append({
            "claim_id": claim_id or f"claim-{c.get('claim_index')}",
            "audit_run_id": run_dict["audit_run_id"],
            "claim_index": c["claim_index"],
            "raw_text": c["raw_text"],
            "normalized_query": c.get("normalized_query") or c.get("normalized_text") or c.get("normalized_query", ""),
            "status": c.get("status") or ("processed" if c.get("verdict") else "pending"),
            "verdict": c.get("verdict", "unverified"),
            "confidence": c.get("confidence"),
            "judge_explanation": c.get("judge_explanation") or c.get("explanation"),
            "contradiction_reason": c.get("contradiction_reason"),
            "created_at": c.get("created_at") or run_dict["started_at"],
            "rule_trace": c.get("rule_trace"),
            "evidence_items": evidence_out
        })

    # Warnings
    warnings_out = []
    for w in warnings_list:
        warnings_out.append({
            "warning_code": w.get("warning_code") or w.get("code", "WARNING"),
            "message": w.get("message", "")
        })

    # Failure
    failure_out = None
    if run_dict.get("status") == "failed":
        failure_out = {
            "failure_code": run_dict.get("failure_code") or "SYSTEM_ERROR",
            "error_message": run_dict.get("error_message") or "An unexpected server crash occurred during audit execution."
        }

    return {
        "audit_run_id": run_dict["audit_run_id"],
        "user_id": run_dict["user_id"],
        "source_context_id": run_dict.get("source_context_id") or "",
        "question_text": run_dict.get("question_text") or run_dict.get("question", ""),
        "answer_text": run_dict.get("answer_text") or run_dict.get("answer", ""),
        "status": run_dict["status"],
        "global_score": run_dict["global_score"] if run_dict["status"] != "failed" else None,
        "started_at": run_dict["started_at"],
        "completed_at": run_dict.get("completed_at"),
        "duration_ms": run_dict.get("duration_ms"),
        "clone_duration_ms": run_dict.get("clone_duration_ms"),
        "retrieval_duration_ms": run_dict.get("retrieval_duration_ms"),
        "verification_duration_ms": run_dict.get("verification_duration_ms"),
        "persistence_duration_ms": run_dict.get("persistence_duration_ms"),
        "claims": claims_out,
        "warnings": warnings_out,
        "failure": failure_out
    }


@router.post(
    "",
    response_model=AuditRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new audit run",
)
async def submit_audit(
    payload: AuditRunCreate,
    user: UserClaims = Depends(require_authenticated_user),
):
    """
    Extract claims from an AI-generated answer, retrieve evidence from
    the configured source context, assign verdicts, and return the full
    audit result.

    Rate limit: 10 requests per minute per user.
    """
    check_rate_limit(user.user_id, "POST:/api/v1/audits")

    db = get_supabase()
    root_path: str | None = None
    scope_relative_path: str = ""
    source_context_id: str | None = None
    source_scope_id: str | None = None

    # Resolve source context if provided
    if payload.context_slug:
        ctx_result = (
            db.table("source_contexts")
            .select("*")
            .eq("user_id", user.user_id)
            .eq("slug", payload.context_slug)
            .eq("is_active", True)
            .execute()
        )
        if not ctx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source context '{payload.context_slug}' not found.",
            )
        ctx = ctx_result.data[0]
        root_path = ctx["root_path"]
        source_context_id = ctx["source_context_id"]

        # Resolve scope if provided
        if payload.scope_slug:
            scope_result = (
                db.table("source_scopes")
                .select("*")
                .eq("source_context_id", source_context_id)
                .eq("slug", payload.scope_slug)
                .eq("is_active", True)
                .execute()
            )
            if not scope_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Source scope '{payload.scope_slug}' not found.",
                )
            scope = scope_result.data[0]
            scope_relative_path = scope["relative_path"]
            source_scope_id = scope["source_scope_id"]

    orchestrator = VerificationOrchestrator()
    result = await orchestrator.run(
        user_id=user.user_id,
        question=payload.question,
        answer=payload.answer,
        source_context_id=source_context_id,
        source_scope_id=source_scope_id,
        root_path=root_path,
        scope_relative_path=scope_relative_path,
        max_claims=payload.max_claims,
        answer_id=payload.answer_id,
        client_name="http",
        transport_type="http",
    )

    run_result = (
        db.table("audit_runs")
        .select("*")
        .eq("audit_run_id", result["audit_run_id"])
        .execute()
    )
    if not run_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Failed to retrieve started audit run metadata.",
        )
    run = run_result.data[0]

    response_payload = _map_to_response(run, result.get("claims", []), result.get("warnings", []))

    logger.info(
        "audit_submitted",
        user_id=user.user_id,
        audit_run_id=result.get("audit_run_id"),
        claim_count=len(result.get("claims", [])),
        status=result.get("status"),
    )

    return response_payload


@router.get(
    "",
    response_model=list[AuditRunSummary],
    summary="List audit runs for the current user",
)
async def list_audits(
    limit: int = 20,
    offset: int = 0,
    user: UserClaims = Depends(require_authenticated_user),
):
    """Returns a list of audit run summaries ordered by most recent first."""
    check_rate_limit(user.user_id, "GET:/api/v1/audits")
    limit = min(limit, 100)

    db = get_supabase()
    result = (
        db.table("audit_runs")
        .select("audit_run_id,status,global_score,started_at,completed_at,duration_ms")
        .eq("user_id", user.user_id)
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Add claim_count via a separate query per run (simple approach for v1)
    summaries = []
    for run in result.data:
        count_result = (
            db.table("claims")
            .select("claim_id", count="exact")
            .eq("audit_run_id", run["audit_run_id"])
            .execute()
        )
        run["claim_count"] = count_result.count or 0
        summaries.append(run)

    return summaries


@router.get(
    "/{audit_run_id}",
    response_model=AuditRunResponse,
    summary="Get a specific audit run with full claims and evidence",
)
async def get_audit(
    audit_run_id: str,
    user: UserClaims = Depends(require_authenticated_user),
):
    """Returns the full audit run including all claims, evidence, and verdicts."""
    check_rate_limit(user.user_id, "DEFAULT")

    db = get_supabase()

    run_result = (
        db.table("audit_runs")
        .select("*")
        .eq("audit_run_id", audit_run_id)
        .eq("user_id", user.user_id)
        .execute()
    )

    if not run_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit run not found.",
        )

    run = run_result.data[0]

    # Fetch claims
    claims_result = (
        db.table("claims")
        .select("*")
        .eq("audit_run_id", audit_run_id)
        .order("claim_index")
        .execute()
    )

    claims_out = []
    for claim in claims_result.data:
        claim_id = claim["claim_id"]

        # Fetch verdict
        verdict_result = (
            db.table("verdict_results")
            .select("*")
            .eq("claim_id", claim_id)
            .execute()
        )
        verdict = verdict_result.data[0] if verdict_result.data else {}

        # Fetch evidence
        evidence_result = (
            db.table("evidence_items")
            .select("*")
            .eq("claim_id", claim_id)
            .order("retrieval_rank")
            .execute()
        )

        claims_out.append({
            "claim_id": claim_id,
            "claim_index": claim["claim_index"],
            "raw_text": claim["raw_text"],
            "normalized_query": claim["normalized_text"],
            "status": "processed" if verdict.get("verdict") else "pending",
            "verdict": verdict.get("verdict", "unverified"),
            "confidence": verdict.get("confidence"),
            "explanation": verdict.get("explanation"),
            "contradiction_reason": verdict.get("contradiction_reason") if "contradiction_reason" in verdict else None,
            "created_at": claim["created_at"],
            "evidence": evidence_result.data,
        })

    # Fetch warnings
    warnings_result = (
        db.table("audit_warnings")
        .select("warning_code,message,severity")
        .eq("audit_run_id", audit_run_id)
        .execute()
    )

    return _map_to_response(run, claims_out, warnings_result.data)
