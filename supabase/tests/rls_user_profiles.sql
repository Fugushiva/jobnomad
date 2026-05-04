-- =============================================================================
-- RLS Tests: user_profiles
-- Verifies that a user cannot read or update another user's profile.
-- =============================================================================

BEGIN;

SELECT plan(3);

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_count_self INTEGER;
  v_count_other INTEGER;
  v_bio_after TEXT;
BEGIN
  -- Setup: two auth users + their profiles (service_role; RLS bypassed)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'test_rls_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'test_rls_b@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.user_profiles (user_id, timezone, contract_preference)
  VALUES
    (v_user_a, 'Asia/Bangkok', 'contractor'),
    (v_user_b, 'Asia/Ho_Chi_Minh', 'contractor');

  -- Become User A (authenticated)
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_a, '"}'), true);

  -- Test 1: User A can read own profile
  SELECT COUNT(*) INTO v_count_self
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Test 2: User A CANNOT read User B's profile (RLS isolation)
  SELECT COUNT(*) INTO v_count_other
    FROM public.user_profiles WHERE user_id = v_user_b;

  -- Test 3: User A cannot UPDATE User B's profile
  -- RLS silently filters; we verify by reading the row back as service_role.
  UPDATE public.user_profiles SET bio = 'hacked' WHERE user_id = v_user_b;

  -- Switch back to service_role (no role + no jwt claims) to read ground truth
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT bio INTO v_bio_after
    FROM public.user_profiles WHERE user_id = v_user_b;

  -- Stash results for assertions outside the DO block
  CREATE TEMP TABLE _rls_user_profiles_ctx (
    count_self INTEGER, count_other INTEGER, bio_after TEXT
  ) ON COMMIT DROP;
  INSERT INTO _rls_user_profiles_ctx VALUES (v_count_self, v_count_other, v_bio_after);

  -- Cleanup auth.users (cascades to user_profiles)
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

SELECT is(
  (SELECT count_self FROM _rls_user_profiles_ctx),
  1,
  'User A can read own profile'
);

SELECT is(
  (SELECT count_other FROM _rls_user_profiles_ctx),
  0,
  'User A CANNOT read User B profile (RLS isolation)'
);

SELECT isnt(
  (SELECT bio_after FROM _rls_user_profiles_ctx),
  'hacked',
  'User A CANNOT update User B profile (RLS isolation)'
);

SELECT * FROM finish();
ROLLBACK;
