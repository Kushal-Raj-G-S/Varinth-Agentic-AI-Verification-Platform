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
"""
import asyncio
import uuid
import time
import tempfile
import shutil
import subprocess
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.logging import get_logger
from app.core.security import sanitize_string
from app.services.claim_extractor import ClaimExtractor
from app.services.explanation import ExplanationService
from app.services.retriever import EvidenceRetriever, RetrievalScopeViolation
from app.services.verdict_engine import VerdictEngine, compute_global_score
import os
from app.services.agents import SwarmOrchestrator
from app.services.guardrails import GuardrailsService, PolicyViolationError
from app.services.memory import MemoryService
from app.services.graph import GraphService

settings = get_settings()
logger = get_logger("varinth.orchestrator")

NOW = lambda: datetime.now(timezone.utc).isoformat()


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
    ) -> dict[str, Any]:
        """
        Run the full verification pipeline for one audit.
        Returns the structured audit result regardless of partial failures.
        """
        run_start = time.monotonic()
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
            logger.error("audit_run_creation_failed", error=str(exc))
            return self._error_response(
                message="Failed to create audit run record.",
                error=str(exc),
            )

        is_git_repo = False
        temp_dir = None
        
        # Enforce remote Git Repository URLs strictly (SaaS compliance)
        if not root_path or not (root_path.startswith("http://") or root_path.startswith("https://") or root_path.startswith("git@")):
            logger.error("invalid_codebase_source", root_path=root_path)
            return self._error_response(
                message="Invalid codebase source. Varinth only supports remote Git Repository URLs (HTTP/HTTPS/SSH) for cloud security compliance.",
                error="LOCAL_PATHS_NOT_ALLOWED"
            )

        is_git_repo = True
        temp_dir = tempfile.mkdtemp(prefix="varinth_clone_")
        logger.info("cloning_remote_repository", git_url=root_path, temp_dir=temp_dir)
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", root_path, temp_dir],
                check=True,
                capture_output=True,
                text=True
            )
            root_path = temp_dir
            logger.info("cloning_remote_repository_success", temp_dir=temp_dir)
        except subprocess.CalledProcessError as exc:
            logger.error("cloning_remote_repository_failed", error=exc.stderr)
            shutil.rmtree(temp_dir, ignore_errors=True)
            return self._error_response(
                message="Failed to clone remote git repository.",
                error=exc.stderr,
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
                            error=str(exc),
                        )
                        warnings.append(self._warning(
                            "RETRIEVAL_ERROR",
                            f"Evidence retrieval failed for claim {claim_index}: {str(exc)[:200]}",
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
                mem = await self._memory.get_semantic_memory(project_slug, claim_text)
                if mem:
                    memory_context[claim_index] = mem

            verdict_results = await self._swarm.run_swarm(claims_raw, evidence_map, memory_context)
            await self._log_event(
                audit_run_id, "verdict_complete", "verdict",
                f"Swarm verification completed for {len(verdict_results)} claims.",
            )

            # ----------------------------------------------------------------
            # STAGE: OUTPUT – compute global score, merge results
            # ----------------------------------------------------------------
            # Merge importance from claim into verdict dict for global score computation
            claim_importance_map = {c["claim_index"]: c.get("importance", "medium") for c in claims_raw}
            for v in verdict_results:
                v["importance"] = claim_importance_map.get(v["claim_index"], "medium")

            global_score = compute_global_score(verdict_results)

            # Build merged claim result list
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
            await self._persist_results(
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
            await self._log_event(audit_run_id, "persist_complete", "persist", "Results persisted.")

        except Exception as exc:
            logger.error(
                "pipeline_unexpected_failure",
                audit_run_id=audit_run_id,
                error=str(exc),
            )
            status = "failed"
            warnings.append(self._warning("PIPELINE_ERROR", str(exc)[:500], "error"))
            await self._update_run_status(audit_run_id, "failed")
        finally:
            if is_git_repo and temp_dir:
                logger.info("cleaning_up_cloned_repository", temp_dir=temp_dir)
                shutil.rmtree(temp_dir, ignore_errors=True)

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
    ) -> None:
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

            # Evidence items
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

            # Verdict result
            verdict_rows.append({
                "claim_id": claim_id,
                "user_id": user_id,
                "verdict": claim_data["verdict"],
                "confidence": claim_data["confidence"],
                "explanation": claim_data["explanation"],
                "rule_trace": claim_data.get("rule_trace"),
                "evidence_count": len(claim_data.get("evidence", [])),
            })

        # Warnings
        for w in warnings:
            warning_rows.append({
                "audit_run_id": audit_run_id,
                "user_id": user_id,
                "warning_code": w["code"],
                "message": w["message"],
                "severity": w["severity"],
            })

        # Execute batch operations concurrently to maximize DB performance
        async def _run_batch_inserts():
            tasks = []
            if claims_rows:
                tasks.append(asyncio.to_thread(self._db.table("claims").insert(claims_rows).execute))
            if evidence_rows:
                tasks.append(asyncio.to_thread(self._db.table("evidence_items").insert(evidence_rows).execute))
            if verdict_rows:
                tasks.append(asyncio.to_thread(self._db.table("verdict_results").insert(verdict_rows).execute))
            if warning_rows:
                tasks.append(asyncio.to_thread(self._db.table("audit_warnings").insert(warning_rows).execute))
            if tasks:
                await asyncio.gather(*tasks)

        await _run_batch_inserts()

        # Update audit run status
        self._db.table("audit_runs").update({
            "status": status,
            "global_score": global_score,
            "completed_at": NOW(),
            "duration_ms": duration_ms,
        }).eq("audit_run_id", audit_run_id).execute()

    async def _update_run_status(self, audit_run_id: str, status: str) -> None:
        try:
            self._db.table("audit_runs").update({
                "status": status,
                "completed_at": NOW(),
            }).eq("audit_run_id", audit_run_id).execute()
        except Exception as exc:
            logger.error("run_status_update_failed", error=str(exc))

    async def _log_event(
        self,
        audit_run_id: str,
        event_type: str,
        stage: str,
        message: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        try:
            # user_id unavailable here without joining — service role bypass is fine
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
    def _error_response(message: str, error: str) -> dict[str, Any]:
        return {
            "audit_run_id": None,
            "status": "failed",
            "global_score": None,
            "claim_count": 0,
            "claims": [],
            "warnings": [{"code": "FATAL_ERROR", "message": message, "severity": "error"}],
            "duration_ms": 0,
        }
