Varinth – Architecture Decision Records (ADR Log)
1. Purpose of this document
This document records the architecturally significant decisions behind Varinth.

It exists to preserve:

the context behind major design choices,

the actual choices made,

the alternatives considered,

and the consequences of those choices.

An ADR should record important software architecture decisions and make the reasoning durable over time, especially for decisions that are difficult to reverse or strongly affect the system’s shape and quality attributes.

This file is intentionally not a general architecture guide.
It is a decision log.

If a future implementation changes one of these decisions, the correct move is not to silently rewrite history. The correct move is to create a new ADR that supersedes the earlier one.

2. ADR format used
Each ADR in this document follows a lightweight structure:

Title

Status

Context

Decision

Alternatives considered

Consequences

This matches the standard idea that ADRs should document the context, decision, and consequences of significant architectural choices, optionally including alternatives and tradeoffs.

ADR-001: Varinth is MCP-first, not dashboard-first
Status: Accepted

Context
Varinth is intended to live inside real AI-driven engineering workflows. The target users already spend their time inside clients such as Claude Desktop and Cursor, where MCP-style tool invocation fits naturally into existing prompting and code understanding loops.

There are two obvious product directions:

Build a standalone dashboard-first product with upload forms, project selection, audit views, and analytics.

Build an MCP-native verification engine that plugs directly into clients where the user already works.

A dashboard-first approach feels visually productized, but it creates workflow friction. It forces users to leave the place where the answer was generated just to verify it.

Decision
Varinth will be MCP-first.

The primary product surface will be a verification engine exposed as MCP-compatible tools. Any dashboard or visual UI is secondary and must not become the center of the product in v1.

Alternatives considered
Alternative A: Dashboard-first product
Pros:

Easier to demo visually.

Feels more like a traditional SaaS product.

Easier to layer charts, history, and reports.

Cons:

Breaks the user’s native AI workflow.

Encourages building UI before solving core verification quality.

Risks turning Varinth into a generic admin panel.

Alternative B: CLI-first only
Pros:

Very fast to build.

Extremely dev-focused.

Easy for local experimentation.

Cons:

Too narrow for broader MCP ecosystem usage.

Less reusable in Claude/Cursor-style workflows.

Lower perceived product value compared to MCP-native integration.

Consequences
Positive:

Varinth aligns with where target users already work.

The product wedge stays sharp and protocol-native.

Verification becomes a tool call, not a separate ceremony.

Negative:

Demo polish is harder early on without a big UI.

UX depends partly on the host client.

Integration testing becomes more important.

ADR-002: v1 uses bounded-source verification, not open-web fact checking
Status: Accepted

Context
There is a temptation to make Varinth verify “truth” on the open web. That sounds bigger and more powerful, but it is a trap.

Open-web verification introduces huge ambiguity:

source credibility ranking,

contradiction resolution across websites,

internet-scale retrieval,

domain validity problems,

and no stable source-of-truth boundary.

Varinth’s strongest use case is verifying AI-generated engineering answers against known source artifacts such as:

repository code,

documentation,

config files,

and bounded project materials.

Decision
Varinth v1 will verify claims only against bounded, configured, source-of-truth artifacts.

It will not attempt open-web fact checking as a primary capability.

Alternatives considered
Alternative A: Open-web verification
Pros:

Broader market story.

Bigger ambition.

Easier to position as a general truth engine.

Cons:

Harder retrieval problem.

High ambiguity in truth resolution.

Easier to overclaim capability.

Weakens product credibility if results are noisy.

Alternative B: Hybrid bounded + web in v1
Pros:

More flexible.

Can enrich missing repo context.

Cons:

Complicates scope immediately.

Makes evaluation harder.

Encourages weak evidence mixing.

Consequences
Positive:

Stronger trust boundary.

Clearer evaluation and testing.

Better alignment with engineering use cases.

Higher chance of reliable verdicts in v1.

Negative:

Narrower product story at first glance.

Less useful for generic public-fact verification.

Some claims may remain unverified even when web evidence exists elsewhere.

ADR-003: Verdicts are claim-level, not answer-level only
Status: Accepted

Context
A weak design would output a single answer-level confidence score like:

“This answer is 78% trustworthy.”

That is easy to display but not actually useful. AI answers often contain a mixture of:

supported claims,

partially true claims,

wrong claims,

and unverifiable claims.

A single global confidence obscures exactly what the user needs to know.

Decision
Varinth will operate at the claim level.

Each answer will be decomposed into atomic claims, and each claim will receive its own verdict and evidence trace. A global run-level score may exist, but only as a secondary summary.

Alternatives considered
Alternative A: Only answer-level scoring
Pros:

Easy to implement.

Simple UI.

Easy to explain in one number.

Cons:

Too lossy.

Hides specific failures.

Weak debugging value.

Weak trust value.

Alternative B: Mixed claim-level and answer-level
Pros:

Balanced reporting.

Can give both detail and summary.

Cons:

Slightly more complexity.

Requires care to prevent users over-trusting the summary score.

Consequences
Positive:

Better interpretability.

Better debugging.

Better audit value.

Stronger evidence alignment.

Negative:

Requires claim extraction quality.

More complex output schema.

More work for users to scan if badly presented.

ADR-004: unverified is preferred over fake certainty
Status: Accepted

Context
Verification systems often fail in a predictable way: when evidence is weak, they still try to sound helpful. That creates outputs like:

“Likely supported”

“Probably correct”

“Seems accurate”

Those labels feel smooth but are operationally dangerous. Varinth’s value depends on being willing to admit when the available evidence does not justify a confident decision.

Decision
When evidence is insufficient, ambiguous, or missing, Varinth will assign:

unverified

It will not force every claim into supported or contradicted.

Alternatives considered
Alternative A: Always force binary decision
Pros:

Simpler output.

Easier summary metrics.

Cleaner-looking UX.

Cons:

Encourages hallucinated certainty.

Damages trust.

Produces misleading verdicts in ambiguous cases.

Alternative B: Add probabilistic fuzzy labels
Pros:

More nuanced surface.

May reflect uncertainty better in theory.

Cons:

Easy to misuse.

Harder to interpret consistently.

Encourages vague language instead of disciplined evidence standards.

Consequences
Positive:

More honest system behavior.

Higher trust for supported/contradicted results.

Better fit for engineering validation workflows.

Negative:

Some users may perceive unverified as weak.

Product may appear conservative.

Requires explanation messaging so users understand why uncertainty is deliberate.

ADR-005: Evidence-backed rules outrank model vibes
Status: Accepted

Context
Varinth may use LLMs for sub-steps such as:

claim extraction,

explanation generation,

evidence summarization.

But the core product promise is verification. If verdicts are driven primarily by freeform model intuition rather than explicit evidence-backed logic, the system collapses into the same failure class as the models it is supposed to audit.

Decision
Varinth’s final verdict assignment must be evidence-backed and rule-constrained.

LLMs may assist, but they must not be treated as the final source of truth for verdict assignment without structured evidence.

Alternatives considered
Alternative A: LLM-heavy end-to-end judgment
Pros:

Fast to prototype.

Flexible on messy inputs.

Can appear smart in demos.

Cons:

Hard to trust.

Hard to reproduce.

Hard to debug.

Easy to produce polished nonsense.

Alternative B: Pure deterministic rules only
Pros:

Predictable.

Easier to test.

Easier to explain.

Cons:

Less adaptable to messy language and nuanced claims.

Harder to scale across varied phrasing.

Consequences
Positive:

Better reproducibility.

Stronger trust boundary.

Better evaluation discipline.

Easier to benchmark.

Negative:

More engineering work.

Requires careful balance between extraction flexibility and verdict discipline.

ADR-006: Local-first deployment is the default for v1
Status: Accepted

Context
Varinth’s first users are developers verifying AI answers against their own codebases and documents. Those artifacts are often private, local, sensitive, or simply inconvenient to upload into a hosted cloud product.

A hosted-first product would require:

artifact upload pipelines,

project storage,

auth,

team controls,

and significantly more trust from users.

That is too much for v1.

Decision
Varinth will be local-first by default in v1.

It should run in a local environment against locally accessible artifacts, with self-hosted or hosted modes considered later.

Alternatives considered
Alternative A: Hosted SaaS first
Pros:

Easier onboarding narrative.

Easier analytics and central management.

More obviously “startup product” shaped.

Cons:

Slower to build.

Higher trust barrier.

Forces auth, storage, and security concerns too early.

Weak fit for private repo verification.

Alternative B: Local-first
Pros:

Better fit for sensitive codebases.

Lower infra burden.

Faster path to useful product.

Cleaner for developer adoption.

Cons:

Setup friction.

Less flashy first impression.

More environment-specific debugging.

Consequences
Positive:

Fastest route to real utility.

Better for private engineering workflows.

Avoids unnecessary platform complexity.

Negative:

Onboarding must be documented well.

Product polish depends on setup quality.

Harder to show SaaS-style growth optics immediately.

ADR-007: Source contexts and scopes are explicit configuration objects
Status: Accepted

Context
Verification must not accidentally roam arbitrary directories or search across uncontrolled files. Varinth needs an explicit definition of what artifacts are allowed as a source of truth.

There are two possible approaches:

Loose path-passing at runtime.

Explicit configured contexts and scopes.

Loose path-passing is faster initially, but it creates inconsistency, weak reproducibility, and security/sloppiness risks.

Decision
Varinth will use explicit SourceContext and SourceScope configuration objects as first-class concepts.

Verification will run against configured contexts/scopes, not arbitrary loose paths by default.

Alternatives considered
Alternative A: Freeform path input
Pros:

Fast to prototype.

Flexible for quick experiments.

Cons:

Easy to misuse.

Hard to reproduce.

Poor audit hygiene.

Higher risk of scanning the wrong material.

Alternative B: Structured contexts/scopes
Pros:

Better reproducibility.

Cleaner audit boundaries.

Safer and more deliberate.

Better fit for future productization.

Cons:

Slightly more setup.

More schema work early on.

Consequences
Positive:

Better boundary control.

Stronger traceability.

Better future migration path to multi-project support.

Negative:

Initial configuration overhead.

Slightly slower experimentation without helper tooling.

ADR-008: A minimal inspection UI is optional, not foundational
Status: Accepted

Context
There is obvious appeal in building a polished UI where users can inspect:

audit runs,

claim tables,

verdict chips,

evidence snippets,

and run history.

That UI may become useful later. But making it central too early would distort priorities away from core verification quality.

Decision
A minimal inspection UI may exist for debugging or demos, but it is not foundational to v1. The product’s core value must exist without depending on a rich standalone UI.

Alternatives considered
Alternative A: Build rich UI in v1
Pros:

Better demos.

Easier to inspect visually.

Feels like a more complete product.

Cons:

Consumes time better spent on verification quality.

Encourages shallow polish over core correctness.

Risks dashboard-first drift.

Alternative B: CLI/MCP output only
Pros:

Keeps focus pure.

Fastest engineering path.

Cons:

Harder to inspect failures.

Harder demos.

Less accessible for debugging.

Consequences
Positive:

Keeps v1 focused.

Preserves engineering attention on the hard problem.

Allows lightweight UI later without architectural distortion.

Negative:

Demo storytelling may be less visual at first.

Some debugging may be less convenient without a basic viewer.

ADR-009: v1 persistence is relational-first, graph-later if earned
Status: Accepted

Context
Varinth conceptually touches relationships between:

claims,

evidence,

sources,

and possibly future knowledge nodes.

That creates pressure to reach for a graph database early. But most of the product’s actual v1 needs are straightforward:

audit run storage,

claim storage,

evidence linkage,

verdict storage,

warnings,

execution traces.

Those map cleanly to a relational model.

Decision
Varinth v1 will use a relational-first persistence model.

Graph persistence may be added later only if it materially improves retrieval, contradiction analysis, or cross-run knowledge reuse.

Alternatives considered
Alternative A: Graph-first in v1
Pros:

Sounds advanced.

Good for future relationship-heavy modeling.

Potentially helpful for knowledge reuse later.

Cons:

Premature complexity.

Harder migration and tooling burden.

Solves a future problem before proving a current one.

Alternative B: Relational-first
Pros:

Simpler.

Easier migrations.

Easier testing.

More than enough for v1.

Cons:

Future graph enrichment may require additional modeling later.

Consequences
Positive:

Faster path to a working system.

Strong schema clarity.

Easier developer onboarding.

Negative:

Some future graph-style features may require supplementary storage later.

ADR-010: Evaluation quality is a first-class product concern
Status: Accepted

Context
Varinth is a verification product. If it cannot measure its own quality, the team will end up optimizing for demo aesthetics rather than truthfulness.

Many AI products postpone evaluation because it is harder than building a happy-path demo. That is exactly how weak systems survive too long.

Decision
Varinth will treat evaluation and benchmark design as a first-class part of the product architecture, not an afterthought.

This means:

golden cases,

benchmark repos,

claim-level verdict evaluation,

evidence quality tracking,

false-support tracking,

honest-uncertainty evaluation.

Alternatives considered
Alternative A: Evaluation later
Pros:

Faster short-term product velocity.

Easier early demos.

Cons:

No trustworthy quality signal.

Harder to know whether the product actually works.

Encourages self-deception.

Alternative B: Evaluation as first-class
Pros:

Honest progress measurement.

Better model/rule iteration.

Better product credibility.

Cons:

More work early.

Slower superficial progress.

Consequences
Positive:

Better long-term product quality.

More defensible claims about system performance.

Stronger engineering discipline.

Negative:

Requires extra upfront effort that doesn’t always look flashy.

3. How to extend this ADR log
Future ADRs should be added when a decision is:

architecturally significant,

hard to reverse,

likely to affect product shape,

or likely to be debated repeatedly.

Examples of future ADR-worthy topics:

hosted deployment model,

team collaboration support,

multi-repo contexts,

confidence scoring visibility,

graph augmentation,

model provider strategy,

security and redaction policy.

ADRs are most useful when they stay focused on actual important decisions, not every tiny implementation choice.

4. Final rule for using ADRs
If a future builder wants to change a decision in this file, the move is:

write a new ADR,

explain why the old decision is no longer right,

mark the old one as superseded,

and preserve the history.

That is the whole point of an ADR log