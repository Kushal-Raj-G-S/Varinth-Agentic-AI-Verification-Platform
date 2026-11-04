-- ============================================================
-- Varinth – profiles schema
-- v1.0.0
--
-- A public-schema mirror of the user, for app-level data Supabase's
-- built-in auth.users table doesn't hold: onboarding status, use case,
-- and a convenience copy of name/avatar/email so the rest of the app
-- (and mcp_server.py's default-user lookup) can query it without
-- needing the service-role-only auth.admin API.
--
-- Referenced by:
--   frontend/src/app/auth/callback/route.ts  (upserted on every login —
--     Google OAuth and the email-confirmation callback both land here)
--   frontend/src/app/onboarding/page.tsx     (sets onboarding_completed)
--   backend/app/mcp_server.py                (resolves a default user_id)
--
-- This table was referenced by all three of the above before it was
-- ever created — upserts/selects against it were silently failing.
--
-- Run this against your Supabase project via:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                TEXT,
  full_name            TEXT,
  avatar_url           TEXT,
  use_case             TEXT,
  onboarding_completed BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- A user can see and manage only their own profile row via the anon/
-- authenticated client (the frontend). The backend's service-role
-- client (mcp_server.py's default-user lookup) bypasses RLS entirely,
-- same as every other table in this schema.
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
