Varinth – System Architecture & Design
1. Purpose of this document
This document describes the proposed architecture of Varinth, including the major subsystems, their responsibilities, system data flow, persistent storage model, access boundaries, and operational behavior. In standard system design practice, the architecture document is where the “10,000-foot view” of the system becomes concrete enough that developers can decompose the build into subsystems and interfaces.

Varinth is designed as a local-first, MCP-native verification engine that sits between AI assistants and bounded project artifacts. The system is not intended to replace the AI model; it is intended to audit model output against project truth sources and return structured, evidence-backed verdicts. MCP itself is built around clients, servers, tools, resources, and transports, which maps cleanly to Varinth’s role as a local verification server consumed by AI clients.

2. Design goals
The architecture is driven by the following goals:

2.1 Evidence-first verification
The architecture must ensure that verdicts are grounded primarily in retrieved evidence rather than pure model intuition. This is the single most important design rule.

2.2 Local-first deployment
Varinth v1 must run locally or in a simple self-hosted environment without depending on a central hosted control plane. This keeps the product aligned with developer workflows and with local MCP usage in tools like Claude Desktop.

2.3 MCP-native interoperability
Varinth must behave like a proper MCP tool provider rather than a proprietary plugin-only system. The core engine should be exposed through an MCP server layer so multiple clients can use the same verification engine.

2.4 Bounded source-of-truth access
The system must only read configured and approved sources. It must not silently roam outside allowed roots.

2.5 Honest uncertainty
The architecture must make it easy to label a claim as unverified when the evidence is weak or ambiguous. A good verification engine must be comfortable saying “I can’t prove this.”

2.6 Composable internal design
Each core responsibility should be separable:

claim extraction,

evidence retrieval,

verdict assignment,

guardrails,

transport/integration,

and logging.

This allows you to swap components later without rewriting the whole system.

3. High-level system overview
At a high level, Varinth consists of six major layers:

Client layer

Claude Desktop, Cursor, Claude Code, or future MCP clients.

MCP adapter layer

Exposes Varinth as one or more MCP tools such as varinth_verify.

Verification orchestration layer

Coordinates claim extraction, retrieval, verdict evaluation, guardrails, and formatting.

Verification services layer

Claim extractor

Evidence retriever

Verdict engine

Explanation synthesizer

Data and source layer

Local repos

Documentation

Config files

Optional graph store / metadata DB

Observability and persistence layer

Audit logs

Structured run history

Errors and diagnostics

3.1 Architectural principle
The AI client provides the answer to inspect. Varinth does not generate the original answer. Varinth performs a second-pass audit over that answer using bounded evidence retrieval and deterministic verdict logic.

That distinction matters because it keeps the product identity clear:

AI assistant = generator

Varinth = verifier

4. Top-level subsystem decomposition
A well-formed architecture doc should name the top-level subsystems and describe the responsibilities of each. Varinth is divided into the following major subsystems.

4.1 MCP Adapter Subsystem
Responsibility:
Expose Varinth’s capabilities to MCP-capable clients.

Core duties:

define tool contracts such as varinth_verify,

validate MCP request format,

route valid requests into the orchestration layer,

return structured results to the invoking client.

Why it exists:
This subsystem isolates protocol-facing concerns from the verification logic. If you later support another transport or packaging surface, you won’t need to rewrite the engine.

4.2 Request Orchestration Subsystem
Responsibility:
Manage the full lifecycle of a verification request from input normalization to final response assembly.

Core duties:

normalize request input,

call the claim extractor,

dispatch retrieval tasks,

invoke verdict assignment,

optionally call explanation synthesis,

attach metadata and audit logs,

return final structured response.

Why it exists:
This is the central control plane of the engine. It keeps the system coherent and enforces the order of operations.

4.3 Claim Extraction Subsystem
Responsibility:
Turn a natural-language answer into atomic claims that can be verified.

Core duties:

parse answer text,

detect verifiable propositions,

normalize overlapping or duplicate claims,

assign preliminary claim types.

Why it exists:
Verification is impossible if the answer remains one large blob. Claims are the unit of audit.

4.4 Evidence Retrieval Subsystem
Responsibility:
Find relevant project artifacts that support or challenge each claim.

Core duties:

search configured code/document/config sources,

rank candidate evidence items,

extract useful snippets and references,

return evidence bundles to the verdict layer.

Why it exists:
This is the real grounding engine. Without retrieval, Varinth becomes just another LLM opinionator.

4.5 Verdict Engine Subsystem
Responsibility:
Assign the final claim verdict using explicit rules and evidence.

Core duties:

evaluate evidence strength,

determine support, contradiction, or uncertainty,

compute confidence score if enabled,

enforce evidence-backed constraints.

Why it exists:
This subsystem is where “truth discipline” lives. It should be more rule-driven than stylistic.

4.6 Guardrails & Policy Subsystem
Responsibility:
Apply policy constraints and runtime checks around model-assisted components.

Core duties:

validate model-assisted steps,

block unsafe or malformed reasoning outputs,

enforce policy such as “no supported verdict without evidence,”

optionally use input, execution, and output rail concepts inspired by NeMo Guardrails.

Why it exists:
Guardrails belong around the reasoning parts of the system, especially if any agentic or LLM-assisted layer participates in extraction or explanation. NeMo Guardrails architecture explicitly treats guardrails as an intermediate layer between the application and models/tools, which is the same pattern Varinth should borrow.

4.7 Persistence & Audit Subsystem
Responsibility:
Persist structured run data for debugging, replay, evaluation, and future benchmarking.

Core duties:

store audit run metadata,

store extracted claims,

store evidence references,

store verdict results,

store errors and warnings.

Why it exists:
A verification system with no traceability is just vibes with JSON.

4.8 Source Access Subsystem
Responsibility:
Abstract access to configured project artifacts.

Core duties:

resolve allowed roots,

read files safely,

provide repo/document/config access adapters,

reject unauthorized paths.

Why it exists:
It prevents business logic from directly touching the file system in unsafe ways.

5. High-level request flow
The global software control section of a design doc should describe how requests are initiated, how subsystems synchronize, and how the system behaves across the lifecycle of a request. That lifecycle for Varinth is below.

5.1 Request initiation
The client invokes varinth_verify.

The MCP adapter validates the input schema.

A request context is created with:

request ID,

timestamp,

workspace/context identifiers,

source scope,

raw question,

raw answer.

5.2 Claim extraction phase
The request orchestration subsystem passes the answer to the claim extraction subsystem.

The claim extraction subsystem returns a list of normalized atomic claims.

5.3 Evidence retrieval phase
For each claim, the orchestration subsystem submits a retrieval task.

The evidence retrieval subsystem searches bounded sources and returns ranked evidence candidates.

5.4 Verdict phase
The verdict engine evaluates each claim with its evidence bundle.

Each claim receives:

verdict,

optional confidence,

explanation metadata,

evidence list.

5.5 Policy and guardrail phase
Guardrail rules validate that:

no claim is marked supported without evidence,

no forbidden outputs are emitted,

ambiguous cases fall back to unverified.

5.6 Response assembly phase
The orchestration subsystem computes global metadata such as:

global trust score,

claim counts by verdict,

warnings,

truncation flags if any.

The MCP adapter returns the final JSON to the client.

5.7 Persistence phase
The persistence subsystem stores the request, outputs, and logs for replay and evaluation.

6. Proposed data flow
The data flow through Varinth can be represented conceptually as:

text
Client
  -> MCP Adapter
  -> Request Orchestrator
  -> Claim Extractor
  -> Evidence Retriever
  -> Verdict Engine
  -> Guardrails/Policy Check
  -> Response Assembler
  -> MCP Adapter
  -> Client
In parallel, audit artifacts flow into persistence:

text
Request Context
Claims
Evidence Bundles
Verdicts
Warnings / Errors
Execution Metrics
  -> Persistence & Audit Store
This separation is intentional:

live response path = what user sees,

audit path = what developer/debugger sees later.

7. Software / hardware mapping
A design document normally describes how subsystems map to runtime nodes or components.

7.1 Single-node local deployment (primary v1 target)
For v1, all major Varinth subsystems can run in a single process or single local deployment unit:

MCP adapter

orchestration

claim extraction

retrieval

verdict engine

logs

local persistence

This is the preferred default for:

Claude Desktop local MCP usage,

Cursor local setup,

solo developer usage.

7.2 Optional split deployment (future)
Later, the architecture can split into:

client-facing MCP server,

verification worker service,

separate persistence/indexing service,

hosted graph or vector layer.

This is not required for v1.

7.3 Hardware assumptions
Varinth is expected to run on standard development hardware. If model-assisted extraction is heavy, that can rely on external model APIs or local models, but the verification engine itself should not require specialized hardware.

8. Persistent data management
A good SDD should describe what persistent data exists, how it is stored, and why that storage model was chosen.

8.1 Persistence goals
Varinth persistence exists for five reasons:

audit traceability,

debugging,

replay and reproducibility,

benchmark evaluation,

future knowledge graph / memory enrichment.

8.2 Core persisted entities
Recommended persisted objects:

8.2.1 AuditRun
Represents one invocation of Varinth.

Fields:

audit_run_id

timestamp

question

answer

context_id

source_scope

global_score

execution_status

duration_ms

8.2.2 Claim
Represents one extracted atomic claim.

Fields:

claim_id

audit_run_id

claim_text

claim_type

normalized_text

claim_index

8.2.3 EvidenceItem
Represents one evidence snippet tied to a claim.

Fields:

evidence_id

claim_id

source_id

source_type

location

snippet

relevance_score

8.2.4 VerdictResult
Represents the evaluated result of a claim.

Fields:

verdict_id

claim_id

verdict

confidence

explanation

rule_trace

8.2.5 SourceConfig
Represents a configured project root or logical source scope.

Fields:

source_config_id

context_id

root_path

source_type

allow_patterns

deny_patterns

active_status

8.3 Storage options
Option A: PostgreSQL / SQLite first
Best for v1 if you want simplicity.

Pros:

easy to query,

easy to debug,

easy to run locally,

enough for audit logs and structured entities.

Option B: PostgreSQL + graph extension / Neo4j later
Best if you want to model claim-evidence-entity relationships more richly.

Use only when:

the graph actually helps retrieval or reasoning,

not just because “knowledge graph” sounds cool.

Your earlier instinct about KGs is good, but don’t force the graph into v1 unless it directly improves verification quality.

9. Access control and security
The system design document should explicitly describe access control and security issues, including authentication, key handling, and access boundaries.

9.1 Security boundary principle
Varinth must obey strict bounded read access.

It must only read from:

explicitly configured project roots,

explicitly allowed documentation folders,

explicitly declared config locations.

It must not:

crawl arbitrary directories,

inspect unrelated files,

or leak sensitive repo contents outside the response/logging policy.

9.2 Secret handling
Secrets such as:

model API keys,

repo access tokens,

external provider credentials,

must be supplied through environment variables or secure local configuration, not hardcoded files.

9.3 Log hygiene
Logs must avoid dumping:

secrets,

full tokens,

raw secret-bearing env content.

Where possible, logs should store references and hashes rather than entire sensitive payloads.

9.4 Client trust model
The client is trusted to invoke the tool, but not trusted to expand source access on the fly unless configuration allows it.

10. Guardrails architecture
NeMo Guardrails places a guardrail layer between the application and the models/tools it uses, with separate input, retrieval, execution, and output rails. Varinth should adopt the same mental model.

10.1 Input rails
Applied before claim extraction or reasoning:

validate request format,

reject empty or malformed input,

enforce scope configuration.

10.2 Retrieval rails
Applied during evidence retrieval:

restrict access to allowed sources,

filter unsafe or irrelevant retrieval candidates,

prevent unsupported source expansion.

10.3 Execution rails
Applied during tool-assisted or model-assisted steps:

validate claim extraction outputs,

constrain explanation synthesis,

prevent unsupported verdict escalation.

10.4 Output rails
Applied before returning results:

ensure supported verdicts have evidence,

ensure contradicted verdicts have contradictory evidence,

ensure ambiguous cases degrade to unverified,

prevent unsafe or misleading phrasing.

This is one of the strongest architecture moves you can make because it makes Varinth feel production-minded instead of “student project with agents.”

11. Concurrency and synchronization
11.1 v1 expectation
Varinth v1 can process one request at a time or a small number of concurrent requests. Full high-throughput concurrency is not required on day one.

11.2 Internal parallelism
A useful controlled form of concurrency is:

extracting all claims first,

then retrieving evidence for multiple claims asynchronously,

then evaluating verdicts once all evidence bundles are available.

This gives speedup without making the system untraceable.

11.3 Synchronization rule
Verdict assignment must only occur after evidence retrieval for that claim has completed or timed out. No verdict should be assigned on half-fetched evidence unless explicitly marked partial.

12. Boundary conditions
A solid architecture doc should define startup, shutdown, and error behavior.

12.1 Startup behavior
On startup, Varinth should:

load configuration,

validate source roots,

initialize persistence layer,

initialize optional model/guardrails dependencies,

register MCP tools,

emit a ready state.

12.2 Shutdown behavior
On shutdown, Varinth should:

flush logs,

close DB or file handles,

stop MCP server cleanly,

preserve incomplete request state if possible.

12.3 Error behavior
Varinth should return structured errors for:

invalid input,

unconfigured source scope,

inaccessible files,

internal processing failure,

model/guardrails dependency failure.

When a failure affects only part of the request, the system should degrade gracefully rather than crash completely.

13. Subsystem interface summary
Below is the practical internal API view.

Subsystem	Input	Output	Responsibility
MCP Adapter	MCP tool call	normalized request / final response	Protocol integration
Request Orchestrator	normalized request	assembled audit response	Workflow control
Claim Extractor	answer text	claim list	atomic claim generation
Evidence Retriever	claim + scope	evidence bundle	grounding retrieval
Verdict Engine	claim + evidence	verdict result	support/contradiction logic
Guardrails Layer	intermediate/final artifacts	validated artifacts	policy enforcement
Persistence Layer	request/results/logs	stored entities	traceability and replay
This table is useful because it makes the implementation boundaries obvious.

14. Recommended implementation order
Architecture is useless if it doesn’t translate into execution. Build order should be:

MCP adapter with one tool.

Input validation + request orchestrator.

Source access subsystem.

Simple claim extractor.

Simple evidence retriever.

Basic verdict engine.

Persistence and logs.

Guardrails integration.

Optional explanation synthesis and UI.

Do not start with multi-agent theatrics. Start with the retrieval/verdict spine.

15. Final architecture rule
Varinth should always feel like a serious verification engine, not a flashy agent demo.

That means the architecture must optimize for:

traceability,

bounded access,

deterministic outputs,

and evidence-backed reasoning.

If any subsystem makes the system look smarter while making it less auditable, it is the wrong subsystem.