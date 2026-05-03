-- =============================================================================
-- Smoke Tests: SQL Functions
-- Quick sanity check that functions exist and return sensible results.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_remaining INTEGER;
  v_cleanup_result JSONB;
BEGIN
  -- Insert test user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user_a, 'fn_smoke@jobnomad.test', 'x', now(), now(), now());

  -- Insert profile
  INSERT INTO public.user_profiles (user_id, timezone, contract_preference)
  VALUES (v_user_a, 'Asia/Bangkok', 'contractor');

  -- Trigger should auto-create subscription row (via onboarding trigger)
  UPDATE public.user_profiles
  SET onboarding_completed_at = now()
  WHERE user_id = v_user_a;

  -- -------------------------------------------------------------------------
  -- Test 1: free_tier_remaining returns 25 for a brand new free user
  -- -------------------------------------------------------------------------
  SET LOCAL role = 'authenticated';
  SET LOCAL "request.jwt.claims" = concat('{"sub":"', v_user_a, '"}');

  SELECT public.free_tier_remaining(v_user_a) INTO v_remaining;
  ASSERT v_remaining = 25,
    concat('Test 1 FAIL: Expected 25 remaining, got ', v_remaining);

  RESET role;
  RESET "request.jwt.claims";

  -- -------------------------------------------------------------------------
  -- Test 2: match_jobs_for_user returns without error (empty result OK)
  -- -------------------------------------------------------------------------
  ASSERT (
    SELECT COUNT(*) FROM public.match_jobs_for_user(v_user_a, 10, 0)
  ) >= 0, 'Test 2 FAIL: match_jobs_for_user errored';

  -- -------------------------------------------------------------------------
  -- Test 3: cleanup_expired_data() runs without error and returns JSONB
  -- -------------------------------------------------------------------------
  SELECT public.cleanup_expired_data() INTO v_cleanup_result;
  ASSERT v_cleanup_result IS NOT NULL, 'Test 3 FAIL: cleanup returned NULL';
  ASSERT (v_cleanup_result->>'ran_at') IS NOT NULL, 'Test 3 FAIL: ran_at missing';

  RAISE NOTICE 'Functions smoke tests: ALL TESTS PASSED';

  DELETE FROM auth.users WHERE id = v_user_a;
END;
$$;

ROLLBACK;
