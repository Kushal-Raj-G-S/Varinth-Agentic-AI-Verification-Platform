-- ============================================================
-- Varinth – Supabase Postgres Schema
-- v1.0.0
-- ============================================================
-- Run this against your Supabase project via:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE claim_type_enum AS ENUM (
  'structural', 'config', 'guarantee', 'performance', 'other'
);

CREATE TYPE verdict_enum AS ENUM (
  'supported', 'contradicted', 'unverified'
);

CREATE TYPE audit_status_enum AS ENUM (
  'pending', 'running', 'completed', 'failed', 'partial'
);

CREATE TYPE source_type_enum AS ENUM (
  'code', 'doc', 'config', 'other'
);

CREATE TYPE scope_type_enum AS ENUM (
  'code', 'doc', 'config', 'mixed'
);

CREATE TYPE warning_severity_enum AS ENUM (
  'info', 'warning', 'error'
);

CREATE TYPE importance_enum AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE execution_stage_enum AS ENUM (
  'input', 'extract', 'retrieve', 'verdict', 'output', 'persist'
);

CREATE TYPE prompt_status_enum AS ENUM (
  'success', 'failed', 'skipped'
);

CREATE TYPE transport_type_enum AS ENUM (
  'stdio', 'http', 'sse', 'other'
);

-- ============================================================
-- TABLE: source_contexts
-- ============================================================

CREATE TABLE source_contexts (
  source_context_id  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT         NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 128),
  slug               TEXT         NOT NULL CHECK (slug ~ '^[a-z0-9_-]{1,64}$'),
  root_path          TEXT         NOT NULL CHECK (char_length(root_path) > 0),
  description        TEXT,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT source_contexts_user_slug_unique UNIQUE (user_id, slug)
);

CREATE UNIQUE INDEX idx_source_contexts_slug ON source_contexts (user_id, slug);
CREATE INDEX idx_source_contexts_user_active ON source_contexts (user_id, is_active);

CREATE TRIGGER source_contexts_updated_at
  BEFORE UPDATE ON source_contexts
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE source_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_contexts_select ON source_contexts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY source_contexts_insert ON source_contexts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY source_contexts_update ON source_contexts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY source_contexts_delete ON source_contexts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: source_scopes
-- ============================================================

CREATE TABLE source_scopes (
  source_scope_id    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_context_id  UUID            NOT NULL REFERENCES source_contexts(source_context_id) ON DELETE CASCADE,
  user_id            UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT            NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 128),
  slug               TEXT            NOT NULL CHECK (slug ~ '^[a-z0-9_-]{1,64}$'),
  relative_path      TEXT            NOT NULL,
  scope_type         scope_type_enum NOT NULL,
  is_active          BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT source_scopes_context_slug_unique UNIQUE (source_context_id, slug)
);

CREATE INDEX idx_source_scopes_context ON source_scopes (source_context_id, is_active);
CREATE INDEX idx_source_scopes_user ON source_scopes (user_id);

CREATE TRIGGER source_scopes_updated_at
  BEFORE UPDATE ON source_scopes
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE source_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_scopes_select ON source_scopes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY source_scopes_insert ON source_scopes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY source_scopes_update ON source_scopes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY source_scopes_delete ON source_scopes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: audit_runs
-- ============================================================

CREATE TABLE audit_runs (
  audit_run_id          UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID                 REFERENCES auth.users(id) ON DELETE CASCADE,
  source_context_id     UUID                 REFERENCES source_contexts(source_context_id) ON DELETE SET NULL,
  source_scope_id       UUID                 REFERENCES source_scopes(source_scope_id) ON DELETE SET NULL,
  question              TEXT                 NOT NULL CHECK (char_length(question) > 0 AND char_length(question) <= 2000),
  answer                TEXT                 NOT NULL CHECK (char_length(answer) > 0 AND char_length(answer) <= 10000),
  answer_id             TEXT,
  requested_max_claims  INTEGER              CHECK (requested_max_claims > 0 AND requested_max_claims <= 30),
  global_score          DECIMAL(4,3)         CHECK (global_score >= 0 AND global_score <= 1),
  status                audit_status_enum    NOT NULL DEFAULT 'pending',
  client_name           TEXT,
  transport_type        transport_type_enum,
  metadata_json         JSONB,
  started_at            TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  duration_ms           INTEGER
);

CREATE INDEX idx_audit_runs_user ON audit_runs (user_id);
CREATE INDEX idx_audit_runs_context ON audit_runs (source_context_id);
CREATE INDEX idx_audit_runs_status ON audit_runs (status);
CREATE INDEX idx_audit_runs_started ON audit_runs (started_at DESC);
CREATE INDEX idx_audit_runs_answer_id ON audit_runs (answer_id) WHERE answer_id IS NOT NULL;

ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_runs_select ON audit_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audit_runs_insert ON audit_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY audit_runs_update ON audit_runs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY audit_runs_delete ON audit_runs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: claims
-- ============================================================

CREATE TABLE claims (
  claim_id                UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_run_id            UUID               NOT NULL REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE,
  user_id                 UUID               REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_index             INTEGER            NOT NULL CHECK (claim_index >= 0),
  raw_text                TEXT               NOT NULL CHECK (char_length(raw_text) > 0),
  normalized_text         TEXT               NOT NULL,
  claim_type              claim_type_enum    NOT NULL DEFAULT 'other',
  importance              importance_enum    NOT NULL DEFAULT 'medium',
  extraction_confidence   DECIMAL(4,3)       CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  is_duplicate            BOOLEAN            NOT NULL DEFAULT FALSE,
  duplicate_of_claim_id   UUID               REFERENCES claims(claim_id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  CONSTRAINT claims_run_index_unique UNIQUE (audit_run_id, claim_index)
);

CREATE INDEX idx_claims_audit_run ON claims (audit_run_id);
CREATE INDEX idx_claims_type ON claims (claim_type);
CREATE INDEX idx_claims_user ON claims (user_id);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_select ON claims
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY claims_insert ON claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY claims_update ON claims
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY claims_delete ON claims
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: evidence_items
-- ============================================================

CREATE TABLE evidence_items (
  evidence_id        UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id           UUID              NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  user_id            UUID              REFERENCES auth.users(id) ON DELETE CASCADE,
  source_context_id  UUID              REFERENCES source_contexts(source_context_id) ON DELETE SET NULL,
  source_scope_id    UUID              REFERENCES source_scopes(source_scope_id) ON DELETE SET NULL,
  source_type        source_type_enum  NOT NULL,
  source_id          TEXT              NOT NULL,
  location           TEXT              NOT NULL,
  snippet            TEXT              NOT NULL CHECK (char_length(snippet) > 0),
  snippet_hash       TEXT,
  retrieval_rank     INTEGER,
  relevance_score    DECIMAL(4,3)      CHECK (relevance_score >= 0 AND relevance_score <= 1),
  supports_claim     BOOLEAN           DEFAULT NULL,
  contradicts_claim  BOOLEAN           DEFAULT NULL,
  metadata_json      JSONB,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT evidence_no_dual_signal CHECK (
    NOT (supports_claim = TRUE AND contradicts_claim = TRUE)
  )
);

CREATE INDEX idx_evidence_claim ON evidence_items (claim_id);
CREATE INDEX idx_evidence_source ON evidence_items (source_id);
CREATE INDEX idx_evidence_rank ON evidence_items (claim_id, retrieval_rank);
CREATE INDEX idx_evidence_hash ON evidence_items (snippet_hash) WHERE snippet_hash IS NOT NULL;

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidence_items_select ON evidence_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY evidence_items_insert ON evidence_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY evidence_items_update ON evidence_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY evidence_items_delete ON evidence_items
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: verdict_results
-- ============================================================

CREATE TABLE verdict_results (
  verdict_result_id  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id           UUID            NOT NULL UNIQUE REFERENCES claims(claim_id) ON DELETE CASCADE,
  user_id            UUID            REFERENCES auth.users(id) ON DELETE CASCADE,
  verdict            verdict_enum    NOT NULL,
  confidence         DECIMAL(4,3)    CHECK (confidence >= 0 AND confidence <= 1),
  explanation        TEXT,
  rule_trace         JSONB,
  evidence_count     INTEGER         NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verdict_results_claim ON verdict_results (claim_id);
CREATE INDEX idx_verdict_results_verdict ON verdict_results (verdict);
CREATE INDEX idx_verdict_results_user ON verdict_results (user_id);

ALTER TABLE verdict_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY verdict_results_select ON verdict_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY verdict_results_insert ON verdict_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY verdict_results_update ON verdict_results
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY verdict_results_delete ON verdict_results
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: audit_warnings
-- ============================================================

CREATE TABLE audit_warnings (
  audit_warning_id  UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_run_id      UUID                    NOT NULL REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE,
  user_id           UUID                    REFERENCES auth.users(id) ON DELETE CASCADE,
  warning_code      TEXT                    NOT NULL,
  message           TEXT                    NOT NULL,
  severity          warning_severity_enum   NOT NULL DEFAULT 'warning',
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_warnings_run ON audit_warnings (audit_run_id);
CREATE INDEX idx_audit_warnings_code ON audit_warnings (warning_code);

ALTER TABLE audit_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_warnings_select ON audit_warnings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audit_warnings_insert ON audit_warnings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE: execution_events
-- ============================================================

CREATE TABLE execution_events (
  execution_event_id  UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_run_id        UUID                    NOT NULL REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE,
  user_id             UUID                    REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type          TEXT                    NOT NULL,
  stage               execution_stage_enum    NOT NULL,
  message             TEXT                    NOT NULL,
  payload_json        JSONB,
  created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_events_run ON execution_events (audit_run_id);
CREATE INDEX idx_execution_events_stage ON execution_events (audit_run_id, stage);

ALTER TABLE execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY execution_events_select ON execution_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY execution_events_insert ON execution_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE: prompt_executions
-- ============================================================

CREATE TABLE prompt_executions (
  prompt_execution_id  UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_run_id         UUID                  NOT NULL REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE,
  user_id              UUID                  REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id             UUID                  REFERENCES claims(claim_id) ON DELETE SET NULL,
  prompt_role          TEXT                  NOT NULL,
  prompt_version       TEXT                  NOT NULL DEFAULT 'v1',
  model_name           TEXT,
  status               prompt_status_enum    NOT NULL,
  latency_ms           INTEGER,
  token_count          INTEGER,
  created_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- NOTE: input_text and output_text are intentionally excluded from
-- the main table for privacy. Store only structured metadata here.

CREATE INDEX idx_prompt_exec_run ON prompt_executions (audit_run_id);
CREATE INDEX idx_prompt_exec_claim ON prompt_executions (claim_id) WHERE claim_id IS NOT NULL;

ALTER TABLE prompt_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY prompt_executions_select ON prompt_executions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY prompt_executions_insert ON prompt_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
