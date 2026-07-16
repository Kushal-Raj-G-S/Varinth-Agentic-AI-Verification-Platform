# Varinth Proof & Provenance Specification

This document defines the standardized **Proof System & Output Contract** for Varinth. It establishes a unified proof structure that follows a verification result across all product surfaces (Website, MCP Server, CLI, and API Integrations).

---

## 1. The Standardized Proof Object (JSON Schema)

Every verification run compiles a single, immutable, and self-contained **Proof Object** stored in the database. 

```json
{
  "proof_id": "uuid-v4",
  "audit_run_id": "uuid-v4",
  "metadata": {
    "project_slug": "string",
    "timestamp": "iso8601-date",
    "global_score": 0.85
  },
  "guardrail_trace": {
    "status": "passed | failed",
    "violations": [
      {
        "type": "prompt_injection | scope_violation",
        "detail": "string"
      }
    ]
  },
  "memory_trace": {
    "hits_count": 0,
    "details": [
      {
        "claim_index": 0,
        "similarity": 0.98,
        "cached_verdict": "supported"
      }
    ]
  },
  "agent_trace": {
    "critic_feedback_by_claim": {
      "claim_index_0": "Bulleted criticisms..."
    }
  },
  "claims_evidence": [
    {
      "claim_index": 0,
      "raw_text": "string",
      "normalized_text": "string",
      "verdict": "supported | contradicted | unverified",
      "confidence": 0.92,
      "explanation": "string",
      "evidence_matched": [
        {
          "source_id": "string",
          "location": "string",
          "snippet": "string",
          "relevance_score": 0.95,
          "supports_claim": true,
          "contradicts_claim": false
        }
      ]
    }
  ],
  "graph_trace": {
    "nodes_added": ["string"],
    "edges_added": ["string"]
  }
}
```

---

## 2. Database Integration (Supabase)

To separate transactional run details from bulky trace data, we introduce a dedicated `proofs` table:

```sql
CREATE TABLE IF NOT EXISTS public.proofs (
    proof_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_id UUID NOT NULL REFERENCES public.audit_runs(audit_run_id) ON DELETE CASCADE,
    project_slug TEXT NOT NULL,
    proof_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proofs_run ON public.proofs(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_proofs_project ON public.proofs(project_slug);
```

---

## 3. Surface Rendering Rules

| Surface | Display Format | Action / Interaction |
| :--- | :--- | :--- |
| **Website Dashboard** | **Rich visual Explorer** | Interactive graph rendering, claim-by-claim drill downs, highlight code snippet locations, step-by-step Critic log trace. |
| **MCP (Claude Desktop)** | **Inline Markdown Summary + Expandable Deep-Link** | Displays verdict, overall score, memory hit status, and outputs a resource URI: `varinth://proof/{proof_id}` clickable in compatible clients. |
| **API Consumer** | **Raw Structured JSON** | Returns the exact `Proof Object` payload directly in API response. |
| **IDE Plugin (Cursor)** | **Packaged Proof Card** | Embedded summary panel with deep link back to hosted web portal. |

---

## 4. MCP Response Protocol Specification

When Claude invokes `varinth_verify`, the MCP tool response must output:

```text
=========================================
VARINTH AUDIT VERDICT: SUPPORTED (85% Trust)
=========================================
Claim 1: Varinth uses Supabase.
[✅ Supported] Found at backend/app/core/database.py

Claim 2: It does not use SQLite.
[🧠 Memory Hit] Similarity 100% match. 

-----------------------------------------
Proof ID: c581d07b-84fd-43ed-b494-c186c5f0feae
Explore Full Interactive Proof Graph: 
http://localhost:3001/audits/c581d07b-84fd-43ed-b494-c186c5f0feae
=========================================
```
