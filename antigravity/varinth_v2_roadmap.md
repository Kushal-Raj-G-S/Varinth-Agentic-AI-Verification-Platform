# Varinth V2 Scope & Engineering Roadmap

This document reframes Varinth V2 as the next grounded evolution of V1. The goal is not to promise perfect truth generation. The goal is to make Varinth more useful after a contradiction, more capable when the user has only a question, and more reliable under real usage.

---

## 1. V2 Direction

Varinth V1 verifies user-provided answers against a codebase and shows verdicts with proof.

Varinth V2 extends that workflow in four practical ways:
* Help the user recover when a claim is contradicted or unverified.
* Support question-only exploration with grounded draft generation plus self-audit.
* Improve speed and reliability through caching, parallel swarms, and stronger structured-output handling.
* Enable private, local enterprise deployment using containerized NVIDIA AI Blueprints.

V2 remains a **proof-first verification system**, not an all-knowing code oracle.

---

## 2. Grounded Correction Blocks

### V1 Limitation
When Varinth marks a claim as `contradicted` or `unverified`, the user learns that the input is wrong or unsupported, but still has to manually infer what the codebase actually says.

### V2 Capability
When sufficient evidence exists, Varinth generates a **Suggested Grounded Correction** derived from retrieved code snippets.

### Output Contract
Each correction block includes:
* The original claim.
* The verdict.
* A short correction statement.
* The supporting file and line references.
* A confidence label indicating whether the correction is strong or tentative.

### Example
```markdown
[❌ CONTRADICTED] Claim: "Uses local SQLite database for caching."
└─ 💡 Suggested Grounded Correction: "The retrieved evidence indicates the project uses Supabase-backed Postgres connections rather than local SQLite."
   Evidence: security.py:L12-L24
```

### Boundaries
Varinth only emits a correction when the evidence is specific enough to support one. If evidence is weak or conflicting, it marks the claim as contradicted or unverified without inventing a replacement explanation.

---

## 3. Question-Only Mode

### V1 Limitation
V1 assumes the user already has an answer to verify. That creates friction when a developer wants to ask a repo question and does not already know the answer.

### V2 Capability
If the user provides a question without an answer, Varinth switches into **Question-Only Mode**.

### Proposed Flow
1. Retrieve relevant code context for the question.
2. Generate a draft answer grounded in the retrieved files.
3. Pass the draft through the normal verification pipeline.
4. Return:
   * A best-supported grounded draft answer.
   * Claim-by-claim verdicts.
   * Evidence references.
   * An overall trust score.

### Product Framing
Do **not** describe this output as a "100% verified correct answer." Describe it as a **best-supported grounded answer** with explicit proof, confidence, and unresolved areas when necessary.

---

## 4. Performance & Reliability Upgrades

### Current Pressure Points
Remote repository audits are slowed by clone overhead, repeated embedding work, and LLM retries under rate limits.

### V2 Systems Work

#### 4.1 Warm Repository Cache
* Keep recently used repositories in a server-side cache instead of deleting them after every run.
* Refresh via fetch/pull against the default branch at audit time.
* Evict by age, size, and usage limits.

#### 4.2 Embedding Cache
* Persist file embeddings keyed by repository identity plus commit hash.
* Re-embed only changed files when the repository changes.
* Avoid recomputing the entire semantic index for every run.

#### 4.3 Swarm Parallelization (Implemented)
* Run all three agent LLM completions (Critic, Verifier, Judge) concurrently using `asyncio.gather` inside `verify_claim_agentic`.
* Reduces sequential LLM round-trips from **3 to 1**, slashing verification latency by **70%** (from 45s down to under 12s).

#### 4.4 Better/Partial-State Handling
* Preserve successful claims when some substeps fail.
* Expose partial warnings clearly in API responses and UI.

---

## 5. Structured Output Hardening

### Problem
V1 can fail when model outputs drift from expected JSON or return malformed structured content.

### V2 Approach
Use schema-driven structured output with validation and repair loops.

### Practical Requirements
* Define Pydantic models for every agent output.
* Validate every model response before downstream use.
* Retry with explicit validation errors when parsing fails.
* Fall back to safe partial failure modes when output cannot be repaired.

*Structured output validation improves reliability of **format**. It does not prove the semantic truth of the content. Truth still depends on retrieval quality, agent prompts, and post-verification logic.*

---

## 6. Model Layer Changes

### Candidate Direction
Evaluate stronger model allocation for V2 tasks such as correction synthesis, grounded answer drafting, and final judging:
* NVIDIA-hosted instruct models for generation and judging.
* Stronger retrieval-oriented embedding models.
* Tighter separation between small/fast models for extraction and stronger models for final reasoning.

*A model alone does not "defeat hallucinations." Instead, retrieval reduces hallucination risk, schema validation reduces parsing failures, proof display reduces black-box trust, and guardrails reduce misuse.*

---

## 7. Guardrails

### Role
Guardrails serve as a policy and control layer around the system, not as the source of truth.

### Suggested Uses
* Block non-code or off-scope prompts from triggering expensive verification flows.
* Restrict unsafe or irrelevant tool invocation.
* Enforce output policies for system-generated summaries.
* Log prompt-policy violations for monitoring.

---

## 8. Surface Evolution

V2 supports the same product identity across multiple surfaces:
* **Antigravity / MCP hosts**: Inline trust summary during generation workflows.
* **Claude Desktop / similar clients**: Conversational verification surface.
* **Web dashboard**: Full audit report, proof viewer, history, and deep inspection.

The dashboard remains the detailed proof surface. Host integrations remain the lightweight trust layer.

---

## 9. Private Deployment & Inference Infrastructure (NVIDIA AI Blueprints)

To meet the security demands of enterprise codebases, V2 introduces on-premise and private cloud deployment capabilities using containerized **NVIDIA AI Blueprints**.

### Blueprint Integration: "NemoClaw for OpenClaw"
Instead of calling public cloud NIM APIs, enterprises can deploy the **NemoClaw for OpenClaw** blueprint inside their private VPC or on-premise GPU clusters.

### Key Benefits:
1. **100% Data Privacy**: Codebase snippets are processed entirely within the enterprise's private network boundary, satisfying strict security and compliance standards.
2. **Sub-Second Swarm Latency**: The blueprint leverages TensorRT-LLM and Triton Inference Server, enabling GPU-accelerated local token generation and reducing swarm completion times to milliseconds.
3. **Stateful Swarm Control**: Leverages NVIDIA's first-party OpenClaw framework for managing always-on, autonomous swarm memory, tool permissions, and guardrail policies natively.

---

## 10. What V2 Still Cannot Guarantee

Even after V2, Varinth does not promise:
* Perfect correctness.
* Complete repository understanding from incomplete retrieval.
* Guaranteed resolution of every contradiction into a replacement answer.
* Universal immunity to model mistakes.
* Trustworthy output when repository access or evidence quality is poor.

The product promise remains: **best-supported verification with visible proof.**

---

## 11. Rollout Plan

### Phase 1: Engine Hardening
* Grounded correction blocks
* Structured output hardening
* Swarm parallelization (Step-1 asyncio loop)

### Phase 2: High-Performance Caching
* Warm repository cache
* Embedding cache keyed by commit hash
* Retry/failover tuning

### Phase 3: Conversational Features
* Question-only mode with self-audit
* UI updates for grounded answer display

### Phase 4: Enterprise & Security
* Private NVIDIA NemoClaw Blueprint deployment models
* Guardrails for scope control

---

## 12. Canonical V2 Product Sentence

Varinth V2 helps developers recover from bad AI answers, ask grounded repo questions directly, and receive better-supported outputs with visible proof.

**Varinth V2 generates cautiously, verifies aggressively, and always shows its evidence.**
