-- =============================================================================
-- Smoke Tests: SQL Functions
-- Quick sanity check that functions exist and return sensible results.
-- Uses pgTAP format (plan + assertions + finish).
-- =============================================================================

BEGIN;

SELECT plan(3);

-- Setup: create test user
DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user_a, 'fn_smoke@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.user_profiles (user_id, timezone, contract_preference)
  VALUES (v_user_a, 'Asia/Bangkok', 'contractor');

  UPDATE public.user_profiles
  SET onboarding_completed_at = now()
  WHERE user_id = v_user_a;

  -- Store user ID for later tests via a temp table
  CREATE TEMP TABLE _smoke_ctx (user_id UUID) ON COMMIT DROP;
  INSERT INTO _smoke_ctx VALUES (v_user_a);
END;
$$;

-- -------------------------------------------------------------------------
-- Test 1: free_tier_remaining returns 25 for a brand new free user
-- -------------------------------------------------------------------------
SELECT is(
  public.free_tier_remaining((SELECT user_id FROM _smoke_ctx)),
  25,
  'free_tier_remaining returns 25 for new free user'
);

-- -------------------------------------------------------------------------
-- Test 2: match_jobs_for_user returns without error (empty result OK)
-- -------------------------------------------------------------------------
SELECT ok(
  (SELECT COUNT(*) FROM public.match_jobs_for_user(
    (SELECT user_id FROM _smoke_ctx), 10, 0
  )) >= 0,
  'match_jobs_for_user runs without error'
);

-- -------------------------------------------------------------------------
-- Test 3: cleanup_expired_data() runs without error and returns JSONB
-- -------------------------------------------------------------------------
SELECT isnt(
  (SELECT public.cleanup_expired_data()::text),
  NULL,
  'cleanup_expired_data returns non-NULL JSONB'
);

-- Cleanup
DO $$
BEGIN
  DELETE FROM auth.users WHERE email = 'fn_smoke@jobnomad.test';
END;
$$;

SELECT * FROM finish();
ROLLBACK;
