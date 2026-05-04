-- =============================================================================
-- RLS Tests: subscriptions
-- Verifies:
--   1. Users can read their own subscription
--   2. Users CANNOT read other users' subscriptions
--   3. Users CANNOT insert subscriptions (service_role only)
-- =============================================================================

BEGIN;

SELECT plan(3);

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_a_tier TEXT;
  v_a_sees_b INTEGER;
  v_user_a_inserted_extra BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'sub_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'sub_b@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.subscriptions (user_id, status, tier)
  VALUES
    (v_user_a, 'active', 'pro'),
    (v_user_b, 'active', 'free');

  -- Become User A
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_a, '"}'), true);

  SELECT tier INTO v_a_tier
    FROM public.subscriptions WHERE user_id = v_user_a;

  SELECT COUNT(*) INTO v_a_sees_b
    FROM public.subscriptions WHERE user_id = v_user_b;

  -- Test 3: User A cannot insert a new subscription row
  v_user_a_inserted_extra := FALSE;
  BEGIN
    INSERT INTO public.subscriptions (user_id, status, tier)
    VALUES (gen_random_uuid(), 'active', 'pro');
    v_user_a_inserted_extra := TRUE;
  EXCEPTION WHEN OTHERS THEN
    v_user_a_inserted_extra := FALSE;
  END;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);

  CREATE TEMP TABLE _rls_subscriptions_ctx (
    a_tier TEXT, a_sees_b INTEGER, inserted_extra BOOLEAN
  ) ON COMMIT DROP;
  INSERT INTO _rls_subscriptions_ctx VALUES (v_a_tier, v_a_sees_b, v_user_a_inserted_extra);

  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

SELECT is(
  (SELECT a_tier FROM _rls_subscriptions_ctx),
  'pro',
  'User A can read own subscription tier'
);

SELECT is(
  (SELECT a_sees_b FROM _rls_subscriptions_ctx),
  0,
  'User A CANNOT read User B subscription'
);

SELECT is(
  (SELECT inserted_extra FROM _rls_subscriptions_ctx),
  FALSE,
  'authenticated CANNOT insert subscriptions'
);

SELECT * FROM finish();
ROLLBACK;
