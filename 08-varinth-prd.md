Varinth – Product Requirements Document (PRD)
1. Document purpose
This PRD defines the product intent for Varinth. It explains:

what Varinth is,

why it should exist,

who it is for,

what problem it solves,

what the first release must achieve,

how success will be measured,

and what is explicitly out of scope.

A product requirements document exists to align implementation around product purpose, features, and success criteria rather than leaving engineering to infer the product direction on its own.

This document is intentionally product-first, not architecture-first.
The SRS, architecture, MCP spec, and testing docs describe how Varinth should be built.
This PRD defines what Varinth should accomplish and why those decisions matter.

2. Product summary
2.1 Product name
Varinth

2.2 One-line definition
Varinth is an MCP-native AI answer audit engine that verifies AI-generated engineering answers against bounded source-of-truth artifacts such as code, docs, and configs, then returns claim-level verdicts with evidence.

2.3 Product category
Varinth is a:

developer tool,

AI verification product,

MCP-native protocol tool,

and local-first engineering assistant extension.

It is not a chatbot, not a code generator, and not a generic enterprise compliance suite.

2.4 Core product idea
Modern AI tools are increasingly used to explain codebases, reason about architectures, summarize systems, and generate implementation guidance. They are useful, but they often produce answers that are plausible, polished, and partially wrong. Varinth exists to audit those answers in a structured way instead of asking developers to trust them blindly.

The product’s core promise is simple:

If an AI answer makes a claim about your system, Varinth should help you see whether that claim is supported, contradicted, or unverified — and show the evidence.

3. Problem statement
3.1 Current user problem
Developers increasingly rely on AI assistants such as Claude Desktop, Cursor, and similar MCP-capable environments to understand systems, generate explanations, and accelerate engineering work.

The problem is not lack of answers. The problem is lack of trustworthy verification.

Today, AI-generated engineering answers frequently suffer from these failure modes:

confident overclaiming,

inferred guarantees with no proof,

architecture summaries that mix truth and hallucination,

unsupported statements about scaling, security, persistence, or orchestration,

and no built-in workflow for checking which parts of an answer are actually grounded in the repo or documentation.

This creates a dangerous situation:

the answer sounds professional,

the developer wants to move fast,

and there is no systematic truth layer between the model and the user.

3.2 Why existing alternatives are insufficient
Existing alternatives typically solve adjacent problems, not this exact one:

Chat assistants generate answers.

Code search tools retrieve files.

Guardrail tools constrain unsafe output.

Memory/KG systems improve agent context.

Enterprise audit platforms generate reports.

But none of those directly solve the core workflow:

“Take this AI-generated answer about my project and audit it claim-by-claim against my actual source-of-truth.”

That is the gap Varinth is built to fill.

3.3 Why this problem matters now
The problem becomes more urgent because MCP-native workflows are making AI assistants more deeply integrated with developer environments and tools. As AI becomes more embedded in coding workflows, the cost of unverified answers increases. A wrong architecture claim or fake security assumption is not just annoying — it can distort implementation decisions, documentation, reviews, and product velocity.

4. Product vision
4.1 Vision statement
Varinth should become the verification layer that makes AI-generated engineering answers inspectable, evidence-backed, and safe to challenge.

4.2 Long-term product vision
Long term, Varinth should evolve into a reusable verification engine that can sit across MCP-based workflows and force model outputs to show receipts before developers trust them.

That long-term vision may eventually include:

broader integrations,

knowledge graph enrichment,

richer evidence reasoning,

reusable verification APIs,

and shared team workflows.

But the first release should remain narrow and sharp.

4.3 v1 vision
For v1, Varinth should feel like:

a serious developer tool,

installable in local AI workflows,

capable of auditing real engineering answers,

and honest enough to say unverified when proof is missing.

If v1 can do that reliably, the product is already meaningful.

5. Product objectives
A good PRD defines objectives and success metrics instead of just listing features. Varinth’s objectives are below.

5.1 Primary objective
Enable developers to verify whether an AI-generated engineering answer is grounded in their actual project artifacts.

5.2 Secondary objectives
Reduce trust in unsupported model claims.

Improve confidence in genuinely evidence-backed answers.

Fit naturally into existing AI-driven developer workflows.

Make verification faster and more structured than manual spot-checking.

Provide a reusable foundation for future verification tooling.

5.3 Product objective in plain language
Varinth should make it harder for AI to get away with polished bullshit.

That is the real product objective.

6. Target users
6.1 Primary target user
AI-heavy software developers who use tools like Claude Desktop, Cursor, Claude Code, and similar assistants to understand, build, and maintain software systems.

These users:

already trust AI enough to use it daily,

already work fast,

but are technical enough to care when answers are ungrounded.

6.2 Secondary target user
Small product and startup teams that use AI for engineering productivity but want a lightweight verification layer before they trust generated architectural or implementation explanations.

6.3 Tertiary target user
Infra-minded builders who treat MCP as a real systems layer and want a verifiable tool in that ecosystem rather than another generic AI wrapper.

6.4 Non-target users
Varinth v1 is not aimed at:

general consumers,

non-technical end users,

marketing teams,

social media fact-checkers,

generic knowledge workers,

or broad compliance departments.

If you try to serve everyone in v1, you’ll serve nobody properly.

7. User needs
The core user needs are straightforward.

7.1 Need: grounded explanation verification
Users need to know whether an AI explanation of a codebase, architecture, or system is actually grounded in code/docs/configs.

7.2 Need: claim-level visibility
Users do not want one vague trust score alone. They need per-claim visibility:

what was claimed,

what evidence was found,

and what verdict was assigned.

7.3 Need: workflow compatibility
Users do not want to leave Claude or Cursor and go into a bloated separate system just to audit an answer.

7.4 Need: honest uncertainty
Users need a tool that is willing to say:

“I can support this,”

“I can contradict this,”

or “I cannot verify this.”

Without that honesty, the product becomes self-defeating.

8. Product principles
These principles should guide implementation decisions when the specs leave room for interpretation.

8.1 Evidence over style
If a model-generated explanation sounds smart but the evidence is weak, the output should remain conservative.

8.2 Verification over generation
Varinth is not trying to generate the best answer. It is trying to verify the answer that was already generated.

8.3 Local-first before platform-first
The first release should work inside local developer workflows before trying to become a cloud control plane.

8.4 Narrow wedge before broad suite
Varinth should solve one painful problem really well before expanding into a broad product suite.

8.5 Honest uncertainty over fake confidence
unverified is a strength, not a weakness.

8.6 Integrate into existing surfaces
Claude Desktop and Cursor matter because that is where the target user already works.

9. Scope of the first release
Good PRDs define scope and explicitly call out what is out of scope to prevent drift.

9.1 In scope for v1
The first release of Varinth should include:

MCP-native verification interface.

Local-first deployment.

Audit of AI-generated engineering answers.

Claim extraction from answer text.

Evidence retrieval from bounded project artifacts:

code,

docs,

config files.

Verdict assignment per claim:

supported

contradicted

unverified

Structured JSON output.

Claude Desktop local MCP support.

Cursor MCP compatibility.

Logging and audit traceability.

Basic explanation text for claim verdicts.

9.2 Out of scope for v1
The first release should not include:

open-web fact checking,

social-media claim verification,

legal or medical truth auditing,

enterprise multi-tenancy,

billing,

SSO / org controls,

large-scale team collaboration features,

universal knowledge assistant behavior,

broad hosted SaaS control plane,

rich analytics dashboard as the primary product,

or “AI agent that does everything.”

9.3 Scope boundary rule
If a feature does not make Varinth better at:

extracting claims,

retrieving evidence,

assigning verdicts,

or fitting naturally into dev workflows,

it does not belong in v1.

10. Core use cases
10.1 Audit an architectural explanation
A user asks Claude or Cursor to explain a system architecture, then uses Varinth to verify the resulting answer against the repo and docs.

10.2 Audit claims about auth / persistence / infra
A user asks an AI tool to explain authentication, persistence, queues, background jobs, deployment, or API structure, then runs Varinth to verify the explanation.

10.3 Catch hallucinated implementation details
An AI assistant claims a project uses a specific framework, library, or worker system. Varinth checks whether that claim is actually reflected in the codebase.

10.4 Validate generated internal documentation
An AI tool drafts documentation or internal architecture notes. Varinth is used to verify whether the claims in that draft are grounded before the team trusts it.

11. Core product requirements
This section is intentionally product-level, not low-level engineering spec.

11.1 The product must accept an AI answer as the object of verification
Varinth should operate on a provided AI-generated answer and its question context.

11.2 The product must return claim-level results
It must not collapse everything into one vague confidence number.

11.3 The product must show evidence for supported or contradicted claims
Evidence visibility is central to product trust.

11.4 The product must integrate into MCP-capable workflows
The product must be usable from tools like Claude Desktop and Cursor.

11.5 The product must preserve bounded trust
If proof is insufficient, the product must default to unverified.

12. Success metrics
PRDs should define success metrics and product outcomes, not just features.

12.1 Product success metrics for v1
The first release is successful if:

A user can run Varinth from at least one real MCP client end-to-end.

Varinth correctly catches clear unsupported claims in curated benchmark cases.

Varinth returns evidence for claims labeled supported or contradicted.

Varinth does not produce supported verdicts without evidence.

Developers can use it naturally in a real workflow without needing a separate heavyweight interface.

12.2 Qualitative success signals
Success also looks like this:

A developer says, “Now I can see what the AI actually proved.”

Varinth becomes the step they use before trusting an AI explanation.

The tool feels sharp and useful, not gimmicky.

12.3 Failure signals
The first release is failing if:

users cannot tell why a verdict was assigned,

the product overclaims certainty,

the tool is harder than manual verification,

or it feels like a random dashboard instead of a workflow-native verifier.

13. Risks and assumptions
13.1 Assumption: users already rely on AI answers
Varinth only matters if users are already asking AI tools serious engineering questions.

This assumption is strong and realistic in the current tooling ecosystem.

13.2 Assumption: bounded verification is more valuable than broad vague verification
It is better to verify a narrow set of claims against real repo truth than to pretend to verify everything on the internet.

13.3 Risk: retrieval quality may limit verdict quality
If evidence retrieval is weak, verdict quality will collapse even if the rest of the architecture looks good.

13.4 Risk: overbuilding the product
The biggest product risk is scope drift — turning Varinth into:

an enterprise platform,

a giant dashboard,

or a generic AI assistant.

That would kill the wedge.

13.5 Risk: too much model reasoning, not enough rules
If the system leans too hard on model vibes and not enough on evidence-backed evaluation, trust will disappear.

14. Dependencies
Varinth depends on:

MCP-capable client workflows and integrations.

access to bounded project artifacts,

local runtime configuration,

and a functioning verification backend that can parse, retrieve, and score claims.

Optional dependencies include:

model providers for extraction or summarization,

guardrails systems,

structured persistence layers.

15. Release strategy
15.1 Release goal
The first release should prove one thing:

Varinth can audit a real AI-generated engineering answer inside a real developer workflow and return useful, evidence-backed claim judgments.

15.2 Release shape
The first release should prioritize:

local MCP server mode,

solid verification output,

basic logs,

and a clean developer-facing setup.

15.3 Release restraint
Do not force cloud, billing, team collaboration, rich dashboarding, or multi-domain support into the first release.

That is how good products get buried under their own ambition.

16. Open product questions
These questions are worth keeping visible, but they should not block v1:

Should the first experience be manual local MCP config or packaged extension first?

Should confidence scores be shown to users in v1 or kept internal?

Should the local inspection UI exist in v1 or wait until later?

How much of the explanation text should come from deterministic rules vs LLM summarization?

When does a project graduate from local-first to team-shared usage?

These are product tuning questions, not reasons to stall.

17. Final product statement
Varinth should be built as a sharp verification product for AI-driven engineering workflows.

Its job is not to impress users with personality.
Its job is not to generate more content.
Its job is not to become a generic AI platform.

Its job is this:

Take an AI-generated engineering answer, break it into claims, check those claims against the actual system, and show which parts deserve trust.

If the product does that cleanly, it wins.