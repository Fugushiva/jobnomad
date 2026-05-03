-- =============================================================================
-- Migration: match_jobs_for_user()
-- Pure SQL scoring function. Called from Server Components — zero LLM at click.
-- Implements §6.2 (Stratégie IA): three-component weighted score:
--   1. Hard compatibility (boolean filter → cap score at 30 on any fail)
--   2. Semantic similarity (cosine distance from pgvector)
--   3. Salary bonus (0-20 points if salary exceeds user minimum)
-- Target latency: < 200ms for 500 active jobs (ADR-003, FM05)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: free_tier_remaining(user_id)
-- Returns how many job views the user can still do today (FM10).
-- Free tier = 25 views/day. Pro tier = unlimited (returns 999999).
-- Called from Server Actions before revealing a job card.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.free_tier_remaining(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER so this can be called from anon context via RPC
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_views_today INTEGER;
  v_limit INTEGER := 25; -- FM10: 20-30 offer cap for free tier
BEGIN
  -- Get subscription tier
  SELECT tier INTO v_tier
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  -- Default to free if no subscription row yet
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Pro users have unlimited access
  IF v_tier = 'pro' THEN
    RETURN 999999;
  END IF;

  -- Count today's views (UTC date)
  SELECT COUNT(*) INTO v_views_today
  FROM public.job_views
  WHERE user_id = p_user_id
    AND action = 'view'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

  RETURN GREATEST(0, v_limit - v_views_today);
END;
$$;

-- ---------------------------------------------------------------------------
-- Main matching function: match_jobs_for_user()
-- Returns jobs ordered by composite fit score.
-- Filtering is done in SQL; scoring uses pgvector cosine similarity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_jobs_for_user(
  p_user_id    UUID,
  p_limit      INTEGER DEFAULT 50,
  p_offset     INTEGER DEFAULT 0,
  -- Hard filters (optional — NULL = no filter applied)
  p_geo_policy TEXT DEFAULT NULL,
  -- e.g. 'worldwide' — only show jobs with this policy
  p_contract_type TEXT DEFAULT NULL,
  p_seniority  TEXT DEFAULT NULL,
  p_min_salary INTEGER DEFAULT NULL,
  p_skills     TEXT[] DEFAULT NULL,
  -- Jobs must have at least one of these skills
  p_search_query TEXT DEFAULT NULL
  -- Full-text search query (FM07)
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
  v_embedding   vector(1536);
BEGIN
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

  -- If user has no profile yet, return empty (not onboarded)
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
      -- Is this job saved by the user?
      EXISTS (
        SELECT 1 FROM public.saved_jobs sj
        WHERE sj.job_id = j.id AND sj.user_id = p_user_id
      ) AS is_saved
    FROM public.jobs j
    WHERE
      -- Only active jobs
      j.status = 'active'
      -- Hard filter: geo_policy if requested
      AND (p_geo_policy IS NULL OR j.geo_policy = p_geo_policy)
      -- Hard filter: contract_type
      AND (p_contract_type IS NULL OR j.contract_type = p_contract_type OR j.contract_type = 'both')
      -- Hard filter: seniority
      AND (p_seniority IS NULL OR j.seniority = p_seniority OR j.seniority = 'any')
      -- Hard filter: minimum salary
      AND (p_min_salary IS NULL OR j.salary_min IS NULL OR j.salary_min >= p_min_salary)
      -- Hard filter: skills overlap (job has at least one of user's requested skills)
      AND (p_skills IS NULL OR j.skills_required && p_skills)
      -- Hard filter: full-text search
      AND (
        p_search_query IS NULL
        OR to_tsvector('english', j.title || ' ' || j.description) @@ plainto_tsquery('english', p_search_query)
      )
      -- Exclude jobs from regions the user explicitly excluded
      AND (
        v_profile.excluded_regions = '{}'
        OR NOT (j.allowed_regions && v_profile.excluded_regions)
      )
  ),
  scored AS (
    SELECT
      bj.*,
      -- -----------------------------------------------------------------------
      -- Component 1: Hard compatibility penalty
      -- Any hard incompatibility caps the total score at 30.
      -- Incompatibilities:
      --   - contract_type mismatch (user wants contractor, job is employee-only)
      --   - timezone: job requires overlap > 8h (SE Asia to EU/US max realistic)
      -- -----------------------------------------------------------------------
      CASE
        WHEN (
          -- Contract mismatch
          (v_profile.contract_preference = 'contractor' AND bj.contract_type = 'employee')
          OR (v_profile.contract_preference = 'employee' AND bj.contract_type = 'contractor')
          -- Extreme timezone requirement (>8h overlap is incompatible from APAC)
          OR (bj.tz_min_overlap_hours IS NOT NULL AND bj.tz_min_overlap_hours > 8)
        )
        THEN 1 -- hard_incompatible flag
        ELSE 0
      END AS hard_incompatible,

      -- -----------------------------------------------------------------------
      -- Component 2: Semantic similarity (0-100)
      -- pgvector cosine similarity: 1 - cosine_distance = similarity
      -- NULL embedding → 0 score (extraction not yet complete or embedding missing)
      -- -----------------------------------------------------------------------
      CASE
        WHEN bj.embedding IS NOT NULL AND v_profile.embedding IS NOT NULL
        THEN ROUND(CAST((1 - (bj.embedding <=> v_profile.embedding)) * 100 AS NUMERIC), 2)
        ELSE 50.0 -- Neutral score when no embedding available
      END AS semantic_score,

      -- -----------------------------------------------------------------------
      -- Component 3: Salary bonus (0-20 points)
      -- Bonus if job salary_min >= user's min_rate_usd (same period assumed)
      -- -----------------------------------------------------------------------
      CASE
        WHEN v_profile.min_rate_usd IS NOT NULL
          AND bj.salary_min IS NOT NULL
          AND bj.salary_min >= v_profile.min_rate_usd
        THEN 20
        WHEN v_profile.min_rate_usd IS NULL OR bj.salary_min IS NULL
        THEN 10 -- Unknown salary = neutral
        ELSE 0
      END AS salary_bonus

    FROM base_jobs bj
  )
  SELECT
    s.id,
    s.title,
    s.company,
    s.logo_url,
    s.source_url,
    s.geo_policy,
    s.allowed_regions,
    s.allowed_countries,
    s.tz_requirement_type,
    s.tz_reference,
    s.tz_min_overlap_hours,
    s.contract_type,
    s.salary_min,
    s.salary_max,
    s.salary_currency,
    s.salary_period,
    s.skills_required,
    s.seniority,
    s.red_flags,
    s.confidence_scores,
    s.posted_at,
    s.is_saved,
    -- Final composite score
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

-- Grant execute to authenticated users (called from Server Actions via supabase.rpc())
GRANT EXECUTE ON FUNCTION public.match_jobs_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.free_tier_remaining TO authenticated;
