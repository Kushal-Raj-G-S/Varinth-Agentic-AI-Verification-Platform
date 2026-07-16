Varinth – User Flows & Real-World Usage
1. Purpose of this document
This document defines exactly how users interact with Varinth in real workflows. Its purpose is to remove ambiguity for implementation by specifying:

who the user is,

what environment they are in,

what input they provide,

when Varinth is invoked,

what Varinth receives,

what Varinth returns,

and where the output is shown.

Varinth is designed to work inside existing AI tools rather than forcing users into a brand-new standalone workflow. MCP exists specifically to connect AI assistants to tools and data systems, and Claude Desktop plus other MCP-capable clients now support local servers and installable desktop extensions.

The first implementation target is engineering and software-system verification, not general-purpose internet fact checking.

2. Primary user personas
2.1 Solo builder / AI-heavy developer
This user writes code, reads docs, explores architecture, and prototypes using Claude Desktop, Cursor, Claude Code, or similar tools. They regularly ask an AI assistant to:

explain a codebase,

summarize architecture,

identify bugs,

describe auth/database flows,

and reason about scaling or integrations.

Their pain point is not getting an answer — they already get answers. Their pain point is knowing which parts of that answer are actually grounded in the repo or docs.

2.2 Product engineer / startup developer
This user works in a small team and relies on AI to move faster, especially when joining unfamiliar codebases or generating documentation. They need a lightweight way to verify whether generated explanations or implementation summaries match reality.

2.3 Infra / platform-minded engineer
This user is already comfortable wiring tools together. They see MCP not as a gimmick but as the practical integration layer for AI workflows. They want a verification engine that can sit inside the same toolchain and act as a “truth layer” over AI-generated output.

3. Core workflow philosophy
Varinth is not meant to be the first thing the user touches. The user starts in a tool they already use daily:

Claude Desktop,

Cursor,

Claude Code,

or any MCP-capable client.

The workflow is always:

User asks the AI something about a system.

AI produces an answer.

User invokes Varinth on that answer.

Varinth audits the answer against configured source-of-truth artifacts.

The result appears in the same workflow surface.

This means Varinth behaves as a verification pass, not as the primary chat interface.

4. Primary v1 flow – Claude Desktop local MCP / extension workflow
This is the main reference flow for Varinth v1.

4.1 Preconditions
The following are true before the user begins:

Claude Desktop is installed and working.

Varinth is installed either:

as a local MCP server configured manually, or

as a packaged Claude Desktop extension / DXT-style desktop extension for easier one-click installation.

A local project, repo, or documentation folder is available as the source-of-truth set.

Varinth configuration already points to one or more allowed data roots such as:

project repository,

documentation folder,

configuration directory.

4.2 User goal
The user wants to know whether Claude’s answer about a repo or system is genuinely grounded in the code/docs or just a polished guess.

4.3 Step-by-step interaction
Step 1: User opens Claude Desktop
The user starts in Claude Desktop because that is already where they ask questions, inspect code, and think through implementation details.

Step 2: User provides source context
The user either:

drags project docs into Claude,

gives Claude access to local files/resources,

or works in an environment where the repo path is already known to Varinth through config.

The important point is that Varinth’s source-of-truth is not inferred from the entire machine. It is bounded to approved project roots.

Step 3: User asks Claude a normal engineering question
Examples:

“Explain how this backend handles authentication and persistence.”

“Describe the architecture of this project.”

“Summarize the scaling approach used in this repo.”

“List the core services and their responsibilities.”

At this point, Varinth is not yet active. Claude answers normally.

Step 4: Claude produces an answer
Claude writes a regular natural-language explanation. That answer may include:

accurate claims,

overstatements,

ambiguous conclusions,

or invented guarantees.

This answer becomes the object Varinth will audit.

Step 5: User invokes Varinth
The user uses natural language such as:

“Use Varinth to audit your last answer against this repo.”

“Run Varinth on the previous response.”

“Verify those claims with Varinth.”

“Check which parts of your answer are supported.”

Because Varinth is registered as an MCP tool / extension, Claude can call it directly from the chat flow once installed and enabled.

Step 6: Claude sends MCP tool input to Varinth
Claude passes a structured payload to the varinth_verify tool.

Example input:

json
{
  "question": "Explain how this backend handles authentication and persistence.",
  "answer": "This backend uses JWT-based authentication, Supabase PostgreSQL for persistence, and asynchronous workers for background processing...",
  "context_id": "project-root",
  "source_scope": "backend"
}
Varinth does not need the entire chat history. For v1, the core required inputs are:

the original user question,

the AI-generated answer,

optional source hints or context identifiers.

Step 7: Varinth performs audit pipeline
Varinth runs its internal flow:

Extract claims from the answer.

Search configured sources for evidence.

Evaluate each claim against evidence.

Assign verdicts:

supported

contradicted

unverified

Return structured results.

Step 8: Claude displays the result in chat
Claude receives the MCP result and renders it as a human-readable message inside the same conversation.

Example visible output:

Claim: “Backend uses JWT authentication.” → Supported

Claim: “System safely handles thousands of concurrent requests.” → Unverified

Claim: “Persistence uses MongoDB.” → Contradicted

Each item may also show evidence excerpts or summarized rationale.

4.4 Why this workflow matters
This is the ideal v1 flow because:

it uses a tool the target audience already uses,

it keeps the user in one interface,

it demonstrates MCP-native integration clearly,

and it makes Varinth feel like a serious extension rather than another isolated dashboard.

5. Example Claude Desktop scenario
Scenario title
Auditing an AI explanation of a FastAPI backend

Context
A user has a FastAPI project with:

auth logic,

PostgreSQL integration,

Docker Compose,

and a small architecture doc.

User interaction
User asks Claude:

“Explain how this project handles authentication, persistence, and async workflows.”

Claude replies:

“This project uses JWT authentication, Supabase PostgreSQL for persistence, and Celery workers for background jobs. It is designed for secure role-based workflows and can scale efficiently across services.”

The user then says:

“Use Varinth to audit your previous answer against this repo.”

What Varinth should do
Varinth extracts claims such as:

Project uses JWT authentication.

Project uses Supabase PostgreSQL.

Project uses Celery workers.

Project supports secure role-based workflows.

Project scales efficiently across services.

Varinth checks the repo and may return:

Claim	Verdict	Reason
Project uses JWT authentication	Supported	Auth middleware or token utility found
Project uses Supabase PostgreSQL	Supported	Config and client code found
Project uses Celery workers	Contradicted	No Celery files; different async mechanism found
Project supports role-based workflows	Supported or Unverified	Depends on actual auth logic
Project scales efficiently across services	Unverified	No explicit benchmark/config proof
Claude then displays the audit summary in the chat.

This is the exact kind of “holy shit, that’s useful” moment Varinth should create.

6. Secondary v1 flow – Cursor IDE workflow
This is the second most important adapter after Claude Desktop.

6.1 Preconditions
Cursor is installed and used as the coding environment.

Varinth is configured as a MCP server in Cursor’s MCP settings or project MCP config.

The codebase being discussed is open in the IDE and accessible to Cursor and/or Varinth.

6.2 User goal
The user wants to verify an explanation, refactor suggestion, or implementation summary without leaving the editor.

6.3 Step-by-step interaction
Step 1: User asks Cursor about the current codebase
Examples:

“Explain this auth flow.”

“Summarize how the websocket layer works.”

“What database model does this module use?”

“Describe the architecture of this service.”

Cursor replies with an answer.

Step 2: User asks Cursor to verify its own answer
Examples:

“Use Varinth to verify your last explanation.”

“Audit this answer against the open repo with Varinth.”

“Check those claims with Varinth.”

Step 3: Cursor invokes MCP tool
Cursor sends question + answer + optional scope info to varinth_verify.

Step 4: Varinth audits against source-of-truth
Varinth processes the input using the same engine as in Claude Desktop.

Step 5: Cursor renders the output inline
The result appears in the IDE chat panel or assistant UI as a verification summary.

6.4 Why Cursor matters
Cursor is a daily-use environment for the exact “AI coding / vibe coding” demographic you are targeting. Supporting Cursor means Varinth becomes part of the developer’s actual build loop, not just a side experiment.

7. Tertiary flow – Minimal local web inspector
This is not the primary product surface, but it is useful for demos and debugging.

7.1 Purpose
Provide a simple local UI where a user can paste:

question,

answer,

source scope,

and manually run an audit.

7.2 Use cases
debugging extraction or verdict issues,

demoing Varinth to someone who does not have Claude Desktop configured,

testing the engine without a client integration.

7.3 User flow
Open local Varinth web inspector.

Paste question and answer.

Choose project/source scope.

Click “Audit”.

See extracted claims, verdicts, evidence, and overall score.

7.4 Why it is secondary
This helps development, but it is not the product wedge. The wedge is integration into tools users already live in.

8. Input model
To keep the product implementation clean, Varinth expects a narrow input model.

8.1 Required input fields
question
The user’s original prompt to the AI.

answer
The AI-generated response to be audited.

8.2 Optional input fields
context_id
Identifier for a configured workspace, repo, or project root.

source_scope
Optional hint narrowing the verification area such as:

backend

frontend

docs

infra

answer_id
Optional identifier for audit logging and replay.

8.3 Input principle
Varinth v1 audits answers, not whole conversations.

That is important because it keeps the product:

easier to reason about,

easier to test,

and easier to implement via MCP.

9. Output model
Varinth returns structured audit output that the client can render however it wants.

9.1 Core output
json
{
  "global_score": 0.78,
  "claims": [
    {
      "text": "This backend uses JWT authentication.",
      "type": "structural",
      "verdict": "supported",
      "confidence": 0.94,
      "evidence": [
        {
          "source_id": "backend/auth/jwt.py",
          "location": "lines 10-48",
          "snippet": "JWT token creation and validation logic..."
        }
      ]
    }
  ]
}
9.2 Rendering expectation
Different clients may present this differently:

Claude Desktop → conversational summary in chat.

Cursor → inline assistant panel.

Local web UI → cards/table of claims.

The output format must remain stable even if the visual presentation changes.

10. Failure and edge-case flows
A real system needs defined behavior when things go wrong.

10.1 No evidence found
If no useful evidence is found for a claim:

verdict must be unverified

not contradicted

not “probably false”

10.2 Source not configured
If the requested project/root is not configured:

Varinth should return a configuration error

the client should surface a readable message:

“Varinth could not access the configured source scope.”

10.3 Malformed input
If the client sends empty or invalid question/answer:

Varinth should reject the call with a structured validation error.

10.4 Large answers / too many claims
If an answer is too long or too claim-dense:

Varinth may truncate claims or process top-N claims first,

but it must state this clearly in metadata or logs.

10.5 Ambiguous evidence
If evidence partly matches but is not conclusive:

verdict should remain unverified

explanation may note ambiguity.

11. Acceptance criteria for user flows
The user-flow implementation is successful when:

A developer can install or register Varinth in Claude Desktop and trigger it from chat.

A developer can connect Varinth to Cursor as a MCP tool and audit responses in the editor.

The input contract is simple and stable: question + answer + optional scope.

The output is understandable without opening backend logs.

The user feels that Varinth is a natural extension of their existing tool, not a foreign workflow.

12. Final design rule
Every user flow in Varinth should follow one rule:

The user should ask the AI normally first, then invoke Varinth only when they want the answer audited.

That keeps Varinth powerful without making it intrusive.

It also preserves the correct product identity:

Claude/Cursor remain the assistant.

Varinth becomes the verification layer that forces the assistant to show receipts.