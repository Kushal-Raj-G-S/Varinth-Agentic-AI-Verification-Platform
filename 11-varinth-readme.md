Varinth
Varinth is an MCP-native AI answer audit engine for engineering workflows. It takes an AI-generated answer, breaks it into atomic claims, checks those claims against bounded source-of-truth artifacts such as code, docs, and config files, and returns claim-level verdicts with evidence. The README should begin with what the project does and why it matters before diving into setup or implementation detail.

Why Varinth exists
AI coding assistants are useful, but they routinely produce answers that are polished, plausible, and partially wrong. The problem is not that they answer poorly all the time. The problem is that they sound trustworthy even when parts of the answer are unsupported.

Varinth exists to add a verification layer between the model output and developer trust.

Its job is simple:

Take an AI-generated engineering answer, extract claims, verify them against actual project artifacts, and show which parts are supported, contradicted, or unverified.

This makes it easier to:

audit architectural explanations,

catch hallucinated implementation details,

validate generated internal docs,

and force AI answers to show receipts before developers trust them.

What Varinth is
Varinth is:

an MCP-native verification engine,

a developer tool,

a local-first audit system,

and a claim-level evidence-backed answer verifier.

Varinth is not:

a chatbot,

a code generator,

a generic web fact-checker,

a social-media truth engine,

or a bloated enterprise dashboard.

That boundary matters because the product wedge stays strong only if the scope stays sharp.

Core workflow
Varinth follows a simple flow:

A user asks an AI assistant a question about a system.

The assistant generates an answer.

Varinth receives the original question and generated answer.

Varinth extracts atomic claims from the answer.

Varinth retrieves evidence from configured source artifacts.

Varinth assigns a verdict to each claim:

supported

contradicted

unverified

Varinth returns a structured audit result.

The most important design rule is that evidence outranks style. If a claim sounds smart but the proof is weak, Varinth should stay conservative.

Example use cases
Varinth is designed for workflows like these:

Verify whether an AI-generated explanation of a FastAPI backend is actually grounded in the repo.

Catch hallucinated claims such as “this project uses Celery” when no such evidence exists.

Audit generated architecture summaries before sharing them internally.

Verify claims about auth, persistence, queues, background jobs, APIs, or deployment setups.

Add an evidence-backed verification step into MCP-enabled tools like Claude Desktop and Cursor.

Product principles
Varinth is built around a few hard rules:

Claim-level verification over vague trust scores

Evidence-backed verdicts over model intuition

unverified over fake certainty

Bounded-source verification over open-web pretending

MCP-first workflow integration over dashboard-first distraction

Local-first deployment before platform complexity

These principles matter because they stop the project from mutating into generic AI-tool noise.

Project status
Varinth is currently defined as a structured product/spec project with implementation intended around:

MCP-native interfaces,

local-first verification workflows,

relational-first persistence,

claim extraction,

evidence retrieval,

verdict assignment,

audit traceability,

and benchmark-driven evaluation.

This repository is designed so implementation tools or contributors can work from a clear spec base instead of inventing product behavior on the fly.

Repository structure
A README should help readers locate the rest of the documentation quickly.

Recommended structure:

text
varinth/
├── README.md
├── docs/
│   ├── 01-varinth-overview.md
│   ├── 02-varinth-features.md
│   ├── 03-varinth-user-flows.md
│   ├── 04-varinth-srs.md
│   ├── 05-varinth-architecture.md
│   ├── 06-varinth-mcp-spec.md
│   ├── 07-varinth-testing.md
│   ├── 08-varinth-prd.md
│   ├── 09-varinth-data-model.md
│   ├── 10-varinth-adrs.md
│   ├── 11-varinth-readme.md
│   ├── 12-varinth-prompts-and-rules.md
│   └── 13-varinth-api-contracts.md
├── src/
├── tests/
├── examples/
└── configs/
You can rename the docs folder layout later, but keep the doc numbering clean if you want build systems or AI tools to understand progression.

Architecture summary
At a high level, Varinth consists of these major parts:

Input layer – accepts question, answer, and verification context.

Claim extraction layer – converts answer text into atomic auditable claims.

Retrieval layer – finds evidence from configured code/docs/config sources.

Verdict engine – assigns supported, contradicted, or unverified.

Output layer – returns structured audit JSON.

Persistence layer – stores audit runs, claims, evidence, verdicts, and warnings.

MCP adapter – exposes the product inside MCP-compatible workflows.

If someone cannot understand the system from this section, your README is failing.

Key concepts
SourceContext
A configured project or workspace that Varinth is allowed to verify against.

Examples:

roast-backend

baxel-platform

varinth-self

SourceScope
A narrower verification region inside a SourceContext.

Examples:

backend

docs

infra

auth

AuditRun
One full verification execution.

Claim
An atomic statement extracted from the AI answer.

EvidenceItem
A retrieved snippet or artifact section used to support or contradict a claim.

VerdictResult
The final claim judgment:

supported

contradicted

unverified

Supported verdicts
Varinth v1 uses exactly three primary verdict labels:

supported
The claim is backed by evidence from configured source artifacts.

contradicted
The available evidence conflicts with the claim.

unverified
The system could not establish enough evidence to support or contradict the claim confidently.

This is important: unverified is not failure. It is disciplined uncertainty.

Installation
A README should include clear setup instructions with copy-pasteable commands when possible.

The exact installation commands may evolve, but the structure should look like this.

Prerequisites
Recommended baseline:

Python 3.11+

Node.js 20+ (if MCP client adapters or UI helpers need it)

Git

Local access to the repo/docs/config artifacts you want to verify

Claude Desktop and/or Cursor for MCP-based usage if applicable.

Clone the repository
bash
git clone https://github.com/your-org/varinth.git
cd varinth
Backend setup
bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
Optional frontend or helper setup
bash
npm install
Environment configuration
bash
cp .env.example .env
Set the required values in .env before running the system.

Quickstart
A strong README should include a minimal quickstart path from install to first useful result.

1. Configure a source context
Example:

bash
python -m varinth.cli add-context \
  --name "my-backend" \
  --slug "my-backend" \
  --root "/absolute/path/to/project"
2. Add a scope
bash
python -m varinth.cli add-scope \
  --context "my-backend" \
  --name "backend" \
  --slug "backend" \
  --path "backend/"
3. Run a local audit
bash
python -m varinth.cli verify \
  --context "my-backend" \
  --scope "backend" \
  --question "How does authentication work in this backend?" \
  --answer "This backend uses JWT authentication and stores sessions in Redis."
4. Read the result
Expected output shape:

json
{
  "audit_run_id": "run_001",
  "status": "completed",
  "claims": [
    {
      "claim": "This backend uses JWT authentication.",
      "verdict": "supported",
      "evidence": [
        {
          "source": "backend/auth.py",
          "location": "lines 22-61"
        }
      ]
    },
    {
      "claim": "This backend stores sessions in Redis.",
      "verdict": "unverified",
      "evidence": []
    }
  ]
}
That’s enough to prove the product is alive.

MCP usage
Varinth is designed to work as an MCP-native tool. The exact registration details will depend on your implementation, but conceptually it should be exposed as an MCP server that provides verification tools to compatible clients such as Claude Desktop and Cursor.

Typical usage pattern:

Register Varinth as an MCP server in the host client.

Ask the AI assistant a question about a repo/system.

Invoke Varinth against the previous answer.

Review claim-level verdicts and evidence.

Example prompt:

Use Varinth to audit your previous answer against the configured backend context.

That should feel natural inside the user’s existing workflow.

Example audit scenario
Prompt to AI assistant
Explain how this FastAPI backend handles authentication, persistence, and background jobs.

AI answer
The assistant provides a structured explanation.

Varinth audit
Varinth extracts claims like:

“This backend uses JWT authentication.”

“This system stores sessions in Redis.”

“Background jobs run through Celery workers.”

Then it verifies those claims against the configured sources and returns verdicts.

This is the core product loop.

Configuration
Varinth relies on explicit configuration boundaries.

Typical configuration areas:

source contexts,

source scopes,

retrieval settings,

claim extraction limits,

verdict thresholds,

logging levels,

prompt or model options if LLM-assisted steps are enabled.

Configuration should remain explicit and inspectable. Loose magic defaults are how verification tools become unreliable.

Documentation map
A README should point readers to deeper documentation instead of trying to contain everything itself.

Recommended documentation map:

01-varinth-overview.md – product concept and positioning

02-varinth-features.md – user-facing feature set

03-varinth-user-flows.md – real user journeys

04-varinth-srs.md – software requirements specification

05-varinth-architecture.md – architecture and component design

06-varinth-mcp-spec.md – MCP-facing tool contract

07-varinth-testing.md – evaluation and test strategy

08-varinth-prd.md – product requirements document

09-varinth-data-model.md – entity and persistence design

10-varinth-adrs.md – architecture decision records

12-varinth-prompts-and-rules.md – LLM behavior and prompt constraints

13-varinth-api-contracts.md – internal service/API contracts

This gives the repo a real spine.

Development priorities
If implementation is starting from scratch, build in this order:

Input contract

Claim extraction

Evidence retrieval

Verdict engine

Audit persistence

MCP adapter

CLI/debug flows

Optional inspection UI

That order keeps you focused on product substance before polish.

Testing philosophy
Varinth should be tested as both:

a software system,

and a verification engine.

That means you need:

unit tests,

integration tests,

system tests,

acceptance tests,

and benchmark cases with expected verdicts and evidence alignment.

If the product cannot measure its own correctness, it has no business grading AI answers.

Non-goals
Varinth v1 is explicitly not trying to be:

a general internet truth machine,

a legal verifier,

a medical evidence engine,

a social media misinformation platform,

a hosted enterprise control plane,

or a generic AI assistant framework.

Scope discipline is part of the product quality.

Contributing
If others contribute to Varinth, they should follow a disciplined rule:

do not widen scope casually,

do not replace evidence-backed logic with vague model behavior,

do not break the MCP-first philosophy,

and do not hide uncertainty behind softer language.

Future contribution docs can formalize this, but those principles should already be visible here.

Design philosophy in one sentence
Varinth exists to make AI-generated engineering answers auditable instead of merely believable.

That sentence should stay true even if everything else evolves.

License
Add the actual license once decided.

Example placeholder:

text
MIT License
or

text
Apache-2.0
Pick one and stop leaving this vague once the repo becomes real.

Contact / ownership
Add project ownership details here once finalized.

Recommended fields:

Maintainer name

GitHub handle

Email

Project homepage or demo link

Final note
If someone opens this repository and cannot answer these four questions within two minutes, the README is weak:

What is Varinth?

Why does it exist?

How do I run it?

Where do I go next?

This file should answer all four immediately