Here’s 13-varinth-api-contracts.md in full.

API contract docs should define stable endpoints, request/response schemas, status codes, and consistent error shapes so implementations and clients don’t drift apart. Good API design also keeps error responses structured and aligned to appropriate HTTP status codes instead of throwing vague failures everywhere.

Copy this directly into your markdown file.

Varinth – Internal API Contracts
1. Purpose of this document
This document defines the internal HTTP API contracts for Varinth.

It exists to standardize:

endpoint behavior,

request and response formats,

validation rules,

error handling,

status codes,

and payload structures.

This document is not the MCP spec.
The MCP spec defines how external MCP clients invoke Varinth as a tool.
This document defines the internal service contracts that a backend, CLI bridge, local UI, test harness, or adapter layer can rely on.

The goal is simple:

One product, one set of stable service contracts.

Without this, every interface grows its own half-broken version of the truth.

2. API design principles
2.1 Contracts must be stable
If a response shape changes, that is a contract change.
Do not casually rename fields or restructure payloads once the contract is in use.

2.2 JSON only
Varinth internal APIs should use JSON request and response bodies.

Content type:

text
Content-Type: application/json
This keeps the local toolchain simple and predictable.

2.3 Deterministic error shapes
Error responses must use a consistent schema rather than random exception dumps. Consistent status codes and structured error bodies are standard best practice in REST API design because clients need predictable failure modes they can act on.

2.4 Resource names should be explicit
Endpoints should use clear resource naming rather than vague action soup.

2.5 Human-readable plus machine-readable errors
Every error response should include:

the HTTP status code,

a machine-readable error code,

a human-readable message,

and optional structured details.

2.6 Internal API is not permissionless freeform
These contracts exist for known product workflows:

audit submission,

audit retrieval,

context/scope configuration,

health checks,

and diagnostics.

This is not a generic arbitrary-query backend.

3. Base conventions
3.1 Base path
Recommended base path:

text
/api/v1
Example:

text
/api/v1/audits
Versioning through URL paths is common and practical for service evolution.

3.2 Content type
All request and response bodies use:

text
Content-Type: application/json
3.3 Time format
All timestamps should use ISO 8601 UTC strings.

Example:

json
"created_at": "2026-07-11T16:48:21Z"
3.4 Identifier format
Identifiers may be UUIDs or stable string IDs.

Examples:

audit_01J2V7...

ctx_01J2V8...

claim_01J2V9...

The implementation can choose the exact format, but it must remain stable within one deployment.

4. Global response envelopes
Varinth may return either raw resource objects or wrapped responses. For consistency, wrapped responses are recommended for internal APIs.

4.1 Success envelope
json
{
  "success": true,
  "data": {}
}
4.2 Error envelope
json
{
  "success": false,
  "error": {
    "status": 400,
    "code": "invalid_request",
    "message": "The request body is invalid.",
    "details": {}
  }
}
Structured error envelopes are useful because clients can inspect both the HTTP code and an application-specific error code.

5. Error model
5.1 Error object schema
Field	Type	Required	Description
status	integer	Yes	HTTP status code
code	string	Yes	Stable machine-readable error code
message	string	Yes	Human-readable explanation
details	object	No	Extra structured metadata
request_id	string	No	Optional request correlation ID
5.2 Recommended error codes
Error code	Meaning	Typical HTTP status
invalid_request	Malformed JSON or invalid payload	400
validation_error	Schema validation failure	400
context_not_found	Source context does not exist	404
scope_not_found	Source scope does not exist	404
audit_not_found	Audit run does not exist	404
conflict	Resource state conflict	409
unsupported_media_type	Wrong content type	415
internal_error	Unexpected server failure	500
retrieval_failure	Evidence retrieval failed	500 or 502-style internal mapping
timeout	Internal processing timed out	504 or mapped service timeout
not_implemented	Feature not yet available	501
5.3 HTTP status guidance
Practical REST guidance usually recommends using a small, consistent set of meaningful status codes rather than spraying obscure ones everywhere.

Use these cleanly:

200 OK

201 Created

400 Bad Request

404 Not Found

409 Conflict

415 Unsupported Media Type

422 Unprocessable Entity if you choose semantic validation separation

500 Internal Server Error

504 Gateway Timeout or equivalent internal timeout mapping

6. Endpoint overview
Core internal endpoints:

POST /api/v1/audits

GET /api/v1/audits/{audit_run_id}

GET /api/v1/audits/{audit_run_id}/claims

GET /api/v1/audits/{audit_run_id}/summary

GET /api/v1/contexts

POST /api/v1/contexts

GET /api/v1/contexts/{source_context_id}

POST /api/v1/contexts/{source_context_id}/scopes

GET /api/v1/scopes/{source_scope_id}

GET /api/v1/health

Optional later:

GET /api/v1/audits/{audit_run_id}/events

GET /api/v1/audits/{audit_run_id}/warnings

7. POST /api/v1/audits
7.1 Purpose
Create and execute a new audit run.

This is the core execution endpoint.

7.2 Request body
json
{
  "question": "How does authentication work in this backend?",
  "answer": "This backend uses JWT authentication and stores sessions in Redis.",
  "source_context_id": "ctx_backend_001",
  "source_scope_id": "scope_auth_001",
  "requested_max_claims": 10,
  "client_name": "claude-desktop",
  "transport_type": "stdio",
  "metadata": {
    "answer_id": "msg_123"
  }
}
7.3 Field definitions
Field	Type	Required	Description
question	string	Yes	Original question asked to the AI
answer	string	Yes	AI-generated answer to audit
source_context_id	string	No	Configured verification context
source_scope_id	string	No	Optional narrowed scope
requested_max_claims	integer	No	Max number of claims to process
client_name	string	No	Calling client name
transport_type	string	No	stdio, http, sse, other
metadata	object	No	Additional invocation metadata
7.4 Validation rules
question must be non-empty.

answer must be non-empty.

requested_max_claims must be positive if provided.

source_scope_id must belong to the provided source_context_id if both are provided.

Content type must be JSON.

7.5 Success response
Status:

text
201 Created
Body:

json
{
  "success": true,
  "data": {
    "audit_run_id": "audit_001",
    "status": "completed",
    "question": "How does authentication work in this backend?",
    "answer": "This backend uses JWT authentication and stores sessions in Redis.",
    "source_context_id": "ctx_backend_001",
    "source_scope_id": "scope_auth_001",
    "global_score": 0.62,
    "started_at": "2026-07-11T16:50:00Z",
    "completed_at": "2026-07-11T16:50:01Z",
    "duration_ms": 935,
    "warnings": [
      {
        "code": "AMBIGUOUS_EVIDENCE",
        "message": "One or more claims had insufficient evidence for a conclusive verdict."
      }
    ]
  }
}
7.6 Error responses
Invalid request
text
400 Bad Request
json
{
  "success": false,
  "error": {
    "status": 400,
    "code": "validation_error",
    "message": "The request body is invalid.",
    "details": {
      "field_errors": {
        "question": ["This field is required."]
      }
    }
  }
}
Context not found
text
404 Not Found
json
{
  "success": false,
  "error": {
    "status": 404,
    "code": "context_not_found",
    "message": "The specified source context was not found."
  }
}
8. GET /api/v1/audits/{audit_run_id}
8.1 Purpose
Retrieve the full top-level audit run record.

8.2 Path params
Param	Type	Required	Description
audit_run_id	string	Yes	Audit run identifier
8.3 Success response
text
200 OK
json
{
  "success": true,
  "data": {
    "audit_run_id": "audit_001",
    "status": "completed",
    "question": "How does authentication work in this backend?",
    "answer": "This backend uses JWT authentication and stores sessions in Redis.",
    "source_context_id": "ctx_backend_001",
    "source_scope_id": "scope_auth_001",
    "global_score": 0.62,
    "started_at": "2026-07-11T16:50:00Z",
    "completed_at": "2026-07-11T16:50:01Z",
    "duration_ms": 935
  }
}
8.4 Not found response
text
404 Not Found
json
{
  "success": false,
  "error": {
    "status": 404,
    "code": "audit_not_found",
    "message": "The requested audit run does not exist."
  }
}
9. GET /api/v1/audits/{audit_run_id}/claims
9.1 Purpose
Retrieve all extracted claims for an audit run, including verdict and evidence details.

9.2 Success response
text
200 OK
json
{
  "success": true,
  "data": {
    "audit_run_id": "audit_001",
    "claims": [
      {
        "claim_id": "claim_001",
        "claim_index": 1,
        "raw_text": "This backend uses JWT authentication.",
        "normalized_text": "The backend uses JWT authentication.",
        "claim_type": "structural",
        "importance": "high",
        "verdict": {
          "verdict": "supported",
          "confidence": 0.89,
          "explanation": "Supported because JWT authentication logic is present in backend/auth.py."
        },
        "evidence": [
          {
            "evidence_id": "evidence_001",
            "source_type": "code",
            "source_id": "backend/auth.py",
            "location": "lines 22-61",
            "snippet": "def create_access_token(...): ...",
            "relevance_score": 0.93
          }
        ]
      },
      {
        "claim_id": "claim_002",
        "claim_index": 2,
        "raw_text": "This backend stores sessions in Redis.",
        "normalized_text": "The backend stores sessions in Redis.",
        "claim_type": "config",
        "importance": "medium",
        "verdict": {
          "verdict": "unverified",
          "confidence": 0.31,
          "explanation": "No sufficient evidence was found to support or contradict the claim."
        },
        "evidence": []
      }
    ]
  }
}
9.3 Notes
This endpoint is the most useful for:

local dashboards,

CLI pretty-printers,

MCP-to-UI bridges,

and debugging tools.

10. GET /api/v1/audits/{audit_run_id}/summary
10.1 Purpose
Retrieve a compact summary of an audit run.

Useful for:

dashboards,

history lists,

audit previews,

compact MCP status displays.

10.2 Success response
json
{
  "success": true,
  "data": {
    "audit_run_id": "audit_001",
    "status": "completed",
    "global_score": 0.62,
    "claim_counts": {
      "total": 5,
      "supported": 2,
      "contradicted": 1,
      "unverified": 2
    },
    "warning_count": 1,
    "started_at": "2026-07-11T16:50:00Z",
    "completed_at": "2026-07-11T16:50:01Z"
  }
}
11. GET /api/v1/contexts
11.1 Purpose
List configured source contexts.

11.2 Success response
json
{
  "success": true,
  "data": {
    "contexts": [
      {
        "source_context_id": "ctx_backend_001",
        "name": "My Backend",
        "slug": "my-backend",
        "root_path": "/projects/my-backend",
        "is_active": true,
        "created_at": "2026-07-11T10:00:00Z",
        "updated_at": "2026-07-11T10:00:00Z"
      }
    ]
  }
}
12. POST /api/v1/contexts
12.1 Purpose
Create a new source context.

12.2 Request body
json
{
  "name": "My Backend",
  "slug": "my-backend",
  "root_path": "/projects/my-backend",
  "description": "Primary backend repo"
}
12.3 Validation rules
name is required.

slug is required and must be unique.

root_path is required.

root_path should resolve to an allowed local path depending on deployment policy.

12.4 Success response
text
201 Created
json
{
  "success": true,
  "data": {
    "source_context_id": "ctx_backend_001",
    "name": "My Backend",
    "slug": "my-backend",
    "root_path": "/projects/my-backend",
    "description": "Primary backend repo",
    "is_active": true,
    "created_at": "2026-07-11T10:00:00Z",
    "updated_at": "2026-07-11T10:00:00Z"
  }
}
12.5 Conflict response
text
409 Conflict
json
{
  "success": false,
  "error": {
    "status": 409,
    "code": "conflict",
    "message": "A source context with this slug already exists.",
    "details": {
      "slug": "my-backend"
    }
  }
}
Using 409 Conflict for uniqueness or state conflicts is standard practice in REST APIs.

13. GET /api/v1/contexts/{source_context_id}
13.1 Purpose
Retrieve one configured source context.

13.2 Success response
json
{
  "success": true,
  "data": {
    "source_context_id": "ctx_backend_001",
    "name": "My Backend",
    "slug": "my-backend",
    "root_path": "/projects/my-backend",
    "description": "Primary backend repo",
    "is_active": true,
    "created_at": "2026-07-11T10:00:00Z",
    "updated_at": "2026-07-11T10:00:00Z"
  }
}
14. POST /api/v1/contexts/{source_context_id}/scopes
14.1 Purpose
Create a scope inside a source context.

14.2 Request body
json
{
  "name": "Backend",
  "slug": "backend",
  "relative_path": "backend/",
  "scope_type": "code"
}
14.3 Validation rules
name required

slug required

relative_path required

scope_type must be one of:

code

doc

config

mixed

14.4 Success response
json
{
  "success": true,
  "data": {
    "source_scope_id": "scope_backend_001",
    "source_context_id": "ctx_backend_001",
    "name": "Backend",
    "slug": "backend",
    "relative_path": "backend/",
    "scope_type": "code",
    "is_active": true,
    "created_at": "2026-07-11T10:05:00Z",
    "updated_at": "2026-07-11T10:05:00Z"
  }
}
15. GET /api/v1/scopes/{source_scope_id}
15.1 Purpose
Retrieve one source scope.

15.2 Success response
json
{
  "success": true,
  "data": {
    "source_scope_id": "scope_backend_001",
    "source_context_id": "ctx_backend_001",
    "name": "Backend",
    "slug": "backend",
    "relative_path": "backend/",
    "scope_type": "code",
    "is_active": true,
    "created_at": "2026-07-11T10:05:00Z",
    "updated_at": "2026-07-11T10:05:00Z"
  }
}
16. GET /api/v1/health
16.1 Purpose
Return service health information.

This endpoint is for:

local diagnostics,

startup verification,

test harnesses,

and basic monitoring.

16.2 Success response
json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "varinth",
    "version": "0.1.0",
    "time": "2026-07-11T16:55:00Z"
  }
}
16.3 Optional expanded health response
Later versions may include:

database connectivity,

retrieval backend readiness,

prompt/model subsystem availability,

configuration validity.

But v1 should keep it simple.

17. Optional future endpoints
These are useful but not required for the first internal API version.

17.1 GET /api/v1/audits/{audit_run_id}/events
Returns execution events for debugging.

17.2 GET /api/v1/audits/{audit_run_id}/warnings
Returns warnings separately.

17.3 DELETE /api/v1/audits/{audit_run_id}
Delete an audit run if retention policies allow it.

17.4 PATCH /api/v1/contexts/{source_context_id}
Update context metadata.

These are nice-to-haves, not day-one requirements.

18. Validation rules summary
API request validation should happen before business logic execution whenever possible.

18.1 Request-level validation
Content type must be JSON.

Required fields must be present.

Strings must not be empty when non-empty values are required.

Enum values must be valid.

Numeric bounds must be enforced.

18.2 Referential validation
source_context_id must exist if provided.

source_scope_id must exist if provided.

source_scope_id must belong to the referenced context if both are supplied.

Requested resources must exist for GET routes.

18.3 Business validation
Verification cannot run without both question and answer.

requested_max_claims must be greater than zero if provided.

Context root and scope path must satisfy deployment path rules.

19. Error response examples
19.1 Unsupported content type
text
415 Unsupported Media Type
json
{
  "success": false,
  "error": {
    "status": 415,
    "code": "unsupported_media_type",
    "message": "Content-Type must be application/json."
  }
}
19.2 Scope not found
text
404 Not Found
json
{
  "success": false,
  "error": {
    "status": 404,
    "code": "scope_not_found",
    "message": "The specified source scope was not found."
  }
}
19.3 Internal failure
text
500 Internal Server Error
json
{
  "success": false,
  "error": {
    "status": 500,
    "code": "internal_error",
    "message": "An unexpected internal error occurred."
  }
}
19.4 Timeout
text
504 Gateway Timeout
json
{
  "success": false,
  "error": {
    "status": 504,
    "code": "timeout",
    "message": "The audit request timed out before completion."
  }
}
Consistent, structured error payloads make client behavior easier to implement and debug.

20. Field naming conventions
20.1 JSON naming style
Use snake_case consistently across request and response payloads.

Examples:

audit_run_id

source_context_id

requested_max_claims

Do not mix:

camelCase

PascalCase

and snake_case

That is how APIs become annoying.

20.2 Enum values
Enum values should always be lowercase snake_case where multiple words are needed.

Examples:

not_implemented

unsupported_media_type

21. Contract change policy
Once these APIs are used by internal adapters or UI layers, changes should be treated carefully.

Rule
Breaking changes include:

renaming fields,

changing types,

moving nested objects,

removing fields,

changing enum values,

changing endpoint semantics.

If a breaking change is required:

version it,

document it,

and do not silently mutate behavior.

22. Final contract philosophy
Varinth’s internal API should feel boring in the best possible way:

predictable,

strict,

easy to validate,

easy to debug,

and hard to misuse.

Because if the verification engine has sloppy service contracts, the rest of the system will rot around it.