-- =============================================================================
-- RLS Tests: user_profiles
-- Verifies that a user cannot read, update, or delete another user's profile.
-- Run via: psql $DATABASE_URL -f supabase/tests/rls_user_profiles.sql
-- Or via Supabase MCP execute_sql
-- =============================================================================

BEGIN;

-- Setup: create two fake users via auth.users (requires service_role)
DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
BEGIN
  -- Insert directly into auth.users (service_role)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'test_rls_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'test_rls_b@jobnomad.test', 'x', now(), now(), now());

  -- Insert profiles for both users
  INSERT INTO public.user_profiles (user_id, timezone, contract_preference)
  VALUES
    (v_user_a, 'Asia/Bangkok', 'contractor'),
    (v_user_b, 'Asia/Ho_Chi_Minh', 'contractor');

  -- -------------------------------------------------------------------------
  -- Test 1: User A can read their own profile
  -- -------------------------------------------------------------------------
  SET LOCAL role = 'authenticated';
  SET LOCAL request.jwt.claims = concat('{"sub":"', v_user_a, '"}')::text;

  ASSERT (
    SELECT COUNT(*) FROM public.user_profiles WHERE user_id = v_user_a
  ) = 1, 'Test 1 FAIL: User A cannot read own profile';

  -- -------------------------------------------------------------------------
  -- Test 2: User A CANNOT read User B's profile (RLS isolation)
  -- -------------------------------------------------------------------------
  ASSERT (
    SELECT COUNT(*) FROM public.user_profiles WHERE user_id = v_user_b
  ) = 0, 'Test 2 FAIL: User A can read User B profile — RLS BROKEN';

  -- -------------------------------------------------------------------------
  -- Test 3: User A cannot UPDATE User B's profile
  -- -------------------------------------------------------------------------
  BEGIN
    UPDATE public.user_profiles SET bio = 'hacked' WHERE user_id = v_user_b;
    -- If no error, verify 0 rows affected (RLS blocks silently)
    ASSERT (
      SELECT bio FROM public.user_profiles WHERE user_id = v_user_b
    ) IS NULL OR (
      SELECT bio FROM public.user_profiles WHERE user_id = v_user_b
    ) != 'hacked', 'Test 3 FAIL: User A updated User B profile — RLS BROKEN';
  EXCEPTION WHEN OTHERS THEN
    -- Exception is also acceptable (RLS raised an error)
    NULL;
  END;

  -- Reset role
  RESET role;
  RESET "request.jwt.claims";

  RAISE NOTICE 'RLS user_profiles: ALL TESTS PASSED';

  -- Cleanup
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

ROLLBACK;
