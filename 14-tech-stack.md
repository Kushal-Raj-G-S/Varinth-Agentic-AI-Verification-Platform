# Varinth – Technology Stack & Tooling Decisions

## 1. Purpose of this document

This document defines the official technology stack for **Varinth** and explains where each approved technology should be used in the product.

It exists to prevent stack drift during implementation and to stop builders from making random substitutions that damage architectural clarity. Architecture documentation should capture key technology choices, where they apply, and why they were selected, because these decisions shape maintainability, implementation speed, and system quality.[1][2]

This document covers:

- frontend stack,
- backend stack,
- database and backend platform decisions,
- authentication and storage,
- LLM provider strategy,
- protocol and integration layers,
- infrastructure direction,
- and stack selection rules.

This is not a generic list of tools. It is the **official technology usage contract** for Varinth.

***

## 2. Product implementation stance

Varinth should be built as a **finished product**, not as a temporary local-only tool.

That means the stack should support:

- a hosted web application,
- real user accounts,
- persistent audit history,
- authentication,
- storage-backed product features,
- structured backend services,
- and production-ready extensibility.

The architecture should still remain disciplined, but it should no longer be framed as “local-first.” The correct framing is:

> Varinth is a production-oriented verification product with MCP integration, not merely a local experiment.

***

## 3. Official stack summary

The approved technology stack for Varinth is:

- **Frontend:** Next.js
- **Backend:** Python with FastAPI
- **Primary backend platform:** Supabase
- **Database:** Supabase Postgres
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **LLM provider for initial v1 default:** NVIDIA API
- **Protocol layer:** MCP + internal HTTP APIs

This stack is chosen because it matches the actual product direction: a finished app with real product surfaces, real persistence, and AI-native workflow integration.

***

## 4. Stack philosophy

Varinth is a verification product first, but it is also intended to be a complete user-facing application.

So the stack must optimize for both:

- **product completeness**, and
- **verification quality**.

That means:

- use a strong frontend framework for polished user-facing workflows,
- use Python for the verification engine and AI-heavy backend logic,
- use a backend platform that already provides auth and storage,
- and keep the LLM layer replaceable.

The point is not to use the most technologies. The point is to use the right ones in the right places.

***

## 5. Frontend: Next.js

### 5.1 Decision

**Next.js** is the official frontend framework for Varinth.

### 5.2 Why Next.js

Next.js is the right choice because Varinth needs a serious web product surface, not just a debug page.

It is well suited for:

- audit dashboards,
- user-facing account flows,
- workspace and settings pages,
- report viewing,
- configuration forms,
- and polished product UI.

### 5.3 Where Next.js should be used

Use Next.js for:

- the main web application,
- authentication-aware pages,
- audit inspection UI,
- run history views,
- source context and scope management screens,
- billing or workspace pages later if needed,
- and any public-facing product website or app shell.

### 5.4 Where Next.js should not be used

Do **not** use Next.js for:

- core verification logic,
- evidence retrieval,
- verdict assignment,
- or model orchestration.

That logic belongs in the backend.

***

## 6. Backend: Python + FastAPI

### 6.1 Decision

**Python** is the official backend language for Varinth, and **FastAPI** is the preferred backend framework.

### 6.2 Why Python

Python is the correct backend language because Varinth’s hardest problems are AI-adjacent and pipeline-oriented:

- claim extraction,
- structured prompt execution,
- evidence retrieval,
- verdict logic,
- scoring,
- evaluation harnesses,
- and potential future retrieval/reranking workflows.

Python is still the most practical ecosystem for this kind of system work.

### 6.3 Why FastAPI

FastAPI is the right fit because Varinth needs:

- typed request/response models,
- internal APIs,
- clean backend service design,
- async-friendly execution,
- and clear schema-based contracts.

This aligns directly with the API-contract-oriented architecture already defined for the product.

### 6.4 Where Python + FastAPI should be used

Use Python + FastAPI for:

- audit execution services,
- verification engine logic,
- claim extraction pipelines,
- evidence retrieval and filtering,
- verdict assignment,
- structured logging,
- evaluation services,
- report generation endpoints,
- MCP-facing backend services where applicable,
- and internal APIs consumed by the frontend.

### 6.5 Where Python + FastAPI should not be used

Do **not** force frontend rendering, page composition, or user-interface state management into the Python backend.

The backend should focus on:

- verification,
- APIs,
- persistence orchestration,
- and service logic.

***

## 7. Primary backend platform: Supabase

### 7.1 Decision

**Supabase** is the official backend platform for Varinth.

### 7.2 Why Supabase

Supabase is the best default platform because Varinth is intended to be a finished product with:

- authentication,
- persisted user data,
- audit history,
- stored artifacts,
- and a production-ready Postgres foundation.

Supabase provides Postgres as a development platform and includes product-facing building blocks such as Auth and Storage.[3][4]

### 7.3 Why Supabase is the right default now

Once the goal becomes “fully finished product,” choosing only a database is not enough. A production product needs:

- user accounts,
- session management,
- user-to-data ownership,
- storage-backed features,
- and a consistent backend platform.

Supabase solves these in one coherent system instead of forcing separate vendors for every product concern.[3][5][6]

***

## 8. Database: Supabase Postgres

### 8.1 Decision

**Supabase Postgres** is the official primary database for Varinth.

### 8.2 Why Postgres fits the product

Varinth’s persistence model is strongly relational. It stores:

- audit runs,
- claims,
- evidence items,
- verdict results,
- warnings,
- execution traces,
- and user/workspace-linked product data.

This is structured relational data first, so Postgres is the correct foundation.

### 8.3 Where Supabase Postgres should be used

Use Supabase Postgres for:

- core application data,
- audit persistence,
- claim and evidence storage,
- verdict history,
- user-linked project/workspace records,
- evaluation benchmarks,
- and operational metadata.

### 8.4 Why this is better than a database-only choice

A standalone Postgres provider is fine for tool-style products, but Varinth now aims to be a real user-facing application. Supabase Postgres fits better because it sits inside the same platform as auth and storage, reducing backend fragmentation.[3][4]

***

## 9. Authentication: Supabase Auth

### 9.1 Decision

**Supabase Auth** is the official authentication layer for Varinth.

### 9.2 Why Supabase Auth

A finished product needs real authentication and user management.

Supabase Auth is the correct choice because Varinth will likely need:

- user registration and login,
- session handling,
- account-linked audit history,
- workspace-based access patterns later,
- and identity tied cleanly to Postgres-backed product data.[7][8][9]

### 9.3 Where Supabase Auth should be used

Use Supabase Auth for:

- login and session management,
- protected application routes,
- account ownership of audit history,
- user-linked source contexts,
- and future workspace/team identity layers.

### 9.4 Important boundary

Supabase Auth should handle identity and session concerns. Core verification logic should still remain in the Python backend.

***

## 10. Storage: Supabase Storage

### 10.1 Decision

**Supabase Storage** is the official object storage layer for Varinth.

### 10.2 Why Supabase Storage

A finished product may need storage for:

- uploaded documents,
- evidence artifacts,
- generated reports,
- exported audit files,
- and future media or attachment handling.

Supabase Storage is appropriate because it integrates with access-control patterns tied to the broader Supabase stack, including policy-based restrictions.[10][6]

### 10.3 Where Supabase Storage should be used

Use Supabase Storage for:

- uploaded verification artifacts,
- stored report exports,
- saved evidence bundles,
- and any durable product file/object storage requirement.

***

## 11. LLM provider strategy

### 11.1 Official initial default

The official initial LLM provider for Varinth is:

- **NVIDIA API**

### 11.2 Why NVIDIA API is acceptable for v1

The NVIDIA API is acceptable as the initial default provider because it offers a practical low-cost entry point for early product development and controlled production usage.

### 11.3 Architectural rule

Varinth must remain **provider-agnostic** even if NVIDIA is the starting provider.

The product should be described as:

- using NVIDIA API as the **initial default provider**, not
- permanently coupled to NVIDIA.

### 11.4 Why provider-agnostic matters

Provider constraints change. Rate limits, model quality, latency, and pricing can all shift. If the architecture is too tightly coupled to one provider, the backend becomes hard to evolve.

### 11.5 Operational implication

If NVIDIA API usage is constrained by a limit such as **40 requests per minute**, that should be handled through:

- queueing,
- retries,
- batching where appropriate,
- concurrency control,
- and fallback-ready architecture.

It should not distort the rest of the system design.

***

## 12. Where the LLM should be used

Use the LLM only for bounded tasks such as:

- claim extraction,
- structured explanation generation,
- optional structured output repair,
- and tightly controlled summarization.

Do **not** allow the LLM to become the unrestricted final truth engine.

Verdicts must remain constrained by evidence-backed logic and explicit system rules.

***

## 13. Protocol layer: MCP + internal HTTP APIs

### 13.1 Decision

Varinth should expose two complementary interface layers:

- **MCP** for AI-client workflow integration
- **internal HTTP APIs** for product/backend/frontend communication

### 13.2 Why this matters

This split is correct because the product has two audiences:

- AI-native clients that need verification as a tool,
- and the Varinth web product itself, which needs structured backend APIs.

### 13.3 Where MCP should be used

Use MCP for:

- integrations with Claude Desktop,
- integrations with Cursor,
- and any AI-assistant workflow where verification is invoked as a tool.

### 13.4 Where internal HTTP APIs should be used

Use internal HTTP APIs for:

- frontend-to-backend communication,
- audit run creation and retrieval,
- user-facing dashboard data,
- settings and context management,
- and product-facing internal services.

***

## 14. Infrastructure direction

### 14.1 Production-first stance

Varinth should be built with a production-first mindset.

That means the architecture should assume:

- a hosted frontend,
- a deployed backend service,
- a managed Postgres platform,
- authenticated users,
- persistent storage,
- and durable product data.

### 14.2 What this does not mean

Production-first does **not** mean overengineering.

It does not justify adding:

- Kubernetes on day one,
- microservices everywhere,
- event buses without a real need,
- or infra complexity for status-signaling alone.

Finished product does not mean bloated product.

***

## 15. Official stack recommendation by layer

| Layer | Official choice | Why |
|---|---|---|
| Frontend | Next.js | Best fit for polished app UI and product surfaces |
| Backend | Python + FastAPI | Best fit for AI-heavy verification logic and APIs |
| Database | Supabase Postgres | Strong relational foundation within the app platform |
| Auth | Supabase Auth | Clean identity/session integration |
| Storage | Supabase Storage | Native object storage for product artifacts |
| LLM provider | NVIDIA API (initial default) | Practical early provider with provider-agnostic architecture |
| AI protocol integration | MCP | Native interface for assistant-driven workflows |
| Product service interface | Internal HTTP APIs | Required for web app and backend coordination |

***

## 16. Technology usage rules

Use these rules to prevent implementation confusion.

### Rule 1
If the feature is a user-facing web experience, dashboard, settings page, or account flow → use **Next.js**.

### Rule 2
If the feature is verification logic, claim extraction, evidence retrieval, verdict assignment, scoring, or backend orchestration → use **Python + FastAPI**.

### Rule 3
If the feature requires relational persistence of product data, audit data, or structured records → use **Supabase Postgres**.

### Rule 4
If the feature requires login, user identity, session handling, or ownership control → use **Supabase Auth**.

### Rule 5
If the feature requires persistent file/object storage → use **Supabase Storage**.

### Rule 6
If the feature uses model reasoning or extraction → use the **LLM provider abstraction**, with NVIDIA API as the initial default provider.

### Rule 7
If the integration target is an AI client like Claude Desktop or Cursor → use **MCP**.

### Rule 8
If the communication is between frontend and backend services → use **internal HTTP APIs**.

***

## 17. Non-approved premature additions

The following should not be introduced casually in v1 unless a specific and proven need exists:

- Kubernetes
- Kafka
- separate vector database before retrieval actually requires it
- graph database as primary storage
- heavy microservice decomposition
- multiple backend languages
- broad cloud-service sprawl
- infrastructure chosen only for “enterprise look”

These are common ways of making a product look advanced while actually slowing it down.

***

## 18. Final stack statement

Varinth should be built with a clean production-ready stack:

- **Next.js** for frontend product surfaces,
- **Python + FastAPI** for backend and verification logic,
- **Supabase** as the primary backend platform,
- **Supabase Postgres** for structured persistence,
- **Supabase Auth** for identity and session management,
- **Supabase Storage** for product artifacts,
- **NVIDIA API** as the initial default LLM provider in a provider-agnostic architecture,
- and **MCP + internal HTTP APIs** as the two interface layers.

This is the correct stack for a product that intends to ship as a finished system rather than remain a developer-side experiment.