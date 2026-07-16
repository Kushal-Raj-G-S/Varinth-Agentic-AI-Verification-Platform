Varinth – Data Model & Persistence Design
1. Purpose of this document
This document defines the data model for Varinth. It describes:

the core entities,

their fields,

relationships between entities,

constraints and enums,

indexing strategy,

persistence recommendations,

and future extensibility paths.

The purpose of this document is to prevent schema drift and stop implementation tools from inventing inconsistent or weak persistence structures.

Varinth is not a CRUD app with generic users and posts. Its persistence exists to support a verification workflow:

an AI answer is audited,

claims are extracted,

evidence is retrieved,

verdicts are assigned,

and the whole run must remain inspectable later.

Because of that, the schema must optimize for:

traceability,

reproducibility,

auditability,

and controlled extensibility.

2. Data model design principles
2.1 Audit-run centric model
The root entity in Varinth is the AuditRun.

Everything else hangs off that:

claims belong to an audit run,

evidence is tied to claims,

verdicts are tied to claims,

warnings and execution metadata belong to the run.

This makes the system easy to debug and replay.

2.2 Evidence-first structure
Varinth’s most important relationship is not “user owns project.”
It is:

AuditRun → Claim → EvidenceItem / VerdictResult

That relationship is the actual product.

2.3 Bounded persistence
The data model should store:

what was audited,

what was extracted,

what evidence was found,

what decision was made,

and how the system got there.

It should not try to persist everything on Earth.

2.4 Local-first compatibility
The model should work in:

SQLite for local dev,

Postgres for stronger local/self-hosted setups,

and optionally Neo4j / graph extensions later if graph relationships prove genuinely useful.

2.5 Extensible but not overengineered
The v1 model should support future growth without dragging future abstractions into the first schema unnecessarily.

3. High-level entity overview
The core data entities in Varinth v1 are:

SourceContext

SourceScope

AuditRun

Claim

EvidenceItem

VerdictResult

AuditWarning

ExecutionEvent (optional but recommended)

PromptExecution (optional if LLM-assisted steps are persisted)

3.1 Core relational view
Conceptually:

text
SourceContext
  └── SourceScope

AuditRun
  ├── Claim
  │    ├── EvidenceItem
  │    └── VerdictResult
  ├── AuditWarning
  └── ExecutionEvent
This is the cleanest v1 structure.

4. Entity definitions
4.1 SourceContext
4.1.1 Purpose
Represents a configured project or workspace that Varinth is allowed to verify against.

A SourceContext is the root of allowed truth sources.

Examples:

roast-backend

baxel-platform

varinth-self

docs-only-demo

4.1.2 Fields
Field	Type	Required	Description
source_context_id	UUID / string	Yes	Unique identifier
name	string	Yes	Human-readable name
slug	string	Yes	Stable machine-friendly identifier
root_path	string	Yes	Absolute or canonical root path
description	string	No	Optional context description
is_active	boolean	Yes	Whether this context is usable
created_at	timestamp	Yes	Creation time
updated_at	timestamp	Yes	Last update time
4.1.3 Constraints
slug must be unique.

root_path should be unique per active context.

is_active=false means the context must not be selected for new audits.

4.2 SourceScope
4.2.1 Purpose
Represents a narrower logical or physical verification scope inside a SourceContext.

Examples:

backend

frontend

docs

infra

auth

4.2.2 Fields
Field	Type	Required	Description
source_scope_id	UUID / string	Yes	Unique identifier
source_context_id	FK	Yes	Parent context
name	string	Yes	Scope name
slug	string	Yes	Stable identifier
relative_path	string	Yes	Path relative to context root
scope_type	enum	Yes	code, doc, config, mixed
is_active	boolean	Yes	Whether scope is usable
created_at	timestamp	Yes	Creation time
updated_at	timestamp	Yes	Last update time
4.2.3 Constraints
(source_context_id, slug) must be unique.

relative_path must remain inside the associated context root.

4.2.4 Relationship
One SourceContext has many SourceScopes.

One SourceScope belongs to one SourceContext.

4.3 AuditRun
4.3.1 Purpose
Represents one full invocation of Varinth’s verification engine.

This is the top-level operational record and should be treated as the root entity for all audit artifacts.

4.3.2 Fields
Field	Type	Required	Description
audit_run_id	UUID / string	Yes	Unique identifier
source_context_id	FK	No	Chosen context
source_scope_id	FK	No	Optional narrowed scope
question	text	Yes	Original user question
answer	text	Yes	AI-generated answer being audited
answer_id	string	No	Optional client-side answer identifier
requested_max_claims	integer	No	Claim processing limit
global_score	decimal	No	Aggregate trust score
status	enum	Yes	pending, running, completed, failed, partial
started_at	timestamp	Yes	Start time
completed_at	timestamp	No	End time
duration_ms	integer	No	Execution duration
client_name	string	No	e.g. Claude Desktop, Cursor
transport_type	enum	No	stdio, http, sse, other
metadata_json	json/jsonb	No	Extensible request metadata
4.3.3 Constraints
question and answer cannot be empty.

global_score if present should be between 0 and 1.

status must be one of the allowed enum values.

4.3.4 Relationship
One AuditRun has many Claims.

One AuditRun has many AuditWarnings.

One AuditRun may have many ExecutionEvents.

One AuditRun belongs to zero or one SourceContext.

One AuditRun belongs to zero or one SourceScope.

4.4 Claim
4.4.1 Purpose
Represents one atomic, auditable statement extracted from the AI-generated answer.

This is the central semantic unit of the system.

4.4.2 Fields
Field	Type	Required	Description
claim_id	UUID / string	Yes	Unique identifier
audit_run_id	FK	Yes	Parent audit run
claim_index	integer	Yes	Order of claim within the run
raw_text	text	Yes	Original extracted claim text
normalized_text	text	Yes	Canonicalized form for comparison
claim_type	enum	Yes	structural, config, guarantee, performance, other
importance	enum	No	low, medium, high, critical
extraction_confidence	decimal	No	Confidence from extraction step
is_duplicate	boolean	Yes	Whether claim was marked duplicate
duplicate_of_claim_id	FK	No	Optional link to canonical claim
created_at	timestamp	Yes	Creation time
4.4.3 Constraints
(audit_run_id, claim_index) must be unique.

claim_type must be in enum.

extraction_confidence if present should be between 0 and 1.

4.4.4 Relationship
One AuditRun has many Claims.

One Claim has many EvidenceItems.

One Claim has one VerdictResult in v1.

One Claim may reference another Claim as duplicate canonical target.

4.5 EvidenceItem
4.5.1 Purpose
Represents a piece of evidence retrieved for a specific claim.

Evidence is the backbone of trust in Varinth.

4.5.2 Fields
Field	Type	Required	Description
evidence_id	UUID / string	Yes	Unique identifier
claim_id	FK	Yes	Parent claim
source_context_id	FK	No	Origin context
source_scope_id	FK	No	Origin scope
source_type	enum	Yes	code, doc, config, other
source_id	string	Yes	Path or logical document identifier
location	string	Yes	Line range / section / locator
snippet	text	Yes	Evidence snippet text
snippet_hash	string	No	Hash of snippet for dedupe
retrieval_rank	integer	No	Rank among evidence candidates
relevance_score	decimal	No	Retriever confidence / relevance
supports_claim	boolean	No	Optional quick signal
contradicts_claim	boolean	No	Optional quick signal
metadata_json	json/jsonb	No	Extra retrieval metadata
created_at	timestamp	Yes	Creation time
4.5.3 Constraints
snippet should not be empty.

source_type must be valid enum.

relevance_score if present should be between 0 and 1.

supports_claim and contradicts_claim should not both be true.

4.5.4 Relationship
One Claim has many EvidenceItems.

EvidenceItems optionally reference SourceContext and SourceScope.

4.6 VerdictResult
4.6.1 Purpose
Represents the final evaluation assigned to a claim.

In v1, each claim should have exactly one verdict result.

4.6.2 Fields
Field	Type	Required	Description
verdict_result_id	UUID / string	Yes	Unique identifier
claim_id	FK	Yes	Parent claim
verdict	enum	Yes	supported, contradicted, unverified
confidence	decimal	No	Confidence score
explanation	text	No	Human-readable rationale
rule_trace	json/jsonb	No	Structured reasoning/rule metadata
evidence_count	integer	Yes	Number of evidence items used
created_at	timestamp	Yes	Creation time
4.6.3 Constraints
claim_id must be unique in v1.

verdict must be valid enum.

confidence if present should be between 0 and 1.

evidence_count must be non-negative.

4.6.4 Relationship
One Claim has one VerdictResult.

One VerdictResult belongs to one Claim.

4.7 AuditWarning
4.7.1 Purpose
Represents warnings generated during an audit run.

Warnings are important because not every degraded run is a hard failure.

4.7.2 Fields
Field	Type	Required	Description
audit_warning_id	UUID / string	Yes	Unique identifier
audit_run_id	FK	Yes	Parent audit run
warning_code	string	Yes	Machine-readable code
message	text	Yes	Human-readable warning
severity	enum	Yes	info, warning, error
created_at	timestamp	Yes	Creation time
4.7.3 Example warning codes
CLAIM_LIMIT_REACHED

SOURCE_SCOPE_NOT_FOUND

PARTIAL_RETRIEVAL_FAILURE

ANSWER_TRUNCATED

AMBIGUOUS_EVIDENCE

4.7.4 Relationship
One AuditRun has many AuditWarnings.

4.8 ExecutionEvent
4.8.1 Purpose
Represents structured execution milestones or debugging events.

This is optional, but extremely useful.

4.8.2 Fields
Field	Type	Required	Description
execution_event_id	UUID / string	Yes	Unique identifier
audit_run_id	FK	Yes	Parent audit run
event_type	string	Yes	Event category
stage	enum	Yes	input, extract, retrieve, verdict, output, persist
message	text	Yes	Event message
payload_json	json/jsonb	No	Structured diagnostics
created_at	timestamp	Yes	Event timestamp
4.8.3 Why this matters
When something goes wrong, this table saves your ass.

Instead of:

“audit failed”

you get:

“claim extraction produced 17 claims”

“retrieval returned 0 evidence items for claim_5”

“verdict fallback to unverified due to missing evidence”

4.9 PromptExecution (optional)
4.9.1 Purpose
If Varinth uses LLM-assisted extraction or explanation steps, this entity can track prompt executions.

4.9.2 Fields
Field	Type	Required	Description
prompt_execution_id	UUID / string	Yes	Unique identifier
audit_run_id	FK	Yes	Parent run
claim_id	FK	No	Related claim if applicable
prompt_role	string	Yes	claim_extractor, explainer, etc.
model_name	string	No	Model used
input_text	text	Yes	Prompt/input
output_text	text	No	Model output
status	enum	Yes	success, failed, skipped
latency_ms	integer	No	Runtime
created_at	timestamp	Yes	Timestamp
4.9.3 Use carefully
Do not persist this blindly if it contains sensitive repo-derived data.
Useful for debugging, dangerous if unmanaged.

5. Entity relationships
A data model should clearly describe relationships and cardinalities between entities.

5.1 Relationship summary
Parent	Child	Cardinality	Notes
SourceContext	SourceScope	1-to-many	Context has multiple scopes
SourceContext	AuditRun	1-to-many	Optional direct context selection
SourceScope	AuditRun	1-to-many	Optional narrowed scope
AuditRun	Claim	1-to-many	Core audit decomposition
Claim	EvidenceItem	1-to-many	Multiple evidence items per claim
Claim	VerdictResult	1-to-1	One final verdict in v1
AuditRun	AuditWarning	1-to-many	Warnings during audit
AuditRun	ExecutionEvent	1-to-many	Structured execution trace
AuditRun	PromptExecution	1-to-many	Optional LLM trace
Claim	PromptExecution	1-to-many	Optional claim-level prompt tracking
6. Enum definitions
Enums reduce garbage data and make logic predictable.

6.1 claim_type
Allowed values:

structural

config

guarantee

performance

other

6.2 verdict
Allowed values:

supported

contradicted

unverified

6.3 audit_status
Allowed values:

pending

running

completed

failed

partial

6.4 source_type
Allowed values:

code

doc

config

other

6.5 scope_type
Allowed values:

code

doc

config

mixed

6.6 warning_severity
Allowed values:

info

warning

error

6.7 importance
Allowed values:

low

medium

high

critical

7. Indexing strategy
Database design best practices emphasize meaningful keys, relationships, and indexing to improve maintainability and performance.

Varinth should add indexes where they actually support audit workflows.

7.1 Required indexes
SourceContext
unique index on slug

unique index on root_path where appropriate

SourceScope
unique index on (source_context_id, slug)

index on (source_context_id, is_active)

AuditRun
primary key index on audit_run_id

index on source_context_id

index on status

index on started_at desc

index on answer_id if often queried by client response IDs

Claim
index on audit_run_id

unique index on (audit_run_id, claim_index)

index on claim_type

optional full-text index on normalized_text

EvidenceItem
index on claim_id

index on source_id

index on (claim_id, retrieval_rank)

optional index on snippet_hash

VerdictResult
unique index on claim_id

index on verdict

AuditWarning
index on audit_run_id

index on warning_code

ExecutionEvent
index on audit_run_id

index on (audit_run_id, stage)

8. JSON fields and why they exist
The model includes a few json/jsonb fields. These should be used strategically, not lazily.

8.1 Appropriate JSON usage
Use JSON fields for:

structured request metadata,

retrieval metadata,

rule traces,

diagnostic payloads,

future extensibility where schema stability is not yet known.

8.2 Inappropriate JSON usage
Do not dump core business structure into JSON just because it’s easy.

Bad:

storing all claims as one JSON blob in AuditRun

storing verdicts inline without separate rows

storing evidence arrays in one field instead of normalized entities

That kills queryability and traceability.

9. Recommended persistence strategy by phase
9.1 v1 local mode
Use:

SQLite for rapid local development, or

Postgres if you want cleaner migrations and stronger long-term structure.

Recommended default if serious: Postgres.

Why:

better JSON support,

better indexing,

easier future scaling,

better compatibility with complex querying.

9.2 v1.1 / v2 optional graph enrichment
If graph relationships become useful, add:

ClaimEntity

KnowledgeNode

KnowledgeEdge

But only after proving a real need.

Do not add a knowledge graph just because it sounds advanced.
Use it if it materially improves retrieval or contradiction reasoning.

10. Sample relational schema mapping
Below is the conceptual SQL-style shape.

10.1 Core table set
source_contexts

source_scopes

audit_runs

claims

evidence_items

verdict_results

audit_warnings

execution_events

That is enough for a solid v1.

11. Retention and cleanup rules
Varinth is an audit system, so data retention should be deliberate.

11.1 Keep by default
Keep:

audit metadata,

claim text,

verdicts,

evidence references,

warnings,

execution traces.

11.2 Be careful with
Be careful with:

full prompt logs,

full raw answer history if sensitive,

full evidence snippets from private repos if long-term storage is risky.

11.3 Suggested cleanup strategy
Allow future policy options such as:

delete raw prompt/explanation payloads after N days,

keep verdict summaries permanently,

redact secrets from stored snippets,

keep only snippet hashes in high-security mode.

12. Future extensions
The model should support future evolution without forcing it now.

12.1 Possible future entities
User

Team

SavedReport

KnowledgeNode

KnowledgeEdge

BenchmarkCase

EvaluationRun

ClientInstallation

12.2 Why they are excluded now
Because v1 is not:

a SaaS team platform,

a hosted benchmark lab,

or a graph visualization suite.

Keep the schema tight until the wedge is proven.

13. Final data-model rule
If a schema decision makes it harder to answer these questions quickly, it is the wrong schema:

What answer was audited?

What claims were extracted?

What evidence was found for each claim?

What verdict was assigned?

Why was that verdict assigned?

What went wrong if the audit failed?

That is the actual purpose of Varinth persistence.