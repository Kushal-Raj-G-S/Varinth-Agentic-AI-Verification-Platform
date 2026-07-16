# Varinth – Phase 2 Blueprint

## 1. Purpose of this document

This document defines **Phase 2** of Varinth.

Phase 1 established the execution core: claim extraction, retrieval, deterministic verdicting, MCP integration, REST APIs, database logging, rate limiting, and the initial dashboard/application scaffolding. Phase 2 begins only after that foundation is stable and operational.

Phase 2 is not about polishing the same engine again. It is about building the layers that make Varinth a differentiated **product**, not merely a verification tool.

The goal of Phase 2 is to add the architectural capabilities that were intentionally missing from Phase 1:

- multi-agent verification,
- knowledge graph grounding,
- agentic memory,
- programmable guardrails,
- product-level orchestration,
- and stronger user-facing workflows.

These are the features that move Varinth from “works” to “matters.”

***

## 2. What Phase 1 already completed

Phase 1 already delivered the verification substrate.

That includes:

- claim extraction,
- hybrid retrieval,
- deterministic verdict assignment,
- MCP tools and resources,
- REST audit APIs,
- database-backed audit logging,
- security and rate-limiting controls,
- baseline tests,
- and frontend scaffolding.

This means Phase 2 should **not** rebuild the core engine from scratch. It should extend the engine into a more intelligent, stateful, and defensible product.

***

## 3. Mission of Phase 2

The mission of Phase 2 is:

> Transform Varinth from a single-pass verification engine into a multi-layer AI verification platform with memory, graph reasoning, programmable guardrails, and product-grade control surfaces.

The strategic outcome is a system that can:

- verify answers more intelligently,
- remember prior audits and recurring entities,
- reason across evidence relationships instead of isolated snippets,
- enforce trust policies before and after model execution,
- and provide a product experience worthy of a finished platform.

***

## 4. Core outcomes for Phase 2

Phase 2 must produce five major outcomes.

### 4.1 Multi-agent verification

Replace or augment the current single-pass verification flow with a role-based agent system.

Minimum agent roles should include:

- **Claim Agent** – refines and normalizes extracted claims,
- **Evidence Agent** – retrieves and assembles candidate evidence,
- **Critic Agent** – attempts to challenge weak or unsupported claims,
- **Verifier Agent** – checks evidence alignment and claim grounding,
- **Judge Agent** – issues final verdicts and confidence explanations.

This is the layer that makes the system meaningfully harder and more defensible.

### 4.2 Knowledge graph layer

Introduce a graph-backed representation of:

- entities,
- documents,
- code objects,
- claims,
- evidence items,
- verdict histories,
- and source relationships.

Graph-based retrieval and reasoning are useful because they preserve structural relationships instead of treating every chunk as an isolated vector item, and current research is actively exploring memory-based multi-agent graph systems for better retrieval and consistency.[1]

### 4.3 Agentic memory

Add memory beyond the current run so the system can retain useful context across audits.

Memory should be split into at least:

- **short-term execution memory** for active runs,
- **episodic memory** for prior audits and outcomes,
- **semantic memory** for recurring concepts, entities, and relationships,
- and optionally **policy memory** for organization-specific trust rules.

This allows the system to stop behaving like every request starts from zero.

### 4.4 Guardrails and policy engine

Add a programmable guardrails layer using **NVIDIA NeMo Guardrails** concepts or implementation patterns. NVIDIA documents NeMo Guardrails as a programmable system that intercepts inputs and outputs, applies configurable checks and policies, and can serve as a central hub between an app and underlying LLMs.[2][3][4]

The guardrail layer should govern:

- prompt injection resistance,
- unsafe or restricted content classes,
- scope restrictions,
- tool-call policies,
- and output acceptance rules.

### 4.5 Product-grade orchestration

Phase 2 should add workflow orchestration for:

- project-level settings,
- model/provider routing,
- trust policy configuration,
- replayable audit runs,
- benchmark execution,
- and richer dashboard experiences.

This is what turns internal capability into a user-usable product.

***

## 5. Phase 2 workstreams

Phase 2 should be executed through six parallel workstreams.

## 5.1 Workstream A – Multi-agent architecture

### Objective

Design and implement the verification swarm.

### What must be built

- agent-role definitions,
- orchestration flow between agents,
- structured handoff schemas,
- retry and failure handling,
- and final arbitration logic.

### Deliverables

- `agent_orchestrator.py`
- role-specific agent modules
- inter-agent message schema
- arbitration and scoring rules
- agent execution traces stored in DB

### Success condition

One audit run should be decomposable into transparent agent stages rather than a single opaque execution path.

***

## 5.2 Workstream B – Knowledge graph foundation

### Objective

Build the knowledge graph layer that stores and reuses relationships across claims, evidence, sources, and prior audits.

### What must be built

- graph schema,
- entity extraction and normalization pipeline,
- edge creation rules,
- graph update workflow after each audit,
- and retrieval hooks that query graph relationships alongside existing retrieval.

### Minimum graph node types

- `Project`
- `AuditRun`
- `Claim`
- `Evidence`
- `Document`
- `SourceFile`
- `Entity`
- `Verdict`

### Minimum edge types

- `MENTIONS`
- `SUPPORTS`
- `CONTRADICTS`
- `DERIVED_FROM`
- `REFERS_TO`
- `BELONGS_TO`
- `PREVIOUSLY_VERIFIED_AS`

### Deliverables

- graph schema document
- graph ingestion/update module
- graph query adapter
- graph-backed evidence augmentation pipeline

### Success condition

The system should be able to answer not just “what evidence was found now?” but also “how does this claim relate to prior evidence, entities, and earlier verdicts?”

***

## 5.3 Workstream C – Memory architecture

### Objective

Implement persistent agentic memory across runs.

### What must be built

- run-scoped memory store,
- audit-history memory indexing,
- semantic concept memory,
- memory lookup APIs,
- and memory write-back rules after each completed audit.

### Memory design guidance

Use memory to improve:

- claim disambiguation,
- repeated source evaluation,
- entity continuity,
- and project-specific context retention.

Do **not** let memory become unbounded noise. Every memory type should have:

- retention rules,
- confidence or freshness logic,
- and query boundaries.

### Deliverables

- memory schema
- memory manager service
- memory retrieval hooks inside verification flow
- memory write policies

### Success condition

A future audit should be able to reuse relevant historical context without blindly copying old conclusions.

***

## 5.4 Workstream D – Guardrails and policy control

### Objective

Add programmable policy enforcement before, during, and after model-assisted verification.

### Why this matters

NeMo Guardrails supports configurable checks on user input and model output, and NVIDIA documents it as a policy and safety layer that can sit between applications and LLMs.[2][3][5]

### What must be built

- input guardrails,
- output guardrails,
- tool-use policy checks,
- restricted-scope enforcement,
- prompt-injection detection,
- configurable block/warn/allow actions,
- and policy configuration management.

### Deliverables

- `guardrails_service.py` or adapter layer
- policy configuration schema
- guardrail evaluation hooks
- violation logging and UI surfacing

### Success condition

Every audit request should pass through a configurable policy layer rather than trusting raw inputs and raw outputs blindly.

***

## 5.5 Workstream E – Product workflows and UX

### Objective

Turn the engine and orchestration layers into a proper product workflow.

### What must be built

- project/workspace setup screens,
- source registration flows,
- model/provider settings,
- trust-policy configuration UI,
- audit replay and comparison views,
- richer evidence exploration,
- and graph/memory visibility where useful.

### Frontend emphasis

The UI should stop being just a scaffold and become a serious product layer.

That means:

- clear audit lifecycle states,
- usable evidence panels,
- verdict explainability surfaces,
- settings that map to real backend capabilities,
- and eventually graph- and memory-aware inspection surfaces.

### Deliverables

- upgraded Next.js product flows
- settings pages for policies/providers/projects
- audit replay UI
- evidence detail UI
- graph or memory inspection UI where appropriate

### Success condition

A user should be able to operate Varinth as a product, not just watch raw audit JSON.

***

## 5.6 Workstream F – Evaluation and benchmarking

### Objective

Prove that Phase 2 actually improves the system.

### What must be built

- benchmark datasets,
- repeatable evaluation runs,
- comparison baselines between Phase 1 and Phase 2,
- quality metrics,
- latency metrics,
- and regression tracking.

### Example metrics

- supported/contradicted/unverified accuracy,
- claim extraction quality,
- evidence relevance quality,
- false-support reduction,
- hallucination acceptance rate,
- latency overhead introduced by multi-agent flow,
- and policy-block precision.

### Deliverables

- benchmark harness
- test corpora
- comparison dashboards or reports
- acceptance thresholds for release

### Success condition

Phase 2 should not just be more complex. It must be measurably better.

***

## 6. Recommended build order inside Phase 2

Do not attack all six workstreams randomly. The recommended sequence is:

1. **Multi-agent architecture**
2. **Guardrails integration**
3. **Memory architecture**
4. **Knowledge graph integration**
5. **Product workflow expansion**
6. **Benchmarking and hardening**

### Why this order

- Agents define the new execution shape.
- Guardrails protect that execution shape.
- Memory stabilizes behavior across runs.
- Knowledge graph deepens context and relationships.
- UI/product work should reflect actual capabilities, not fake them ahead of time.
- Evaluation validates the whole stack.

***

## 7. Phase 2 deliverable set

By the end of Phase 2, Varinth should have the following major deliverables.

### Backend deliverables

- multi-agent orchestrator
- agent role modules
- memory manager
- graph ingestion and query layer
- guardrails adapter/service
- richer audit state machine
- benchmark and evaluation framework

### Data deliverables

- graph schema
- memory schema
- policy schema
- migration updates for new tables/entities
- new audit trace/event structures

### Frontend deliverables

- project/workspace flows
- trust policy screens
- provider/model configuration screens
- richer audit replay and comparison views
- graph/memory-aware explainability UI

### Ops deliverables

- provider configuration management
- background processing strategy if needed
- observability for agent stages and policy violations
- staged rollout plan for Phase 2 features

***

## 8. Phase 2 completion criteria

Phase 2 is complete only if all of the following are true.

### 8.1 Capability criteria

- Multi-agent verification is running in production code.
- Guardrails are active on relevant input/output/model flows.
- Memory persists and influences later audits in a controlled way.
- Knowledge graph entities and relations are stored and used in retrieval or reasoning.
- Product UI exposes these capabilities meaningfully.

### 8.2 Quality criteria

- Phase 2 outperforms Phase 1 on agreed benchmark metrics.
- Policy failures and unsafe flows are visible and logged.
- Users can inspect why a verdict was produced.
- System latency remains acceptable for product usage.

### 8.3 Product criteria

- The application feels like a full platform, not a stitched-together toolchain.
- MCP remains an integration surface, not the whole identity of the product.
- The new capabilities are visible in both architecture and user experience.

***

## 9. What not to do in Phase 2

Phase 2 is large enough already. Avoid these traps:

- rewriting the entire Phase 1 core without reason,
- adding random AI agents with no role clarity,
- building a graph with no product use,
- storing memory with no retrieval strategy,
- adding guardrails only for buzzword value,
- overbuilding infra before the feature logic works,
- and inflating the UI ahead of backend reality.

Every new Phase 2 component must answer one question:

> Does this make Varinth more trustworthy, more stateful, more explainable, or more product-worthy?

If not, it is noise.

***

## 10. Final Phase 2 directive

Phase 1 proved that Varinth can execute a verification workflow.

Phase 2 must prove that Varinth deserves to exist as a serious AI verification product.

That means building the missing layers with discipline:

- agents for structured verification,
- memory for continuity,
- graph reasoning for relational grounding,
- guardrails for policy control,
- and product workflows that make the whole system usable.

That is the real next step.