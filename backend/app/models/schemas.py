"""
Pydantic request/response models for all Varinth API endpoints.
"""
import re
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator

from app.core.security import sanitize_string

# ---------------------------------------------------------------------------
# Source Context
# ---------------------------------------------------------------------------

class SourceContextCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., pattern=r'^[a-z0-9_-]{1,64}$')
    root_path: str = Field(..., min_length=1)
    description: str | None = None

    @field_validator("name", "root_path")
    @classmethod
    def sanitize(cls, v: str) -> str:
        return sanitize_string(v)


class SourceContextResponse(BaseModel):
    source_context_id: str
    name: str
    slug: str
    root_path: str
    description: str | None
    is_active: bool
    created_at: str


# ---------------------------------------------------------------------------
# Source Scope
# ---------------------------------------------------------------------------

class SourceScopeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., pattern=r'^[a-z0-9_-]{1,64}$')
    relative_path: str = Field(..., min_length=1)
    scope_type: Literal["code", "doc", "config", "mixed"] = "code"


class SourceScopeResponse(BaseModel):
    source_scope_id: str
    source_context_id: str
    name: str
    slug: str
    relative_path: str
    scope_type: str
    is_active: bool
    created_at: str


# ---------------------------------------------------------------------------
# Audit Run
# ---------------------------------------------------------------------------

class AuditRunCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    answer: str = Field("", max_length=10000)
    context_slug: str | None = Field(None, pattern=r'^[a-z0-9_-]{1,64}$')
    scope_slug: str | None = Field(None, pattern=r'^[a-z0-9_-]{1,64}$')
    max_claims: int | None = Field(None, ge=1, le=30)
    answer_id: str | None = None
    ref: str | None = Field(
        None,
        max_length=256,
        description=(
            "Optional git ref (branch, tag, or commit SHA) to check out "
            "before auditing, instead of the context's default branch. "
            "Used by CI integrations (e.g. the GitHub Action) to audit a "
            "pull request's actual head commit rather than the base branch."
        ),
    )

    @field_validator("ref")
    @classmethod
    def validate_ref(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        # `ref` is passed as a subprocess argument to `git fetch origin <ref>`.
        # A value starting with "-" could be interpreted by git as an option
        # (e.g. "--upload-pack=...") rather than a refspec — a known
        # argument-injection vector — so reject anything that isn't a plain
        # branch/tag/SHA-shaped token.
        if not re.match(r'^[A-Za-z0-9][A-Za-z0-9_./-]{0,255}$', v) or ".." in v:
            raise ValueError(
                "Invalid ref. Must be a plain branch name, tag, or commit SHA."
            )
        return v

    @field_validator("question", "answer")
    @classmethod
    def sanitize(cls, v: str) -> str:
        if v is None:
            return ""
        return sanitize_string(v)


class WarningItem(BaseModel):
    warning_code: str
    message: str


class AuditFailureResponse(BaseModel):
    failure_code: str
    error_message: str


class EvidenceItemResponse(BaseModel):
    evidence_id: str
    claim_id: str
    filepath: str
    start_line: int
    end_line: int
    snippet_text: str
    relevance_score: float | None
    retrieval_method: str
    source_commit: str
    source_branch: str
    language: str
    rank: int


class ClaimResult(BaseModel):
    claim_id: str
    audit_run_id: str
    claim_index: int
    raw_text: str
    normalized_query: str
    status: Literal["pending", "processed", "skipped"]
    verdict: Literal["supported", "contradicted", "unverified"]
    confidence: float | None
    judge_explanation: str | None
    contradiction_reason: str | None = None
    created_at: str
    rule_trace: dict | None = None
    evidence_items: list[EvidenceItemResponse] = []


class AuditRunResponse(BaseModel):
    audit_run_id: str
    user_id: str
    source_context_id: str
    question_text: str
    answer_text: str
    status: str
    global_score: float | None
    started_at: str
    completed_at: str | None = None
    duration_ms: int | None = None
    clone_duration_ms: int | None = None
    retrieval_duration_ms: int | None = None
    verification_duration_ms: int | None = None
    persistence_duration_ms: int | None = None
    claims: list[ClaimResult] = []
    warnings: list[WarningItem] = []
    failure: AuditFailureResponse | None = None


class AuditRunSummary(BaseModel):
    audit_run_id: str
    status: str
    global_score: float | None
    claim_count: int
    started_at: str
    completed_at: str | None
    duration_ms: int | None = None


# ---------------------------------------------------------------------------
# API Keys — for headless/CI callers (e.g. the GitHub Action integration)
# ---------------------------------------------------------------------------

class ApiKeyCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=128)

    @field_validator("label")
    @classmethod
    def sanitize_label(cls, v: str) -> str:
        return sanitize_string(v.strip())[:128]


class ApiKeyCreateResponse(BaseModel):
    api_key_id: str
    label: str
    key_prefix: str
    api_key: str  # the raw key — shown exactly once, never persisted
    created_at: str


class ApiKeyResponse(BaseModel):
    api_key_id: str
    label: str
    key_prefix: str
    created_at: str
    last_used_at: str | None = None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str = "1.0.0"
    service: str = "varinth-api"
