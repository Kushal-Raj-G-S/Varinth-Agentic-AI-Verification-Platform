Varinth – Software Requirements Specification (SRS)
1. Introduction
1.1 Purpose
This document defines the software requirements for Varinth, an MCP-native AI answer audit engine that verifies model-generated answers against configured source-of-truth artifacts such as code repositories, documentation, and configuration files. A software requirements specification is meant to describe the intended purpose, features, functionality, interfaces, constraints, and quality attributes of the system in enough detail that it can be built, tested, and validated against the stated requirements.

The purpose of Varinth is to let a user take an AI-generated answer about a software system and audit that answer claim-by-claim against bounded project artifacts, returning evidence-backed verdicts. The system is intended for developer workflows inside MCP-capable clients such as Claude Desktop and Cursor, both of which support local MCP server integrations, and Claude Desktop additionally supports installable desktop extensions for one-click local MCP server installation.

1.2 Scope
Varinth is a verification layer for engineering-focused AI workflows. It accepts a user prompt and an AI-generated answer, extracts atomic claims from that answer, searches configured sources for relevant evidence, and returns structured verdicts per claim, along with evidence references and an optional global trust score.

The v1 scope is intentionally bounded:

Verification domain: software engineering and system architecture answers.

Source-of-truth: configured project repositories, docs, and config files.

Output mode: structured JSON suitable for MCP tools plus human-readable summaries via client rendering.

Integration mode: local MCP server first, with extension packaging for Claude Desktop and config-based setup for other MCP clients.

Varinth is not a general-purpose internet fact-checking engine, not a legal/compliance decision authority, and not a replacement for human review.

1.3 Definitions, acronyms, and abbreviations
AI answer: a generated response from an AI assistant such as Claude or Cursor.

Atomic claim: a single verifiable statement extracted from a larger answer.

Evidence: a code/document/config snippet or structured artifact used to support or challenge a claim.

Verdict: the classification assigned to a claim, such as supported, contradicted, or unverified.

MCP: Model Context Protocol, a standard for connecting AI systems to tools and data sources.

Source-of-truth: a bounded, configured set of artifacts that Varinth is allowed to inspect.

Client: an MCP-capable consumer such as Claude Desktop or Cursor.

Workspace: a configured project root, repository, or logical scope against which verification is run.

1.4 References
This document aligns structurally with common IEEE / ISO-style software requirements organization, which typically includes introduction, overall description, external interfaces, specific requirements, performance requirements, design constraints, and software system attributes.

1.5 Overview
The rest of this SRS is organized as follows:

Section 2 describes the system context and overall product behavior.

Section 3 defines external interface requirements.

Section 4 defines specific functional requirements.

Section 5 defines performance requirements.

Section 6 defines design constraints.

Section 7 defines non-functional quality attributes.

Section 8 defines verification and acceptance requirements.

2. Overall Description
2.1 Product perspective
Varinth is a local-first verification engine that sits between AI assistants and the engineering artifacts those assistants talk about. It is not the primary AI model and not the main chat interface. Instead, it acts as a verification subsystem invoked by clients through MCP.

At a high level:

A user asks an AI assistant about a codebase or system.

The AI assistant generates an answer.

The user invokes Varinth to audit that answer.

Varinth checks the answer against configured artifacts.

Varinth returns a claim-level audit result to the client.

Varinth is therefore a post-answer verification layer, not a general conversational assistant.

2.2 Product functions
At a high level, Varinth provides the following product functions:

Accept an AI question-answer pair for audit.

Extract atomic claims from the answer.

Retrieve evidence from configured project sources.

Evaluate claim-evidence alignment.

Assign a verdict to each claim.

Return structured JSON output through an MCP tool.

Log audit runs for debugging and traceability.

Optionally produce lightweight explanation text summarizing why a claim received a specific verdict.

2.3 User classes and characteristics
The primary expected user classes are:

Solo developers / advanced builders: technically strong, comfortable configuring local tools, likely to use Claude Desktop, Cursor, and similar systems heavily.

Product engineers / startup teams: need fast verification without heavy enterprise overhead.

Infra-minded developers: comfortable with MCP concepts, local servers, repos, configs, and toolchain integrations.

These users are assumed to be technically literate. They do not need simplified abstractions at the cost of capability, but they do need the system to behave predictably.

2.4 Operating environment
Varinth v1 is expected to run in a local or developer-hosted environment with:

Python runtime for backend execution.

Access to local file systems or mounted repositories.

MCP-compatible client environment.

Optional model access for claim extraction and reasoning.

Optional graph database or structured storage backend.

Expected client environments include:

Claude Desktop with local MCP server support.

Claude Desktop packaged desktop extensions.

Cursor with MCP configuration and project-aware workflows.

2.5 Design and implementation constraints
Key constraints include:

Must expose a standards-aligned MCP tool interface.

Must operate against explicitly configured sources only.

Must not mark a claim as supported without evidence.

Must remain bounded enough for local developer workflows.

Must support deterministic or near-deterministic audit behavior given the same inputs and unchanged source artifacts.

Must avoid hidden internet-wide retrieval in v1.

2.6 Assumptions and dependencies
Varinth assumes:

The invoking client can provide the AI answer text.

Configured source-of-truth artifacts are readable by the Varinth runtime.

The system has access to required local paths, repo roots, or mounted content.

MCP clients are correctly configured and authorized to invoke local tools.

Optional model or guardrails dependencies are available if advanced reasoning is enabled.

3. External Interface Requirements
IEEE-style SRS documents typically separate external interfaces into user, software, hardware, and communication interfaces, so the same structure is used here in a practical way.

3.1 User interfaces
Varinth v1 does not require a rich standalone user interface. Its primary user interface is mediated through external clients.

3.1.1 MCP client interface
The main user-visible interface is the host client that invokes Varinth, such as Claude Desktop or Cursor. The user experience includes:

issuing a normal question to the AI assistant,

invoking Varinth through natural-language instruction or tool selection,

viewing structured audit results inside the same client.

3.1.2 Optional local inspection UI
An optional lightweight local inspection interface may be provided for development and debugging. If implemented, it shall support:

input of question and answer text,

selection of source scope,

display of extracted claims,

display of evidence and verdicts,

view of audit history or logs.

This interface is optional and not a v1 dependency.

3.2 Hardware interfaces
Varinth has no specialized hardware interface requirements. It is expected to run on commodity development hardware, including standard laptops, desktops, or cloud VMs.

3.3 Software interfaces
Varinth shall interface with the following software layers:

MCP client runtimes.

Local file system and repository content.

Optional LLM provider or model runtime for claim extraction and reasoning.

Optional graph store or database for structured claim/evidence/audit persistence.

Optional guardrails framework such as NVIDIA NeMo Guardrails for constrained reasoning policies.

3.4 Communication interfaces
Varinth shall support one or both of the following communication modes:

stdio transport for local MCP execution.

HTTP transport for environments that require networked invocation.

The transport layer must preserve structured request/response semantics suitable for MCP integration.

4. Specific Functional Requirements
Functional requirements define what the system must do. In common requirements practice, these are distinct from non-functional requirements, which define how well or under what quality constraints the system performs.

4.1 Input handling requirements
FR-1 The system shall accept a verification request containing a question string and an answer string.

FR-2 The system shall accept optional input metadata including context_id, source_scope, and request identifiers.

FR-3 The system shall validate required input fields and reject malformed requests with structured error messages.

FR-4 The system shall preserve the original answer text for audit traceability.

4.2 Claim extraction requirements
FR-5 The system shall parse the input answer into a list of atomic claims.

FR-6 The system shall classify each claim into a claim type, including but not limited to:

structural,

configuration,

behavioral guarantee,

performance claim.

FR-7 The system shall avoid duplicating semantically identical claims where practical.

FR-8 The system shall preserve the claim text in normalized form for downstream verification.

4.3 Evidence retrieval requirements
FR-9 The system shall search configured source-of-truth artifacts for evidence relevant to each extracted claim.

FR-10 The system shall support evidence retrieval from:

code repositories,

markdown or text documentation,

configuration files.

FR-11 The system shall return evidence as structured items containing:

source identifier,

location reference,

snippet or excerpt.

FR-12 The system shall respect configured source boundaries and shall not read outside approved roots.

FR-13 The system shall permit narrowing retrieval by optional source_scope.

4.4 Verdict assignment requirements
FR-14 The system shall assign one verdict per claim.

FR-15 The allowed verdict values in v1 shall be:

supported

contradicted

unverified

FR-16 The system shall not assign supported unless at least one evidence item explicitly supports the claim.

FR-17 The system shall not assign contradicted unless at least one evidence item explicitly conflicts with the claim.

FR-18 The system shall assign unverified when evidence is absent, weak, or inconclusive.

FR-19 The system shall optionally compute a confidence score per claim.

4.5 Output requirements
FR-20 The system shall return a structured JSON response.

FR-21 The JSON response shall include:

global score or trust metric,

list of claim objects,

verdict per claim,

evidence per claim,

optional confidence per claim.

FR-22 The output schema shall remain stable across clients.

FR-23 The system shall support client rendering of both machine-readable data and concise human-readable explanations.

4.6 MCP integration requirements
FR-24 The system shall expose a MCP-compatible tool named varinth_verify or equivalent configured tool identifier.

FR-25 The tool shall accept structured input compatible with MCP client invocation semantics.

FR-26 The tool shall return a structured result consumable by MCP clients such as Claude Desktop and Cursor.

4.7 Logging and traceability requirements
FR-27 The system shall log each audit run with:

timestamp,

input identifiers,

extracted claims,

verdict results,

execution status.

FR-28 The system shall support replay or inspection of prior audit runs for debugging.

FR-29 The system shall record whether any truncation, scope filtering, or processing limitations occurred during an audit run.

5. Performance Requirements
Performance requirements define measurable expectations for runtime behavior, latency, and throughput; they complement functional requirements rather than replace them.

5.1 Response latency
PR-1 For typical developer-scale audits, the system should return a result within 5 to 15 seconds under normal local conditions.

PR-2 For larger repositories or long answers, the system may exceed the target latency, but it shall remain responsive and produce either partial or complete structured output.

5.2 Throughput
PR-3 The system should support multiple independent audit runs sequentially without restart.

PR-4 The system may support limited concurrent audits if implemented with asynchronous execution, but concurrency is not a hard v1 requirement.

5.3 Scalability
PR-5 The system should handle moderately sized repositories and documentation sets typical of individual or startup projects.

PR-6 The system is not required in v1 to support enterprise-scale monorepos without additional indexing or storage strategies.

5.4 Resource usage
PR-7 The system should operate on standard developer hardware without requiring specialized compute infrastructure.

PR-8 Memory and CPU usage should remain reasonable for local tool usage and should degrade gracefully on large inputs.

6. Design Constraints
6.1 Bounded verification constraint
Varinth shall only operate on configured source-of-truth artifacts in v1. It shall not silently expand into unapproved sources.

6.2 Evidence-first constraint
Varinth shall prioritize evidence-backed verdict logic over model-only reasoning. If model-based interpretation and evidence conflict, evidence-backed rules shall dominate.

6.3 MCP compliance constraint
Varinth’s primary external interface shall remain compatible with MCP-oriented tool design and client expectations.

6.4 Local-first constraint
Varinth v1 shall be operable in local development environments without requiring a hosted control plane.

6.5 Honest uncertainty constraint
The system shall represent uncertainty explicitly using unverified rather than inventing support or contradiction.

7. Software System Attributes
SRS standards commonly treat these as software quality attributes such as reliability, security, maintainability, and usability.

7.1 Reliability
NFR-1 The system shall produce stable outputs for the same input and same unchanged source artifacts.

NFR-2 The system shall fail gracefully when configuration or source access is invalid.

7.2 Security
NFR-3 The system shall only access configured source locations.

NFR-4 Secrets, credentials, and API keys shall be handled through environment variables or secure runtime configuration.

NFR-5 Logs shall avoid exposing secrets present in configuration files where feasible.

7.3 Maintainability
NFR-6 The system shall separate claim extraction, evidence retrieval, verdict assignment, MCP transport, and logging into modular components.

NFR-7 The system shall support extension to additional source types and future verdict classes without rewriting the entire architecture.

7.4 Testability
NFR-8 Functional components shall be testable independently.

NFR-9 The system shall support deterministic fixtures for input-answer-evidence-verdict testing.

7.5 Usability
NFR-10 The output shall be understandable to a technically literate developer without needing backend internals.

NFR-11 The invocation flow shall fit naturally inside existing MCP-capable clients.

7.6 Portability
NFR-12 The system should support standard local development environments across major desktop operating systems where the target client supports local MCP execution.

8. Verification and Acceptance Requirements
Modern SRS practice often pairs requirements with verification expectations so the system can be validated systematically rather than vaguely.

8.1 Requirement verification
Each major requirement group shall be verifiable by one or more of the following:

unit tests,

integration tests,

manual acceptance tests,

fixture-based audit scenarios.

8.2 Acceptance criteria
Varinth v1 shall be considered acceptable when all of the following are true:

A MCP-capable client can invoke Varinth successfully.

Varinth can accept a question-answer pair and return structured audit JSON.

Varinth can extract at least basic atomic claims from a representative engineering answer.

Varinth can retrieve evidence from configured project sources.

Varinth never returns supported without evidence.

Varinth marks ambiguous or unsupported claims as unverified.

Audit logs are available for inspection and debugging.

8.3 Representative acceptance scenario
Given:

a configured project repository,

a valid client integration,

and an AI-generated answer about that repository,

When:

the user invokes Varinth,

Then:

Varinth shall return a structured claim audit,

each claim shall have a verdict,

and any supported or contradicted verdict shall include evidence.

9. Appendix-style implementation guidance
This section is not normative in the same way as the numbered requirements, but it helps maintain intended direction.

9.1 Recommended subsystem boundaries
Recommended internal subsystems:

Input validation layer

Claim extraction module

Evidence retrieval module

Verdict engine

MCP adapter

Logging and persistence layer

Optional guardrails/reasoning layer

9.2 Recommended persistence objects
Recommended persisted entities:

audit run

claim

evidence item

verdict result

source configuration

9.3 Versioning guidance
The SRS should be versioned as Varinth grows. Future versions may add:

broader source types,

new verdict classes,

team workflows,

hosted deployment,

domain-specific verification modes.