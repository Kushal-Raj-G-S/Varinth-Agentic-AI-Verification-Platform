-- ============================================================
-- Varinth – API Keys schema
-- v1.0.0
--
-- Lets a user mint long-lived API keys for headless/CI callers
-- (e.g. the GitHub Action integration) that can't do an interactive
-- Supabase login. The backend never stores the raw key — only a
-- SHA-256 hash of it (see app/core/security.py) — and shows the full
-- value to the user exactly once, at creation time.
--
-- Run this against your Supabase project via:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  api_key_id    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT        NOT NULL,
  key_prefix    TEXT        NOT NULL,   -- first 8 chars of the key, shown in the UI for identification
  key_hash      TEXT        NOT NULL UNIQUE,  -- sha256(full key), never the raw key
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owner can see and manage their own keys. All actual lookups by hash
-- (verifying a caller's key on an incoming request) go through the
-- backend's service-role client, which bypasses RLS entirely — these
-- policies only govern what an authenticated end user can see/do
-- directly (e.g. if the frontend ever queries this table itself).
CREATE POLICY api_keys_select ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY api_keys_insert ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY api_keys_update ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY api_keys_delete ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);
