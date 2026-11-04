"""
orchestrator.py
---------------
Verification pipeline coordinator for Varinth.

Pipeline stages:
  1. INPUT    – validate inputs, create AuditRun record
  2. EXTRACT  – extract atomic claims via LLM
  3. RETRIEVE – retrieve evidence per claim (bounded file search + semantic rerank)
  4. VERDICT  – assign verdicts via deterministic rule engine
  5. EXPLAIN  – generate natural-language explanations via LLM
  6. OUTPUT   – compute global score, build response
  7. PERSIST  – save all results to Supabase

On stage failure: marks run as 'partial' or 'failed', logs the event,
returns the best available structured result. Never raises unhandled exceptions.

CHANGELOG (v1 -> v2):
- Git checkout (clone/pull) is now offloaded to a thread with a hard timeout
  instead of blocking the event loop synchronously with no timeout.
- Git checkout is now protected by an OS-level advisory file lock scoped to
  the repo's cache directory, so concurrent audits against the same repo
  serialize instead of racing `git reset --hard` / `git clean -fd` against
  an in-flight read from another run.
- Repo cache keys now include a hash of the full URL (not just the path), so
  two different hosts that happen to share a path component no longer
  collide on the same cache directory.
- Every early-return path after audit-run creation now marks the run
  'failed' in the DB, so no run is left stuck at 'running' forever.
- Git URLs and subprocess stderr are redacted/sanitized before logging or
  being returned to the caller, so embedded credentials can't leak.
- max_claims is now hard-capped server-side regardless of fast_mode.
- Swarm-failure rule_trace and other error text are consistently truncated
  and sanitized before persistence/return.
- Secondary-table persistence (evidence/verdicts/warnings) no longer fails
  atomically-in-appearance-but-not-in-fact: failures are caught per-table,
  logged, and the run status is downgraded to 'partial' rather than the
  whole insert silently leaving some tables written and others not. Note:
  true atomicity across these tables still requires a DB-side transaction
  or RPC — this only makes the failure mode visible and non-crashing.
- _error_response now carries audit_run_id when one exists, so callers
  don't lose the ability to look up a run that failed early.
- Cross-platform file locking: support Windows via msvcrt and Unix via fcntl.
"""
import asyncio
import hashlib
import os
import re
import shutil
import subprocess
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Any

# Cross-platform advisory lock support
try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.logging import get_logger
from app.core.security import sanitize_string
from app.services.agents import SwarmOrchestrator
from app.services.claim_extractor import ClaimExtractor
from app.services.explanation import ExplanationService
from app.services.graph import GraphService
from app.services.guardrails import GuardrailsService, PolicyViolationError
from app.services.memory import MemoryService
from app.services.retriever import EvidenceRetriever, RetrievalScopeViolation
from app.services.verdict_engine import VerdictEngine, compute_global_score

settings = get_settings()
logger = get_logger("varinth.orchestrator")

NOW = lambda: datetime.now(timezone.utc).isoformat()

# Hard limits — see CHANGELOG. These protect the process (event loop,
# resource fan-out) independent of any caller-supplied values.
GIT_CLONE_TIMEOUT_SECONDS = 60
GIT_PULL_TIMEOUT_SECONDS = 30
DEFAULT_MAX_CLAIMS = 15
MAX_CLAIMS_HARD_CAP = 50
ERROR_TEXT_MAX_CHARS = 300

_CRED_URL_RE = re.compile(r"://[^\s/@]+:[^\s/@]+@")


def _redact_git_url(url: str) -> str:
    """Strip embedded userinfo (user:token@) and query params from a git URL
    before it's ever logged or returned to a caller."""
    if not url:
        return ""
    try:
        parsed = urllib.parse.urlsplit(url)
        netloc = parsed.hostname or ""
        if parsed.port:
            netloc += f":{parsed.port}"
        redacted = parsed._replace(netloc=netloc, query="", fragment="")
        return urllib.parse.urlunsplit(redacted)
    except Exception:
        return "<unparseable-url-redacted>"


def _sanitize_error_text(text: str | None, limit: int = ERROR_TEXT_MAX_CHARS) -> str:
    """Redact anything that looks like embedded credentials, then truncate.
    Applied to every piece of exception/stderr text before it is logged,
    persisted, or returned to a caller."""
    if not text:
        return ""
    text = _CRED_URL_RE.sub("://***:***@", str(text))
    return text[:limit]


class GitCheckoutError(Exception):
    """Raised by _sync_checkout_git_repo. `safe_detail` has already been
    redacted/truncated and is safe to log or return to a caller."""

    def __init__(self, message: str, safe_detail: str = ""):
        super().__init__(message)
        self.safe_detail = safe_detail


def _sync_checkout_git_repo(git_url: str, cache_base_dir: str, ref: str | None = None) -> str:
    """
    Synchronous — MUST be called via asyncio.to_thread with a wrapping
    timeout. Shells out to git and blocks the calling thread.

    Uses an OS-level advisory lock (fcntl.flock on Unix, msvcrt.locking on Windows)
    on a lock file scoped to this repo's cache directory, so concurrent checkouts of
    the SAME repo — whether from concurrent asyncio tasks in this process or from
    separate worker processes — serialize instead of racing destructive git commands
    against an in-flight read.

    The cache directory name includes a hash of the full URL (host + path),
    not just the path, so two different remotes that happen to share a path
    component never collide on disk.

    `ref` (already validated upstream — see AuditRunCreate.validate_ref —
    to rule out option-injection via subprocess) pins the checkout to a
    specific branch/tag/commit instead of the remote's default branch, e.g.
    to audit a pull request's actual head commit. Concurrent audits against
    the same repo URL but different refs still serialize on the same lock,
    which is consistent with this cache being one worktree per repo URL.
    """
    os.makedirs(cache_base_dir, exist_ok=True)

    url_hash = hashlib.sha256(git_url.encode("utf-8")).hexdigest()[:16]
    parsed = urllib.parse.urlparse(git_url)
    slug = parsed.path.strip("/").replace("/", "_").replace(".git", "") or "repo"
    repo_cache_path = os.path.join(cache_base_dir, f"{slug}_{url_hash}")
    lock_path = repo_cache_path + ".lock"

    # Cross-platform implementation of advisory file locking
    if fcntl:
        # Unix locking
        with open(lock_path, "w") as lock_file:
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            try:
                return _perform_git_ops(git_url, repo_cache_path, ref)
            finally:
                fcntl.flock(lock_file, fcntl.LOCK_UN)
    elif msvcrt:
        # Windows locking
        lock_file = open(lock_path, "w")
        try:
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
            return _perform_git_ops(git_url, repo_cache_path, ref)
        finally:
            try:
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            except Exception:
                pass
            lock_file.close()
    else:
        # Fallback to no-lock if neither module is available (rare)
        return _perform_git_ops(git_url, repo_cache_path, ref)


def _perform_git_ops(git_url: str, repo_cache_path: str, ref: str | None = None) -> str:
    """Helper function to perform actual git operations once lock is acquired."""
    if os.path.isdir(repo_cache_path):
        try:
            subprocess.run(
                ["git", "reset", "--hard"],
                cwd=repo_cache_path, check=True, capture_output=True,
                text=True, timeout=GIT_PULL_TIMEOUT_SECONDS,
            )
            subprocess.run(
                ["git", "clean", "-fd"],
                cwd=repo_cache_path, check=True, capture_output=True,
                text=True, timeout=GIT_PULL_TIMEOUT_SECONDS,
            )
            subprocess.run(
                ["git", "pull"],
                cwd=repo_cache_path, check=True, capture_output=True,
                text=True, timeout=GIT_PULL_TIMEOUT_SECONDS,
            )
            _checkout_ref_if_given(repo_cache_path, ref)
            return repo_cache_path
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            # Cache is in an unknown/bad state — drop it and fall
            # through to a fresh clone below, but this fallback is
            # itself fully guarded.
            shutil.rmtree(repo_cache_path, ignore_errors=True)
        except GitCheckoutError:
            # ref checkout failed on an otherwise-good cache — don't
            # nuke a perfectly good clone just because the requested ref
            # didn't resolve; let the error propagate.
            raise

    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", git_url, repo_cache_path],
            check=True, capture_output=True, text=True,
            timeout=GIT_CLONE_TIMEOUT_SECONDS,
        )
        _checkout_ref_if_given(repo_cache_path, ref)
        return repo_cache_path
    except subprocess.TimeoutExpired as exc:
        shutil.rmtree(repo_cache_path, ignore_errors=True)
        raise GitCheckoutError(
            "Git clone timed out.",
            safe_detail=_sanitize_error_text(str(exc)),
        ) from exc
    except subprocess.CalledProcessError as exc:
        shutil.rmtree(repo_cache_path, ignore_errors=True)
        raise GitCheckoutError(
            "Failed to clone remote git repository.",
            safe_detail=_sanitize_error_text(exc.stderr or str(exc)),
        ) from exc
    except GitCheckoutError:
        shutil.rmtree(repo_cache_path, ignore_errors=True)
        raise


def _checkout_ref_if_given(repo_cache_path: str, ref: str | None) -> None:
    """
    Fetch and check out a specific ref (branch, tag, or commit SHA) on top
    of an already-cloned/updated repo_cache_path. No-op if ref is None —
    the repo is left on whatever the prior clone/pull/reset left it on
    (the remote's default branch).
    """
    if not ref:
        return
    try:
        subprocess.run(
            ["git", "fetch", "--depth", "1", "origin", ref],
            cwd=repo_cache_path, check=True, capture_output=True,
            text=True, timeout=GIT_PULL_TIMEOUT_SECONDS,
        )
        subprocess.run(
            ["git", "checkout", "--force", "FETCH_HEAD"],
            cwd=repo_cache_path, check=True, capture_output=True,
            text=True, timeout=GIT_PULL_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise GitCheckoutError(
            f"Timed out checking out ref '{ref}'.",
            safe_detail=_sanitize_error_text(str(exc)),
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise GitCheckoutError(
            f"Failed to check out ref '{ref}'. It may not exist on the remote.",
            safe_detail=_sanitize_error_text(exc.stderr or str(exc)),
        ) from exc


class VerificationOrchestrator:
    def __init__(self) -> None:
        self._extractor = ClaimExtractor()
        self._retriever = EvidenceRetriever()
        self._verdict_engine = VerdictEngine()
        self._explainer = ExplanationService()
        self._swarm = SwarmOrchestrator()
        self._guardrails = GuardrailsService()
        self._memory = MemoryService()
        self._graph = GraphService()
        self._db = get_supabase()

    async def run(
        self,
        user_id: str | None,
        question: str,
        answer: str,
        source_context_id: str | None = None,
        source_scope_id: str | None = None,
        root_path: str | None = None,
        scope_relative_path: str = "",
        max_claims: int | None = None,
        answer_id: str | None = None,
        client_name: str | None = None,
        transport_type: str | None = None,
        ref: str | None = None,
    ) -> dict[str, Any]:
        """
        Run the full verification pipeline for one audit.
        Returns the structured audit result regardless of partial failures.
        """
        run_start = time.monotonic()

        fast_mode = (client_name == "mcp" or transport_type == "stdio")

        # Server-side ceiling regardless of what the caller requests, to
        # bound retrieval fan-out (asyncio.gather over claims) and cost.
        effective_max_claims = max_claims if max_claims is not None else DEFAULT_MAX_CLAIMS
        effective_max_claims = max(1, min(effective_max_claims, MAX_CLAIMS_HARD_CAP))
        if fast_mode:
            effective_max_claims = min(effective_max_claims, 5)
        max_claims = effective_max_claims

        audit_run_id: str | None = None
        warnings: list[dict[str, Any]] = []
        status = "completed"
        claims_out: list[dict[str, Any]] = []
        global_score: float | None = None

        # ----------------------------------------------------------------
        # STAGE: INPUT – create audit run record
        # ----------------------------------------------------------------
        try:
            audit_run_id = await self._create_audit_run(
                user_id=user_id,
                question=question,
                answer=answer,
                source_context_id=source_context_id,
                source_scope_id=source_scope_id,
                max_claims=max_claims,
                answer_id=answer_id,
                client_name=client_name,
                transport_type=transport_type,
            )
        except Exception as exc:
            logger.error("audit_run_creation_failed", error=_sanitize_error_text(str(exc)))
            return self._error_response(
                message="Failed to create audit run record.",
                error=_sanitize_error_text(str(exc)),
            )

        # ----------------------------------------------------------------
        # STAGE: INPUT – resolve codebase source (local dir or remote git)
        # ----------------------------------------------------------------
        # Every branch below that returns early now also marks the run
        # 'failed' in the DB, so no row is left stuck at 'running'.
        if transport_type == "stdio":
            if not root_path or not os.path.isdir(root_path):
                logger.error("invalid_local_codebase_source", root_path=root_path)
                await self._update_run_status(audit_run_id, "failed")
                return self._error_response(
                    message="Invalid codebase source. Local directory path does not exist.",
                    error="LOCAL_PATH_NOT_FOUND",
                    audit_run_id=audit_run_id,
                )
        else:
            if not root_path or not root_path.startswith(("http://", "https://", "git@")):
                logger.error("invalid_codebase_source", root_path=_redact_git_url(root_path or ""))
                await self._update_run_status(audit_run_id, "failed")
                return self._error_response(
                    message="Invalid codebase source. Varinth only supports remote Git "
                    "Repository URLs (HTTP/HTTPS/SSH) for cloud security compliance.",
                    error="LOCAL_PATHS_NOT_ALLOWED",
                    audit_run_id=audit_run_id,
                )

            services_dir = os.path.dirname(os.path.realpath(__file__))
            workspace_root = os.path.realpath(os.path.join(services_dir, "..", "..", ".."))
            cache_base_dir = os.path.join(workspace_root, "backend", "temp_clone")

            redacted_url = _redact_git_url(root_path)
            try:
                logger.info("git_checkout_start", git_url=redacted_url)
                local_root_path = await asyncio.wait_for(
                    asyncio.to_thread(_sync_checkout_git_repo, root_path, cache_base_dir, ref),
                    timeout=GIT_CLONE_TIMEOUT_SECONDS + 15,
                )
                root_path = local_root_path
                logger.info("git_checkout_success", git_url=redacted_url, local_path=local_root_path)
            except GitCheckoutError as exc:
                logger.error("git_checkout_failed", git_url=redacted_url, detail=exc.safe_detail)
                await self._update_run_status(audit_run_id, "failed")
                return self._error_response(
                    message=str(exc), error=exc.safe_detail, audit_run_id=audit_run_id,
                )
            except asyncio.TimeoutError:
                logger.error("git_checkout_timeout", git_url=redacted_url)
                await self._update_run_status(audit_run_id, "failed")
                return self._error_response(
                    message="Git checkout timed out.", error="GIT_TIMEOUT", audit_run_id=audit_run_id,
                )
            except Exception as exc:
                # Belt-and-suspenders: this block runs before the pipeline's
                # main try/except, so nothing here may escape unhandled.
                logger.error("git_checkout_unexpected_error", git_url=redacted_url,
                             error=_sanitize_error_text(str(exc)))
                await self._update_run_status(audit_run_id, "failed")
                return self._error_response(
                    message="Unexpected error preparing codebase source.",
                    error=_sanitize_error_text(str(exc)),
                    audit_run_id=audit_run_id,
                )

        try:
            await self._log_event(audit_run_id, "run_started", "input", "Audit run started.")

            # ----------------------------------------------------------------
            # STAGE: GUARDRAILS INPUT CHECKS
            # ----------------------------------------------------------------
            try:
                self._guardrails.evaluate_input(question, answer)
                self._guardrails.validate_scope(scope_relative_path)
            except PolicyViolationError as exc:
                logger.warning("run_blocked_by_guardrails", error=str(exc))
                warnings.append(self._warning("POLICY_VIOLATION", str(exc), "error"))
                await self._log_event(audit_run_id, "run_blocked_by_guardrails", "input", str(exc))
                await self._update_run_status(audit_run_id, "failed")
                await self._persist_results(
                    audit_run_id=audit_run_id,
                    user_id=user_id,
                    source_context_id=source_context_id,
                    source_scope_id=source_scope_id,
                    claims_out=[],
                    warnings=warnings,
                    global_score=0.0,
                    status="failed",
                    duration_ms=int((time.monotonic() - run_start) * 1000),
                )
                return {
                    "audit_run_id": audit_run_id,
                    "status": "failed",
                    "global_score": 0.0,
                    "claim_count": 0,
                    "claims": [],
                    "warnings": warnings,
                    "duration_ms": int((time.monotonic() - run_start) * 1000),
                }

            # ----------------------------------------------------------------
            # STAGE: EXTRACT
            # ----------------------------------------------------------------
            # Question-Only Mode synthesis if answer is empty
            if not answer.strip():
                await self._log_event(
                    audit_run_id, "question_only_retrieval_start", "retrieve",
                    "Question-Only Mode active. Retrieving context for question."
                )
                question_candidates = await self._retriever.retrieve(
                    claim_text=question,
                    root_path=root_path,
                    scope_relative_path=scope_relative_path
                )
                if not question_candidates:
                    answer = "No relevant codebase snippets could be retrieved to answer this question."
                else:
                    context_blocks = []
                    for idx, cand in enumerate(question_candidates[:5]):
                        context_blocks.append(
                            f"File: {cand.get('source_id') or cand.get('filepath')}\n"
                            f"Snippet:\n{cand.get('snippet')}"
                        )
                    context_str = "\n\n".join(context_blocks)
                    system_prompt = (
                        "You are an advanced, professional AI system for Varinth verification. "
                        "Draft a technical, concise, and highly accurate answer to the user's codebase question. "
                        "State facts clearly and cite files where appropriate. "
                        "If the codebase context is insufficient, state exactly what is missing rather than inventing facts."
                    )
                    prompt = (
                        f"User Question: {question}\n\n"
                        f"Codebase context snippets:\n{context_str}\n\n"
                        f"Grounded Draft Answer:"
                    )
                    try:
                        from app.services.llm_client import get_llm_client
                        llm_client = get_llm_client()
                        draft_answer = await llm_client.complete(
                            system_prompt=system_prompt,
                            user_prompt=prompt
                        )
                        answer = draft_answer.strip()
                    except Exception as e:
                        logger.error("question_only_synthesis_failed", error=_sanitize_error_text(str(e)))
                        answer = f"Failed to synthesize draft answer: {_sanitize_error_text(str(e))}"

                await self._log_event(
                    audit_run_id, "question_only_synthesis_complete", "input",
                    "Grounded draft answer synthesized.",
                    {"draft_answer_preview": answer[:100]}
                )
                try:
                    self._db.table("audit_runs").update({
                        "answer": answer
                    }).eq("audit_run_id", audit_run_id).execute()
                except Exception as exc:
                    logger.error("update_run_answer_failed", error=_sanitize_error_text(str(exc)))

            await self._log_event(audit_run_id, "extract_start", "extract", "Extracting claims.")
            claims_raw, prompt_version, model_status = await self._extractor.extract(
                question=sanitize_string(question),
                answer=sanitize_string(answer),
                max_claims=max_claims,
            )

            if not claims_raw:
                warnings.append(self._warning("NO_CLAIMS_EXTRACTED",
                    "Claim extraction returned zero claims. Answer may not contain verifiable statements.",
                    "warning"))
                status = "partial"

            if model_status == "fallback":
                warnings.append(self._warning("LLM_FALLBACK_USED",
                    "LLM unavailable. Claim extraction used regex fallback. Results may be less precise.",
                    "warning"))

            await self._log_event(
                audit_run_id, "extract_complete", "extract",
                f"Extracted {len(claims_raw)} claims using {prompt_version}.",
                {"count": len(claims_raw), "model_status": model_status},
            )

            # ----------------------------------------------------------------
            # STAGE: RETRIEVE
            # ----------------------------------------------------------------
            evidence_map: dict[int, list[dict[str, Any]]] = {}

            if root_path and claims_raw:
                await self._log_event(audit_run_id, "retrieve_start", "retrieve",
                    f"Retrieving evidence for {len(claims_raw)} claims.")

                async def _retrieve_single(claim: dict[str, Any]) -> tuple[int, list[dict[str, Any]]]:
                    nonlocal status
                    claim_index = claim["claim_index"]
                    try:
                        evidence = await self._retriever.retrieve(
                            claim_text=claim["normalized_text"],
                            root_path=root_path,
                            scope_relative_path=scope_relative_path,
                        )
                        return claim_index, evidence
                    except RetrievalScopeViolation as exc:
                        warnings.append(self._warning("RETRIEVAL_SCOPE_VIOLATION", str(exc), "error"))
                        status = "partial"
                        return claim_index, []
                    except Exception as exc:
                        logger.warning(
                            "evidence_retrieval_error",
                            claim_index=claim_index,
                            error=_sanitize_error_text(str(exc)),
                        )
                        warnings.append(self._warning(
                            "RETRIEVAL_ERROR",
                            f"Evidence retrieval failed for claim {claim_index}: "
                            f"{_sanitize_error_text(str(exc))}",
                            "warning",
                        ))
                        return claim_index, []

                retrieval_results = await asyncio.gather(*(_retrieve_single(c) for c in claims_raw))
                for claim_index, evidence in retrieval_results:
                    evidence_map[claim_index] = evidence

                await self._log_event(
                    audit_run_id, "retrieve_complete", "retrieve",
                    f"Evidence retrieved for {len(evidence_map)}/{len(claims_raw)} claims.",
                )
            else:
                if not root_path:
                    warnings.append(self._warning("NO_SOURCE_CONTEXT",
                        "No source context provided. All claims will be 'unverified'.",
                        "info"))

            # ----------------------------------------------------------------
            # STAGE: AGENT SWARM VERIFICATION (Critic + Verifier + Judge)
            # ----------------------------------------------------------------
            await self._log_event(audit_run_id, "verdict_start", "verdict", "Querying agentic memories and starting swarm.")

            project_slug = "default"
            if root_path:
                project_slug = os.path.basename(os.path.normpath(root_path))

            memory_context = {}
            for claim in claims_raw:
                claim_index = claim["claim_index"]
                claim_text = claim["normalized_text"]
                try:
                    mem = await self._memory.get_semantic_memory(project_slug, claim_text)
                    if mem:
                        memory_context[claim_index] = mem
                except Exception as mem_exc:
                    logger.warning("failed_to_get_memory_context", claim_index=claim_index,
                                   error=_sanitize_error_text(str(mem_exc)))

            verdict_results = []
            try:
                verdict_results = await self._swarm.run_swarm(claims_raw, evidence_map, memory_context, fast_mode=fast_mode)
                await self._log_event(
                    audit_run_id, "verdict_complete", "verdict",
                    f"Swarm verification completed for {len(verdict_results)} claims.",
                )
            except Exception as swarm_exc:
                safe_swarm_error = _sanitize_error_text(str(swarm_exc))
                logger.error("swarm_verification_failed_using_unverified_fallback", error=safe_swarm_error)
                warnings.append(self._warning(
                    "SWARM_PARTIAL_FAILURE",
                    f"Agent verification swarm failed: {safe_swarm_error}. Fallback to unverified.",
                    "warning",
                ))
                status = "partial"
                for claim in claims_raw:
                    verdict_results.append({
                        "claim_index": claim["claim_index"],
                        "verdict": "unverified",
                        "confidence": 0.0,
                        "explanation": "Verification pipeline encountered an unexpected agent swarm error. Defaulting to unverified.",
                        "rule_trace": {"error": safe_swarm_error},
                    })

            # ----------------------------------------------------------------
            # STAGE: OUTPUT – compute global score, merge results
            # ----------------------------------------------------------------
            claim_importance_map = {c["claim_index"]: c.get("importance", "medium") for c in claims_raw}
            for v in verdict_results:
                v["importance"] = claim_importance_map.get(v["claim_index"], "medium")

            global_score = compute_global_score(verdict_results)

            verdict_by_index = {v["claim_index"]: v for v in verdict_results}
            for claim in claims_raw:
                claim_index = claim["claim_index"]
                v = verdict_by_index.get(claim_index, {})
                evidence_items = evidence_map.get(claim_index, [])
                claims_out.append({
                    "claim_index": claim_index,
                    "raw_text": claim["raw_text"],
                    "normalized_text": claim["normalized_text"],
                    "claim_type": claim["claim_type"],
                    "importance": claim["importance"],
                    "verdict": v.get("verdict", "unverified"),
                    "confidence": v.get("confidence", 0.0),
                    "explanation": v.get("explanation"),
                    "rule_trace": v.get("rule_trace"),
                    "evidence": evidence_items,
                })

            # Save verified claims to memory and Knowledge Graph
            for c in claims_out:
                if c["verdict"] in {"supported", "contradicted"} and not (c.get("rule_trace") or {}).get("memory_hit"):
                    await self._memory.add_memory(
                        project_slug=project_slug,
                        claim_text=c["normalized_text"],
                        verdict=c["verdict"],
                        explanation=c["explanation"],
                    )

            await self._graph.record_audit_graph(
                audit_run_id=audit_run_id,
                project_slug=project_slug,
                claims_out=claims_out,
            )

            # ----------------------------------------------------------------
            # STAGE: PERSIST
            # ----------------------------------------------------------------
            await self._log_event(audit_run_id, "persist_start", "persist", "Persisting results.")
            persist_had_partial_failure = await self._persist_results(
                audit_run_id=audit_run_id,
                user_id=user_id,
                source_context_id=source_context_id,
                source_scope_id=source_scope_id,
                claims_out=claims_out,
                warnings=warnings,
                global_score=global_score,
                status=status,
                duration_ms=int((time.monotonic() - run_start) * 1000),
            )
            if persist_had_partial_failure and status == "completed":
                status = "partial"
            await self._log_event(audit_run_id, "persist_complete", "persist", "Results persisted.")

        except Exception as exc:
            logger.error(
                "pipeline_unexpected_failure",
                audit_run_id=audit_run_id,
                error=_sanitize_error_text(str(exc)),
            )
            status = "failed"
            warnings.append(self._warning("PIPELINE_ERROR", _sanitize_error_text(str(exc)), "error"))
            await self._update_run_status(audit_run_id, "failed")

        duration_ms = int((time.monotonic() - run_start) * 1000)

        return {
            "audit_run_id": audit_run_id,
            "status": status,
            "global_score": global_score,
            "claim_count": len(claims_out),
            "claims": claims_out,
            "warnings": warnings,
            "duration_ms": duration_ms,
        }

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def _create_audit_run(self, **kwargs) -> str:
        result = self._db.table("audit_runs").insert({
            "user_id": kwargs["user_id"],
            "source_context_id": kwargs.get("source_context_id"),
            "source_scope_id": kwargs.get("source_scope_id"),
            "question": kwargs["question"],
            "answer": kwargs["answer"],
            "answer_id": kwargs.get("answer_id"),
            "requested_max_claims": kwargs.get("max_claims"),
            "status": "running",
            "client_name": kwargs.get("client_name"),
            "transport_type": kwargs.get("transport_type"),
            "started_at": NOW(),
        }).execute()
        return result.data[0]["audit_run_id"]

    async def _persist_results(
        self,
        audit_run_id: str,
        user_id: str | None,
        source_context_id: str | None,
        source_scope_id: str | None,
        claims_out: list[dict[str, Any]],
        warnings: list[dict[str, Any]],
        global_score: float | None,
        status: str,
        duration_ms: int,
    ) -> bool:
        """
        Persist claims/evidence/verdicts/warnings.

        Returns True if any secondary-table insert (evidence, verdicts,
        warnings) failed. Claims are the hard dependency for everything
        else via foreign key, so a claims-insert failure still raises.

        NOTE: this is fault-tolerant, not atomic. If a secondary table
        fails after claims succeed, you'll have claim rows with partial
        children rather than none — surfaced via the returned bool and a
        'partial' run status, not silently swallowed. The durable fix is
        a single DB-side transaction/RPC wrapping all four inserts; that's
        an infra change outside what this file can guarantee on its own.
        """
        claims_rows = []
        evidence_rows = []
        verdict_rows = []
        warning_rows = []

        for claim_data in claims_out:
            claim_id = str(uuid.uuid4())
            claims_rows.append({
                "claim_id": claim_id,
                "audit_run_id": audit_run_id,
                "user_id": user_id,
                "claim_index": claim_data["claim_index"],
                "raw_text": claim_data["raw_text"],
                "normalized_text": claim_data["normalized_text"],
                "claim_type": claim_data["claim_type"],
                "importance": claim_data["importance"],
            })

            for ev in claim_data.get("evidence", []):
                evidence_rows.append({
                    "claim_id": claim_id,
                    "user_id": user_id,
                    "source_context_id": source_context_id,
                    "source_scope_id": source_scope_id,
                    "source_type": "code",
                    "source_id": ev["source_id"],
                    "location": ev["location"],
                    "snippet": ev["snippet"],
                    "relevance_score": ev.get("relevance_score"),
                    "retrieval_rank": ev.get("retrieval_rank"),
                    "supports_claim": ev.get("supports_claim"),
                    "contradicts_claim": ev.get("contradicts_claim"),
                })

            verdict_rows.append({
                "claim_id": claim_id,
                "user_id": user_id,
                "verdict": claim_data["verdict"],
                "confidence": claim_data["confidence"],
                "explanation": claim_data["explanation"],
                "rule_trace": claim_data.get("rule_trace"),
                "evidence_count": len(claim_data.get("evidence", [])),
            })

        for w in warnings:
            warning_rows.append({
                "audit_run_id": audit_run_id,
                "user_id": user_id,
                "warning_code": w["code"],
                "message": w["message"],
                "severity": w["severity"],
            })

        had_partial_failure = False

        if claims_rows:
            # Hard dependency for everything else — let this raise up to
            # the pipeline's outer handler if it fails.
            await asyncio.to_thread(self._db.table("claims").insert(claims_rows).execute)

        secondary = {
            "evidence_items": evidence_rows,
            "verdict_results": verdict_rows,
            "audit_warnings": warning_rows,
        }
        tasks = {
            name: asyncio.to_thread(self._db.table(name).insert(rows).execute)
            for name, rows in secondary.items() if rows
        }
        if tasks:
            results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            for name, result in zip(tasks.keys(), results):
                if isinstance(result, Exception):
                    had_partial_failure = True
                    logger.error(
                        "persist_secondary_table_failed",
                        table=name,
                        audit_run_id=audit_run_id,
                        error=_sanitize_error_text(str(result)),
                    )

        final_status = "partial" if (had_partial_failure and status == "completed") else status
        self._db.table("audit_runs").update({
            "status": final_status,
            "global_score": global_score,
            "completed_at": NOW(),
            "duration_ms": duration_ms,
        }).eq("audit_run_id", audit_run_id).execute()

        return had_partial_failure

    async def _update_run_status(self, audit_run_id: str, status: str) -> None:
        try:
            self._db.table("audit_runs").update({
                "status": status,
                "completed_at": NOW(),
            }).eq("audit_run_id", audit_run_id).execute()
        except Exception as exc:
            logger.error("run_status_update_failed", error=_sanitize_error_text(str(exc)))

    async def _log_event(
        self,
        audit_run_id: str,
        event_type: str,
        stage: str,
        message: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        try:
            self._db.table("execution_events").insert({
                "audit_run_id": audit_run_id,
                "user_id": None,
                "event_type": event_type,
                "stage": stage,
                "message": message,
                "payload_json": payload,
            }).execute()
        except Exception:
            pass  # logging must never crash the pipeline

    @staticmethod
    def _warning(code: str, message: str, severity: str = "warning") -> dict[str, Any]:
        return {"code": code, "message": message, "severity": severity}

    @staticmethod
    def _error_response(message: str, error: str, audit_run_id: str | None = None) -> dict[str, Any]:
        return {
            "audit_run_id": audit_run_id,
            "status": "failed",
            "global_score": None,
            "claim_count": 0,
            "claims": [],
            "warnings": [{"code": "FATAL_ERROR", "message": message, "severity": "error"}],
            "duration_ms": 0,
        }
