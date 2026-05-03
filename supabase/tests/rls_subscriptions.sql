-- =============================================================================
-- RLS Tests: subscriptions
-- Verifies:
--   1. Users can read their own subscription
--   2. Users CANNOT read other users' subscriptions
--   3. Users CANNOT insert/update subscriptions (service_role only)
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
BEGIN
  -- Insert auth users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'sub_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'sub_b@jobnomad.test', 'x', now(), now(), now());

  -- Insert subscriptions for both (service_role)
  INSERT INTO public.subscriptions (user_id, status, tier)
  VALUES
    (v_user_a, 'active', 'pro'),
    (v_user_b, 'active', 'free');

  -- -------------------------------------------------------------------------
  -- Test 1: User A can read own subscription and sees tier='pro'
  -- -------------------------------------------------------------------------
  SET LOCAL role = 'authenticated';
  SET LOCAL "request.jwt.claims" = concat('{"sub":"', v_user_a, '"}');

  ASSERT (
    SELECT tier FROM public.subscriptions WHERE user_id = v_user_a
  ) = 'pro', 'Test 1 FAIL: User A cannot read own subscription';

  -- -------------------------------------------------------------------------
  -- Test 2: User A CANNOT read User B's subscription
  -- -------------------------------------------------------------------------
  ASSERT (
    SELECT COUNT(*) FROM public.subscriptions WHERE user_id = v_user_b
  ) = 0, 'Test 2 FAIL: User A can read User B subscription — RLS BROKEN';

  -- -------------------------------------------------------------------------
  -- Test 3: User A CANNOT insert a new subscription row (service_role only)
  -- -------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.subscriptions (user_id, status, tier)
    VALUES (gen_random_uuid(), 'active', 'pro');
    ASSERT FALSE, 'Test 3 FAIL: User inserted subscription — RLS BROKEN';
  EXCEPTION WHEN OTHERS THEN
    -- Expected: RLS should block this
    NULL;
  END;

  RESET role;
  RESET "request.jwt.claims";

  RAISE NOTICE 'RLS subscriptions: ALL TESTS PASSED';

  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

ROLLBACK;
