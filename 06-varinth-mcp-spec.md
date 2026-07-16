Varinth – MCP Specification & Integration Contract
1. Purpose of this document
This document defines how Varinth is exposed as an MCP-native verification service. It covers:

tool identity,

transport modes,

request and response schemas,

configuration model,

installation and packaging expectations,

client integration patterns for Claude Desktop and Cursor.

The objective is to make Varinth easy to implement and easy to consume from MCP-capable clients. MCP is designed around clients invoking server-provided tools and resources, and the protocol benefits from explicit input/output contracts rather than loosely described behaviors.

2. Server identity
2.1 Canonical server name
The canonical MCP server name shall be:

varinth

This should be the internal protocol/server identity used in docs, packaging, logs, and config examples.

2.2 Human-readable server description
Recommended short description:

Varinth verifies AI-generated engineering answers against configured code, docs, and configs, then returns claim-level verdicts with evidence.

This description should be short enough to appear cleanly inside tool pickers and server registries.

2.3 Product identity rule
The product name and server name should remain aligned. Do not create unnecessary naming drift such as:

product = Varinth

server = truth-engine

extension = receipt-checker

That kind of fragmentation is stupid and avoidable.

3. Supported transports
MCP clients commonly support different transports, and Cursor setup patterns explicitly allow transport selection such as stdio or server URL–based configurations.

3.1 Primary transport: stdio
Required for v1

Varinth should support stdio transport as the primary mode because:

Claude Desktop local MCP usage is built around local MCP server integration.

Cursor also supports adding MCP servers with stdio command-based configuration.

Local developer workflows are the main target.

3.2 Secondary transport: HTTP or SSE
Optional for v1, useful for v1.1+

Varinth may support HTTP/SSE transport for:

hosted/self-hosted deployments,

remote agents,

future shared team setups.

This is useful, but it is not the first battle.

4. Tool inventory
Varinth v1 should expose a minimal tool set. Do not ship ten tools when one or two can carry the product.

4.1 Required v1 tool
varinth_verify
This is the core tool. It audits an AI-generated answer against configured source-of-truth artifacts and returns structured claim-level results.

This tool alone is enough to make Varinth real.

4.2 Optional v1.1 / v2 tools
These should not block v1.

varinth_get_audit
Retrieve a previously stored audit run by ID.

varinth_list_sources
List configured contexts / source scopes available to the current runtime.

varinth_health
Return readiness/config status for debugging and setup validation.

These are useful but secondary.

5. Core tool definition
5.1 Tool name
varinth_verify

5.2 Tool description
Recommended tool description:

Audit an AI-generated engineering answer against configured code, documentation, and configuration sources. Returns claim-level verdicts and evidence.

This description should help both humans and models understand exactly when to call the tool.

5.3 Tool invocation intent
The tool should be invoked when the client has:

a user question,

a model-generated answer,

and a need to verify whether the answer is grounded in bounded project artifacts.

It should not be invoked for:

creative writing,

open-web fact-checking,

subjective opinion checking,

or conversational fluff.

6. Input schema
MCP tool contracts work better when the input schema is brutally explicit.

6.1 JSON schema shape
json
{
  "type": "object",
  "properties": {
    "question": {
      "type": "string",
      "description": "The original user question that the AI answered."
    },
    "answer": {
      "type": "string",
      "description": "The AI-generated answer to audit."
    },
    "context_id": {
      "type": "string",
      "description": "Optional configured workspace or project identifier."
    },
    "source_scope": {
      "type": "string",
      "description": "Optional hint narrowing verification to a subset such as backend, frontend, docs, or infra."
    },
    "answer_id": {
      "type": "string",
      "description": "Optional identifier for the answer being audited."
    },
    "max_claims": {
      "type": "integer",
      "description": "Optional limit on number of claims to extract and audit.",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": ["question", "answer"]
}
6.2 Field definitions
question
The original prompt or user request that led to the answer. This helps the claim extractor and can improve context.

answer
The AI-generated answer to audit. This is the core payload.

context_id
Optional identifier for a configured workspace, repo root, or project profile. Useful when multiple projects are available.

source_scope
Optional narrower source hint such as:

backend

frontend

docs

infra

answer_id
Optional tracing ID so clients can link audits to specific assistant responses.

max_claims
Optional cap to prevent absurdly large audits on giant answers.

7. Output schema
The output schema must be stable and machine-friendly. Clients can render it differently, but the contract must remain constant.

7.1 JSON schema shape
json
{
  "type": "object",
  "properties": {
    "audit_run_id": {
      "type": "string"
    },
    "global_score": {
      "type": "number"
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_claims": { "type": "integer" },
        "supported_count": { "type": "integer" },
        "contradicted_count": { "type": "integer" },
        "unverified_count": { "type": "integer" }
      }
    },
    "claims": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "claim_id": { "type": "string" },
          "text": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["structural", "config", "guarantee", "performance", "other"]
          },
          "verdict": {
            "type": "string",
            "enum": ["supported", "contradicted", "unverified"]
          },
          "confidence": { "type": "number" },
          "explanation": { "type": "string" },
          "evidence": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "evidence_id": { "type": "string" },
                "source_id": { "type": "string" },
                "source_type": {
                  "type": "string",
                  "enum": ["code", "doc", "config", "other"]
                },
                "location": { "type": "string" },
                "snippet": { "type": "string" },
                "relevance_score": { "type": "number" }
              },
              "required": ["source_id", "location", "snippet"]
            }
          }
        },
        "required": ["text", "type", "verdict", "evidence"]
      }
    },
    "warnings": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["audit_run_id", "summary", "claims"]
}
8. Output field semantics
8.1 audit_run_id
Unique ID for the audit execution. Used for logs, replay, and future retrieval tools.

8.2 global_score
A coarse trust metric summarizing the audit run. This should never pretend to be objective truth; it is only a convenience summary.

Example rule:

supported / total auditable claims

8.3 summary
High-level counts for fast client rendering.

8.4 claims
The actual heart of the output. Everything else is supporting structure.

8.5 warnings
Used for partial or degraded runs, such as:

“answer truncated before processing”

“source_scope not found; fallback to full context”

“claim limit reached”

9. Example request / response
9.1 Example request
json
{
  "question": "Explain how this backend handles authentication and persistence.",
  "answer": "This backend uses JWT authentication, Supabase PostgreSQL for persistence, and Celery workers for background jobs.",
  "context_id": "roast-backend",
  "source_scope": "backend",
  "max_claims": 10
}
9.2 Example response
json
{
  "audit_run_id": "audit_01JXYZ123",
  "global_score": 0.67,
  "summary": {
    "total_claims": 3,
    "supported_count": 2,
    "contradicted_count": 1,
    "unverified_count": 0
  },
  "claims": [
    {
      "claim_id": "claim_1",
      "text": "This backend uses JWT authentication.",
      "type": "structural",
      "verdict": "supported",
      "confidence": 0.95,
      "explanation": "JWT token creation and validation logic was found in the authentication module.",
      "evidence": [
        {
          "evidence_id": "ev_1",
          "source_id": "backend/auth/jwt.py",
          "source_type": "code",
          "location": "lines 12-49",
          "snippet": "def create_access_token(...); def verify_token(...);",
          "relevance_score": 0.97
        }
      ]
    },
    {
      "claim_id": "claim_2",
      "text": "This backend uses Supabase PostgreSQL for persistence.",
      "type": "config",
      "verdict": "supported",
      "confidence": 0.91,
      "explanation": "Supabase environment variables and database client usage were found.",
      "evidence": [
        {
          "evidence_id": "ev_2",
          "source_id": "backend/db/client.py",
          "source_type": "code",
          "location": "lines 5-31",
          "snippet": "supabase = create_client(SUPABASE_URL, SUPABASE_KEY)",
          "relevance_score": 0.94
        }
      ]
    },
    {
      "claim_id": "claim_3",
      "text": "This backend uses Celery workers for background jobs.",
      "type": "structural",
      "verdict": "contradicted",
      "confidence": 0.89,
      "explanation": "No Celery configuration or worker files were found; async background tasks appear to be implemented differently.",
      "evidence": [
        {
          "evidence_id": "ev_3",
          "source_id": "backend/tasks.py",
          "source_type": "code",
          "location": "lines 1-40",
          "snippet": "BackgroundTasks from FastAPI is used instead of Celery.",
          "relevance_score": 0.92
        }
      ]
    }
  ],
  "warnings": []
}
10. Error contract
A proper integration contract includes not just the happy path but also failure semantics.

10.1 Validation error
When required fields are missing or invalid.

Example:

json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Both 'question' and 'answer' are required."
  }
}
10.2 Configuration error
When the requested context or source scope is unavailable.

Example:

json
{
  "error": {
    "code": "SOURCE_SCOPE_NOT_FOUND",
    "message": "The requested source_scope 'backend' is not configured for context 'roast-backend'."
  }
}
10.3 Runtime error
When internal verification fails unexpectedly.

Example:

json
{
  "error": {
    "code": "INTERNAL_VERIFICATION_ERROR",
    "message": "Verification failed during evidence retrieval."
  }
}
10.4 Degraded success
If partial work completes, prefer successful response + warnings instead of hard failure.

That is usually the better UX for engineering tools.

11. Configuration model
11.1 Runtime configuration goals
The configuration model must support:

bounded source access,

secrets handling,

transport setup,

model/guardrail provider setup,

local installation simplicity.

11.2 Required environment variables
Recommended minimum:

VARINTH_CONTEXT_ROOTS – serialized mapping of context IDs to paths

VARINTH_DEFAULT_CONTEXT

VARINTH_LOG_LEVEL

VARINTH_STORAGE_URL

Optional if model-assisted extraction is enabled:

NVIDIA_API_KEY

OPENAI_API_KEY

ANTHROPIC_API_KEY

Optional if guardrails are enabled:

VARINTH_GUARDRAILS_ENABLED=true|false

11.3 Recommended local config file
Example:

json
{
  "contexts": {
    "roast-backend": {
      "root_path": "/Users/kush/project/roast",
      "scopes": {
        "backend": "backend",
        "docs": "docs",
        "infra": "deployment"
      }
    }
  },
  "defaults": {
    "context_id": "roast-backend",
    "max_claims": 12
  }
}
This config should be easy to understand and edit. Don’t make users solve a NASA launch problem just to point at a repo.

12. Claude Desktop integration spec
Claude Desktop supports local MCP servers and now also supports packaged desktop extensions for easier installation and configuration.

12.1 Manual local MCP setup
Varinth should support direct local registration in Claude Desktop as a MCP server.

Expected setup style:

server name

transport = stdio

command = Python or packaged executable

args = path to Varinth entrypoint

env = runtime environment variables

12.2 Desktop extension packaging
Varinth should also be packageable as a Claude Desktop extension so users can install it with minimal manual configuration.

Expected extension characteristics:

includes metadata and manifest,

supports Python server packaging if needed,

exposes user-friendly config fields for:

repo root / workspace paths,

API keys,

optional flags.

Claude Desktop extension systems support packaged local servers, configuration UI, secure handling of sensitive values, and simplified installation compared with manual JSON editing.

12.3 Packaging direction
The packaging goal for Varinth is:

v1 developer mode: manual MCP config

v1.1 demo-ready mode: packaged desktop extension

That’s the right order. First make it work. Then make it sexy.

13. Cursor integration spec
Cursor documents and ecosystem examples show MCP setup via settings or project MCP config, supporting transport selection and command-based server definitions.

13.1 Cursor setup modes
Varinth should support:

global MCP server setup through Cursor settings,

project-specific .cursor/mcp.json style configuration where relevant.

13.2 Expected stdio configuration pattern
Conceptually, Cursor config should allow:

server name = varinth

type = stdio

command = Python executable or packaged binary

args = path to Varinth server entrypoint

env = source and provider configuration

13.3 Cursor behavior assumptions
The Cursor agent may:

automatically use tools when relevant,

ask for approval before tool execution,

allow explicit prompts to call a given tool.

Because of this, the tool description for varinth_verify should be extremely clear about its purpose.

14. Tool design rules
These rules should guide final implementation.

14.1 One-tool-first rule
Do not dilute the product with too many tools. varinth_verify is the core.

14.2 Schema-first rule
All request and response contracts must be explicit and stable.

14.3 Evidence-required rule
No supported verdict without evidence. Ever.

14.4 Bounded-access rule
Source resolution must always respect configured boundaries.

14.5 Human-readable rule
Even though the output is structured JSON, each claim should also be explainable in plain English.

15. Future MCP extensions
These belong later, not now.

15.1 Future tool: varinth_compare_answers
Compare two different AI answers against the same source-of-truth.

15.2 Future tool: varinth_recheck_claim
Re-run verification on one specific claim.

15.3 Future tool: varinth_list_contexts
List configured project contexts and scopes.

15.4 Future resource support
Expose stored audits as MCP resources rather than only tool outputs.

These are good additions once the main tool is stable.

16. Final implementation stance
Varinth’s MCP layer should feel like a clean protocol product, not a hacky demo wrapper.

That means:

exact schemas,

predictable errors,

bounded config,

simple install story,

and one killer tool that does one job properly.

If the integration contract is sloppy, the whole product feels fake even if the backend is good