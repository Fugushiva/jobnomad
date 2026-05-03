-- =============================================================================
-- Migration: user_profiles
-- One row per auth user, created during onboarding (4 steps).
-- user_id FK → auth.users, primary key.
-- Email lives in auth.users only — no duplication here.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT,
  timezone          TEXT NOT NULL,
  -- IANA timezone string, e.g. "Asia/Bangkok", "Asia/Ho_Chi_Minh"
  skills            JSONB NOT NULL DEFAULT '[]',
  -- Array of {name: string, level: "junior"|"mid"|"senior"} objects
  contract_preference TEXT NOT NULL
    CHECK (contract_preference IN ('contractor', 'employee', 'both')),
  min_rate_usd      INTEGER CHECK (min_rate_usd IS NULL OR min_rate_usd >= 0),
  rate_period       TEXT CHECK (rate_period IN ('hour', 'day', 'month', 'year')),
  excluded_regions  TEXT[] NOT NULL DEFAULT '{}',
  -- Regions user does NOT want offers from: 'US_ONLY', 'EU_ONLY', etc.
  bio               TEXT,
  embedding         vector(1536),
  -- OpenAI text-embedding-3-small of (skills + bio), used for semantic matching
  language          TEXT NOT NULL DEFAULT 'en',
  onboarding_completed_at TIMESTAMPTZ,
  -- NULL = onboarding not finished; set when 4th step saved
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own profile (onboarding)
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own profile (RGPD right to erasure)
CREATE POLICY "user_profiles_delete_own"
  ON public.user_profiles FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass is automatic (no policy needed for service_role)
