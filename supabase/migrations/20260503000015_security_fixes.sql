-- =============================================================================
-- Migration: Security & Performance Fixes
-- Addresses all warnings from Supabase security + performance advisors.
-- Run after initial schema is applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FIX 1 (CRITICAL): Revoke EXECUTE on sensitive functions from anon/authenticated
-- These functions must only be callable by service_role (server-side clients).
-- They were already REVOKE'd from PUBLIC in their original migration, but
-- Supabase grants EXECUTE to PUBLIC by default on function creation before
-- explicit REVOKE — so we explicitly revoke from both roles to be safe.
-- ---------------------------------------------------------------------------

-- cleanup_expired_data: only service_role (cron handler)
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_data() FROM anon, authenticated;

-- upsert_subscription: only service_role (Stripe webhook)
REVOKE EXECUTE ON FUNCTION public.upsert_subscription(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN
) FROM anon, authenticated;

-- ensure_subscription_row: only authenticated (but called via trigger, not RPC)
-- Revoke from anon to prevent unauthenticated calls
REVOKE EXECUTE ON FUNCTION public.ensure_subscription_row(UUID) FROM anon;

-- on_profile_onboarding_complete: trigger function, never called directly
REVOKE EXECUTE ON FUNCTION public.on_profile_onboarding_complete() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- FIX 2 (HIGH): Add caller-identity check to match_jobs_for_user
-- The function must only return results for the calling user's own ID.
-- Replace the function to add an internal auth check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_jobs_for_user(
  p_user_id    UUID,
  p_limit      INTEGER DEFAULT 50,
  p_offset     INTEGER DEFAULT 0,
  p_geo_policy TEXT DEFAULT NULL,
  p_contract_type TEXT DEFAULT NULL,
  p_seniority  TEXT DEFAULT NULL,
  p_min_salary INTEGER DEFAULT NULL,
  p_skills     TEXT[] DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  title             TEXT,
  company           TEXT,
  logo_url          TEXT,
  source_url        TEXT,
  geo_policy        TEXT,
  allowed_regions   TEXT[],
  allowed_countries TEXT[],
  tz_requirement_type TEXT,
  tz_reference      TEXT,
  tz_min_overlap_hours INTEGER,
  contract_type     TEXT,
  salary_min        INTEGER,
  salary_max        INTEGER,
  salary_currency   TEXT,
  salary_period     TEXT,
  skills_required   TEXT[],
  seniority         TEXT,
  red_flags         JSONB,
  confidence_scores JSONB,
  posted_at         TIMESTAMPTZ,
  is_saved          BOOLEAN,
  fit_score         NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     RECORD;
BEGIN
  -- SECURITY: Enforce that the caller can only query their own feed.
  -- This prevents any authenticated user from fetching another user's personalized feed.
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only query your own feed';
  END IF;

  -- Fetch user profile for matching context
  SELECT
    up.timezone,
    up.skills,
    up.contract_preference,
    up.min_rate_usd,
    up.rate_period,
    up.excluded_regions,
    up.embedding
  INTO v_profile
  FROM public.user_profiles up
  WHERE up.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base_jobs AS (
    SELECT
      j.id,
      j.title,
      j.company,
      j.logo_url,
      j.source_url,
      j.geo_policy,
      j.allowed_regions,
      j.allowed_countries,
      j.tz_requirement_type,
      j.tz_reference,
      j.tz_min_overlap_hours,
      j.contract_type,
      j.salary_min,
      j.salary_max,
      j.salary_currency,
      j.salary_period,
      j.skills_required,
      j.seniority,
      j.red_flags,
      j.confidence_scores,
      j.posted_at,
      j.embedding,
      EXISTS (
        SELECT 1 FROM public.saved_jobs sj
        WHERE sj.job_id = j.id AND sj.user_id = p_user_id
      ) AS is_saved
    FROM public.jobs j
    WHERE
      j.status = 'active'
      AND (p_geo_policy IS NULL OR j.geo_policy = p_geo_policy)
      AND (p_contract_type IS NULL OR j.contract_type = p_contract_type OR j.contract_type = 'both')
      AND (p_seniority IS NULL OR j.seniority = p_seniority OR j.seniority = 'any')
      AND (p_min_salary IS NULL OR j.salary_min IS NULL OR j.salary_min >= p_min_salary)
      AND (p_skills IS NULL OR j.skills_required && p_skills)
      AND (
        p_search_query IS NULL
        OR to_tsvector('english', j.title || ' ' || j.description) @@ plainto_tsquery('english', p_search_query)
      )
      AND (
        v_profile.excluded_regions = '{}'
        OR NOT (j.allowed_regions && v_profile.excluded_regions)
      )
  ),
  scored AS (
    SELECT
      bj.*,
      CASE
        WHEN (
          (v_profile.contract_preference = 'contractor' AND bj.contract_type = 'employee')
          OR (v_profile.contract_preference = 'employee' AND bj.contract_type = 'contractor')
          OR (bj.tz_min_overlap_hours IS NOT NULL AND bj.tz_min_overlap_hours > 8)
        )
        THEN 1 ELSE 0
      END AS hard_incompatible,
      CASE
        WHEN bj.embedding IS NOT NULL AND v_profile.embedding IS NOT NULL
        THEN ROUND(CAST((1 - (bj.embedding <=> v_profile.embedding)) * 100 AS NUMERIC), 2)
        ELSE 50.0
      END AS semantic_score,
      CASE
        WHEN v_profile.min_rate_usd IS NOT NULL
          AND bj.salary_min IS NOT NULL
          AND bj.salary_min >= v_profile.min_rate_usd
        THEN 20
        WHEN v_profile.min_rate_usd IS NULL OR bj.salary_min IS NULL THEN 10
        ELSE 0
      END AS salary_bonus
    FROM base_jobs bj
  )
  SELECT
    s.id, s.title, s.company, s.logo_url, s.source_url,
    s.geo_policy, s.allowed_regions, s.allowed_countries,
    s.tz_requirement_type, s.tz_reference, s.tz_min_overlap_hours,
    s.contract_type, s.salary_min, s.salary_max, s.salary_currency, s.salary_period,
    s.skills_required, s.seniority, s.red_flags, s.confidence_scores,
    s.posted_at, s.is_saved,
    CASE
      WHEN s.hard_incompatible = 1
      THEN LEAST(30.0, s.semantic_score * 0.30 + s.salary_bonus * 0.10)
      ELSE LEAST(100.0, s.semantic_score * 0.80 + s.salary_bonus * 0.20)
    END AS fit_score
  FROM scored s
  ORDER BY fit_score DESC, s.posted_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Revoke anon access; authenticated can call (with their own UUID only)
REVOKE EXECUTE ON FUNCTION public.match_jobs_for_user FROM anon;
GRANT EXECUTE ON FUNCTION public.match_jobs_for_user TO authenticated;

-- Same for free_tier_remaining — add auth check
CREATE OR REPLACE FUNCTION public.free_tier_remaining(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_views_today INTEGER;
  v_limit INTEGER := 25;
BEGIN
  -- SECURITY: users can only query their own quota
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only query your own quota';
  END IF;

  SELECT tier INTO v_tier
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  IF v_tier = 'pro' THEN
    RETURN 999999;
  END IF;

  SELECT COUNT(*) INTO v_views_today
  FROM public.job_views
  WHERE user_id = p_user_id
    AND action = 'view'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

  RETURN GREATEST(0, v_limit - v_views_today);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.free_tier_remaining FROM anon;
GRANT EXECUTE ON FUNCTION public.free_tier_remaining TO authenticated;

-- ---------------------------------------------------------------------------
-- FIX 3 (MEDIUM): Fix set_updated_at mutable search_path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- FIX 4 (MEDIUM): Fix all RLS policies to use (SELECT auth.uid()) pattern
-- This prevents re-evaluation of auth.uid() for every row (initplan optimization).
-- We drop and recreate affected policies.
-- ---------------------------------------------------------------------------

-- user_profiles
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;

CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_profiles_delete_own"
  ON public.user_profiles FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- saved_jobs
DROP POLICY IF EXISTS "saved_jobs_select_own" ON public.saved_jobs;
DROP POLICY IF EXISTS "saved_jobs_insert_own" ON public.saved_jobs;
DROP POLICY IF EXISTS "saved_jobs_update_own" ON public.saved_jobs;
DROP POLICY IF EXISTS "saved_jobs_delete_own" ON public.saved_jobs;

CREATE POLICY "saved_jobs_select_own"
  ON public.saved_jobs FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "saved_jobs_insert_own"
  ON public.saved_jobs FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "saved_jobs_update_own"
  ON public.saved_jobs FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "saved_jobs_delete_own"
  ON public.saved_jobs FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- job_views
DROP POLICY IF EXISTS "job_views_select_own" ON public.job_views;
DROP POLICY IF EXISTS "job_views_insert_own" ON public.job_views;

CREATE POLICY "job_views_select_own"
  ON public.job_views FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "job_views_insert_own"
  ON public.job_views FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- email_digests
DROP POLICY IF EXISTS "email_digests_select_own" ON public.email_digests;
CREATE POLICY "email_digests_select_own"
  ON public.email_digests FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ai_usage_log
DROP POLICY IF EXISTS "ai_usage_log_select_own" ON public.ai_usage_log;
CREATE POLICY "ai_usage_log_select_own"
  ON public.ai_usage_log FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- feedback_extraction
DROP POLICY IF EXISTS "feedback_extraction_select_own" ON public.feedback_extraction;
DROP POLICY IF EXISTS "feedback_extraction_insert_own" ON public.feedback_extraction;
DROP POLICY IF EXISTS "feedback_extraction_update_own" ON public.feedback_extraction;

CREATE POLICY "feedback_extraction_select_own"
  ON public.feedback_extraction FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "feedback_extraction_insert_own"
  ON public.feedback_extraction FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "feedback_extraction_update_own"
  ON public.feedback_extraction FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- FIX 5 (LOW): Add missing FK indexes for join performance
-- ---------------------------------------------------------------------------

-- ai_usage_log.job_id — for jobs → ai_usage_log joins
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_job_id
  ON public.ai_usage_log (job_id)
  WHERE job_id IS NOT NULL;

-- saved_jobs.job_id — already covered by the (user_id, saved_at) index
-- but the FK advisor wants a dedicated one for reverse joins (jobs → saved_jobs)
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id
  ON public.saved_jobs (job_id);

-- ---------------------------------------------------------------------------
-- FIX 6 (INFO): Note on cron_runs — no policies is intentional (service_role only)
-- Add a comment to make intent explicit (no policy change needed)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.cron_runs IS
  'Service-role only. RLS enabled with no policies is intentional — '
  'this table is inaccessible via PostgREST API for all client roles. '
  'Cron handlers write via service_role SDK which bypasses RLS.';

-- ---------------------------------------------------------------------------
-- FIX 7 (MEDIUM): Note on vector extension in public schema
-- Moving the vector extension schema requires superuser privileges not available
-- on Supabase Free. This is a Supabase platform constraint, not actionable.
-- Document it.
-- ---------------------------------------------------------------------------
COMMENT ON EXTENSION vector IS
  'pgvector installed in public schema (Supabase Free constraint — cannot move to extensions schema without superuser). '
  'Not a risk in practice as pgvector types are only used in server-side code.';
