# Varinth State Dump & Canonical Truth Map

## 1. Docs so far:
- **[varinth_proof_spec.md](file:///C:/Users/kushalrajgs/.gemini/antigravity-ide/brain/fb75216c-cf6b-4a5a-99eb-ceee9daee7ac/varinth_proof_spec.md)**: Defines the structured validation schemas for claims, evidence locations, and the mathematical formula for the Global Trust Score.
- **[supabase_profiles_schema.sql](file:///C:/Users/kushalrajgs/.gemini/antigravity-ide/brain/fb75216c-cf6b-4a5a-99eb-ceee9daee7ac/supabase_profiles_schema.sql)**: Contains the SQL schema definitions and Row-Level Security (RLS) policy configurations for all Supabase tables (`profiles`, `source_contexts`, `claims`, `evidence_items`, `verdict_results`, `graph_nodes`, `graph_edges`).
- **[implementation_plan.md](file:///C:/Users/kushalrajgs/.gemini/antigravity-ide/brain/fb75216c-cf6b-4a5a-99eb-ceee9daee7ac/implementation_plan.md)**: Details the design of the verification API, the dashboard layout, and the database schema hooks.
- **[walkthrough.md](file:///C:/Users/kushalrajgs/.gemini/antigravity-ide/brain/fb75216c-cf6b-4a5a-99eb-ceee9daee7ac/walkthrough.md)**: Outlines performance metrics showing the 3.5x speedup benchmarks (reduction from 108 seconds to 32 seconds) and the JudgeAgent explanation expansion.
- **[task.md](file:///C:/Users/kushalrajgs/.gemini/antigravity-ide/brain/fb75216c-cf6b-4a5a-99eb-ceee9daee7ac/task.md)**: tracks execution tasks completed for backend optimization.

## 2. Product in one paragraph:
Varinth is a cloud-native claim verification platform that cross-references AI-generated responses (code claims, architecture claims, API structures) against remote Git codebases. It uses an autonomous multi-agent swarm (Critic, Verifier, and Judge) and semantic file search to compile explicit location proofs and calculate a mathematical Global Trust Score, proving if an AI's statement is supported or contradicted.

## 3. Stack:
- **Backend**: FastAPI (Python 3.11+), Uvicorn, httpx, jose
- **Frontend**: Next.js 16 (App Router), TypeScript, TailwindCSS + Vanilla CSS
- **DB**: Supabase PostgreSQL
- **Graph**: Relational Knowledge Graph tables (`graph_nodes`, `graph_edges`) inside Supabase
- **Vector**: Nvidia NIM Embeddings API (`nvidia/nv-embedqa-e5-v5`)
- **LLM**: Nvidia NIM Chat API (`meta/llama-3.3-70b-instruct`)
- **Auth**: Supabase Auth (JWT session keys)
- **Storage**: Temporary disk allocation (`tempfile.mkdtemp`) for secure cloning and auditing per request
- **Deploy**: Vercel (Frontend), Fly.io or Render (Backend)

## 4. Already built:
- **Database Schema & RLS**: Fully defined tables with `auth.uid() = user_id` row-level policies.
- **Token Verification**: Supabase integration that dynamically verifies JWT tokens against the Auth API.
- **Remote Git Cloner**: Clones arbitrary repositories on request using shallow depth (`--depth 1`) and performs automatic cleanup.
- **Concurrently Search & Batch Write**: Runs evidence index retrieval in parallel and batches all DB calls (reducing database writes from 350+ to 4 calls per run).
- **Multi-Agent Swarm**: Fully functional Critic-Verifier-Judge swarm pipeline running under 33 seconds.
- **SaaS Repository Registry UI**: Supports registering GitHub/GitLab repositories with validation, badging, and status flags.
- **Deep-Link Verdict Dashboard**: Renders trust gauges, claim verdict cards, and detailed code-snippet proof alignments.

## 5. Undecided:
- **PR Ingestion Mechanics**: Whether we trigger PR validation via GitHub Webhooks (active service) or GitHub Actions (CI/CD runner).
- **Enterprise Local Directory Sync**: A protocol (like local daemon/CLI) to let developers index private enterprise codebases locally and sync metadata without uploading raw code to the cloud.
- **Embedding Store Persistence**: Whether we persist file embeddings in Supabase's `pgvector` or keep indexes transient (rebuilding embeddings on request).
- **Billing Tier Gates**: Limitations on repository clone size, file limits, or concurrent agent invocations.

## 6. Primary user:
AI-native developers and software reviewers in teams who copy-paste code suggestions from LLMs (or run agentic codegen tools like Cursor/Aider) and need to guarantee correctness before merging changes.

## 7. First workflow to win:
**Verify-Answer Mode**: The developer registers a GitHub repo, pastes their question and the AI's generated response, runs the swarm audit, and gets a detailed, shareable verification report.

## 8. Constraints:
- **Budget**: Running on limited NVIDIA NIM API credits.
- **Time**: Verification must complete in under 45 seconds (currently at ~32s).
- **Infra**: Temporary directory disk size limitations (cannot hold gigabyte-scale repositories without memory limits).
- **API limits**: NVIDIA rate caps (max 40 RPM, managed via a client token bucket).
