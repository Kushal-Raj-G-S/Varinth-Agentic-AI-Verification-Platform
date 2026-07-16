Varinth – Feature Specification (v1 & Beyond)
1. Scope overview
Varinth is a developer-first verification engine that integrates with MCP-enabled clients (Claude Desktop, Claude Code, Cursor, etc.) to audit AI-generated answers about a codebase or system.

It does three core things:

Break answers into atomic claims.

Check each claim against source-of-truth artifacts (code, docs, configs).

Return structured verdicts and evidence for each claim, via MCP tools.

This document defines Varinth’s feature set, with a clear v1 scope and v2+ roadmap.

2. Core capabilities (Varinth v1)
2.1 Claim extraction
Goal: Turn a free-form AI answer into a list of atomic, verifiable statements.

Features:

Parse an answer string into discrete claims, each representing:

A structural property (e.g., “Auth uses JWT tokens”).

A configuration fact (e.g., “Database uses Supabase Postgres”).

A behavioural guarantee (e.g., “This endpoint is idempotent.”).

Group similar statements into a single canonical claim where possible to avoid duplication.

Preserve:

Claim text.

Claim type (structural, config, guarantee, performance).

Any explicit numbers (limits, thresholds, counts).

Constraints:

Operates on text provided by the client (Claude/Cursor), not directly on conversation history.

Uses LLM assistance internally for parsing, but outputs a simple list of claim objects.

2.2 Evidence retrieval from source-of-truth
Goal: For each claim, find relevant artifacts in a configured source-of-truth set.

Supported sources in v1:

Code repositories

File paths + contents from a local or remote Git repo.

Basic language-aware search (imports, definitions, configs).

Documentation

Markdown/HTML docs in a configured directory.

Repo README and architecture docs.

Configuration files

YAML/JSON/TOML env configs, Docker Compose, Kubernetes manifests.

Features:

For each claim, search configured sources for:

Direct textual matches.

Structural matches (e.g., use of specific libraries/functions).

Config values (e.g., env variables, resource limits).

Return evidence chunks:

source_id (e.g., file path).

location (line number / section).

snippet (short excerpt).

Provide up to N evidence items per claim (configurable) to keep the output manageable.

Constraints:

No generic web crawling in v1; ground truth is explicitly configured project artifacts, not the entire internet.

If no matching evidence is found, evidence list is empty for that claim.

2.3 Verdict assignment per claim
Goal: Classify each claim based on available evidence, using deterministic rules.

Verdict states:

supported – Evidence explicitly supports the claim.

contradicted – Evidence explicitly contradicts the claim.

unverified – No sufficient evidence found; not automatically treated as false.

Features:

Define a rule engine that uses:

Claim type.

Evidence presence and content.

Configurable match thresholds (e.g., “requires at least X strong matches”).

For supported:

Require at least one strong evidence snippet that clearly backs the claim.

For structural claims, ensure code/config matches the described behaviour.

For contradicted:

Identify explicit mismatches (e.g., “uses MongoDB” vs config showing Postgres).

Only mark as contradicted if there is clear opposing evidence.

For unverified:

No evidence found, or evidence is ambiguous.

System chooses honesty over guessing.

Compute an optional confidence score per claim (0.0–1.0), based on:

Number and quality of evidence snippets.

Clarity of matches.

Constraints:

No claim gets supported without at least one attached evidence snippet.

Performance/security guarantees are only supported if explicit tests/benchmarks/configs exist.

2.4 Structured JSON output for MCP tools
Goal: Provide a clean machine-readable response to MCP clients.

Output schema (v1):

json
{
  "global_score": 0.0,
  "claims": [
    {
      "text": "string",
      "type": "structural | config | guarantee | performance",
      "verdict": "supported | contradicted | unverified",
      "confidence": 0.0,
      "evidence": [
        {
          "source_id": "string",
          "location": "string",
          "snippet": "string"
        }
      ]
    }
  ]
}
Features:

global_score: high-level trust indicator (e.g., fraction of claims that are supported).

claims: array of claim objects with all fields necessary for:

Display in Claude Desktop / Cursor.

Further processing by clients.

Constraints:

Output must be deterministic given same inputs.

Must be small enough to be comfortably rendered in typical MCP client UIs.

2.5 MCP tool integration (varinth_verify)
Goal: Expose Varinth as an MCP tool in MCP-enabled clients.

Tool name: varinth_verify

Input (from MCP client):

json
{
  "question": "string",
  "answer": "string",
  "context_id": "string (optional)",
  "source_scope": "string (optional)"
}
Output: The JSON schema in section 2.4.

Features:

Accepts:

Original question asked to the AI.

Full answer text to be audited.

Optional context identifiers (project, repo, workspace).

Optional scope hints (e.g., “backend” vs “frontend” folder).

Returns:

Claim-level verdicts and evidence in one call.

A single global_score.

Constraints:

Must comply with MCP spec for tool definition and communication.

Should support both stdio and HTTP transports (as needed by different clients).

2.6 Basic multi-agent reasoning & guardrails
Goal: Use LLM agents for reasoning without letting them override the deterministic rules.

Features:

Reasoning agents:

ClaimExtractorAgent – helps parse answers into claims.

EvidenceSummarizerAgent – describes how evidence supports or contradicts claims.

ExplanationAgent – produces short human-readable rationales per claim.

Guardrails (NeMo / OpenClaw):

Define rails to:

Block obviously unsafe topics.

Enforce “no strong verdict without evidence.”

Use rails to constrain agent outputs (e.g., no rephrasing verdicts as “truth/fake”).

Constraints:

Agents assist; they do not decide verdicts alone.

Guardrails must run before and/or after agent usage to maintain safety and consistency.

3. Non-goals for v1
To keep Varinth v1 buildable and honest, the following are explicitly out of scope:

3.1 Not a universal truth engine
Varinth does not attempt to determine universal truth across the open web or arbitrary real-world claims.

Out of scope examples:

“Is inflation in country X caused by Y?”

“Is a historical event interpretation correct?”

“Which programming language is best?”

Varinth v1 is focused on bounded verification against configured source-of-truth artifacts.

3.2 Not a generic web fact-checker
Varinth v1 does not crawl the internet broadly or rank external websites for credibility.

This means:

No arbitrary Google-style search over the whole web.

No social media claim analysis.

No public misinformation detection engine.

If web retrieval is added later, it must be domain-scoped and policy-controlled.

3.3 Not a replacement for human review
Varinth assists human decision-making by structuring evidence and verdicts, but it is not a legal, compliance, or production approval authority.

It should never be positioned as:

“This system guarantees truth.”

“This makes engineering review unnecessary.”

“This can sign off production risk by itself.”

Its job is to make claims reviewable, faster, and more disciplined.

3.4 Not a full enterprise SaaS in v1
The following are intentionally delayed:

Multi-tenant organizations.

Team permissions and SSO.

Billing and subscription plans.

Admin dashboards and analytics-heavy back offices.

Large-scale hosted control planes.

Varinth v1 should behave like a serious dev tool, not a bloated startup dashboard.

3.5 Not a broad multi-domain platform in v1
Varinth v1 is optimized for engineering and software-system answers.

Out of scope for v1:

Medical knowledge verification.

Legal reasoning verification.

Financial advisory verification.

Scientific literature review at scale.

These can become domain packs later, but they should not contaminate the first build.

4. User-facing features by surface
Varinth’s core engine is exposed through multiple adapters. The underlying verification logic remains the same; only the interaction surface changes.

4.1 Local MCP server
Purpose: Provide a universal adapter for MCP-enabled tools.

User-visible capabilities:

Register Varinth as a local MCP server.

Call varinth_verify from compatible clients.

Get structured claim audits in the client itself.

Why it matters:

It is the most reusable integration surface.

It proves the product is designed for the MCP ecosystem, not locked into one client.

4.2 Claude Desktop extension
Purpose: Make Varinth installable and easy to use in Claude Desktop.

User-visible capabilities:

One-click install as a desktop extension.

Natural-language invocation inside Claude:

“Audit your previous answer with Varinth.”

“Verify this against my repo.”

Display claim verdicts directly in chat.

Why it matters:

Lower friction than manual config.

Feels like a real product, not just a developer script.

4.3 Cursor integration
Purpose: Bring Varinth into coding workflows inside the IDE.

User-visible capabilities:

Add Varinth as a MCP server in Cursor.

Ask the coding assistant to explain or generate something.

Trigger Varinth to verify the generated explanation against local code/docs.

Why it matters:

Cursor is part of the daily workflow of the exact audience Varinth targets.

Verifying AI explanations inside the editor is more valuable than forcing users into a separate app.

4.4 Minimal developer dashboard (optional in late v1 / early v2)
Purpose: Provide a simple UI for debugging and demoing results outside MCP clients.

User-visible capabilities:

Paste a question and AI answer.

Run verification manually.

Inspect extracted claims, evidence snippets, and verdicts.

Review audit logs for past runs.

Why it matters:

Helps during development and demos.

Makes the engine easier to inspect.

Should remain secondary, not the primary product surface.

5. Feature prioritization
This section defines what must be built first, what is important but secondary, and what can wait.

5.1 Must-have (v1)
These are non-negotiable:

Claim extraction from answer text.

Evidence retrieval from configured local/project sources.

Deterministic verdict assignment.

MCP tool varinth_verify.

JSON response format.

Claude Desktop local usage.

Basic logs for debugging.

Simple config system for repo/doc source registration.

Without these, Varinth is not Varinth.

5.2 Should-have (v1.1)
These are strong improvements after the core is working:

Better evidence ranking.

Confidence scoring improvements.

Cursor-specific setup docs and smoother prompts.

Minimal local UI for inspection.

Better explanation strings for why a claim was supported/contradicted.

These make the product more usable and demo-ready.

5.3 Nice-to-have (v2+)
These should wait until the core system is stable:

Knowledge graph visualizations.

Multi-workspace project support.

Shared team memory / persistent workspaces.

Domain-specific verification packs.

Hosted cloud deployment.

Enterprise auth and access control.

These are good ideas, but they are not the first battle.

6. Functional requirements summary
For quick implementation alignment, the core functional requirements are summarized below.

ID	Requirement	Priority
FR-1	System shall accept a question and answer as verification input	Must-have
FR-2	System shall extract atomic claims from answer text	Must-have
FR-3	System shall retrieve relevant evidence from configured sources	Must-have
FR-4	System shall classify claims as supported, contradicted, or unverified	Must-have
FR-5	System shall attach evidence snippets to non-empty verdict reasoning	Must-have
FR-6	System shall expose varinth_verify as an MCP tool	Must-have
FR-7	System shall return structured JSON output consumable by MCP clients	Must-have
FR-8	System shall log verification runs for debugging and replay	Must-have
FR-9	System should provide confidence scores per claim	Should-have
FR-10	System should support a minimal visual inspection UI	Should-have
This summary is intentionally concise so builders can map it directly into tickets or milestones.

7. Output quality expectations
Varinth’s outputs must be useful in real engineering workflows, not just technically correct.

7.1 Clarity
Each claim output should be readable by a developer without extra explanation.

Bad:

“Moderately supported semantic relation detected.”

Good:

“Supported: JWTBearer middleware is configured in backend/auth.py:44–62.”

7.2 Evidence-first behavior
Varinth should always prefer:

Showing direct evidence,

then a short explanation,

then an optional score.

It should never lead with vague confidence language while hiding evidence.

7.3 Honest uncertainty
When evidence is missing or ambiguous, Varinth should say:

unverified

It should not say:

“Probably true”

“Likely accurate”

“Seems right”

That kind of mush destroys trust.

7.4 Reproducibility
Given the same configured sources, input question, and answer, Varinth should produce consistent results unless the repo or config changes.

This is especially important for:

regression testing,

demos,

and future benchmark tracking.

8. Example feature scenario
Scenario: auditing an architectural explanation
User environment: Claude Desktop with Varinth extension enabled.

User prompt to Claude:
“Explain how this FastAPI backend handles authentication, persistence, and async workflows.”

Claude output:
A multi-paragraph explanation containing several claims.

User command:
“Use Varinth to audit your last answer against this repo.”

Varinth performs:

Extract 5–10 atomic claims.

Search configured repo/docs/configs.

Assign verdicts with evidence.

Return JSON to Claude.

Claude renders an audit summary.

Expected user-visible result:

Claim 1 — supported

Claim 2 — supported

Claim 3 — contradicted

Claim 4 — unverified

Overall trust score visible

This is the exact kind of scenario v1 should optimize for.

9. Final feature philosophy
Varinth is not valuable because it has many features.
It is valuable because it performs one high-leverage function exceptionally well:

Turn a polished AI answer into a structured, evidence-backed claim audit.

That means every feature must be judged by one question:

Does this make Varinth better at extracting claims, finding evidence, assigning honest verdicts, or fitting naturally into real developer workflows?

If not, it does not belong in v1.