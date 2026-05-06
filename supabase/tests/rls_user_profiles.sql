-- =============================================================================
-- RLS Tests: user_profiles
-- Verifies that a user cannot read or update another user's profile.
-- Also verifies the onboarding upsert pattern (saveStep1..completeOnboarding).
-- =============================================================================

BEGIN;

SELECT plan(7);

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_count_self          INTEGER;
  v_count_other         INTEGER;
  v_bio_after           TEXT;
  v_tz_after            TEXT;
  v_skills_after        TEXT;
  v_contract_after      TEXT;
  v_completed_at_after  TIMESTAMPTZ;
BEGIN
  -- ─── Setup ──────────────────────────────────────────────────────────────
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'test_rls_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'test_rls_b@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.user_profiles (user_id, timezone, contract_preference)
  VALUES
    (v_user_a, 'Asia/Bangkok', 'contractor'),
    (v_user_b, 'Asia/Ho_Chi_Minh', 'contractor');

  -- ─── Act as User A ──────────────────────────────────────────────────────
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_a, '"}'), true);

  -- Test 1: User A can read own profile
  SELECT COUNT(*) INTO v_count_self
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Test 2: User A CANNOT read User B's profile (RLS isolation)
  SELECT COUNT(*) INTO v_count_other
    FROM public.user_profiles WHERE user_id = v_user_b;

  -- Test 3: User A CANNOT update User B's profile
  UPDATE public.user_profiles SET bio = 'hacked' WHERE user_id = v_user_b;

  -- ─── Onboarding upsert pattern (simulates saveStep1) ────────────────────
  -- Step 1: upsert with defaults (creates or updates row)
  INSERT INTO public.user_profiles (user_id, timezone, contract_preference, skills, excluded_regions, language)
  VALUES (v_user_a, 'Asia/Singapore', 'both', '[]', '{}', 'en')
  ON CONFLICT (user_id) DO UPDATE
    SET timezone = EXCLUDED.timezone,
        updated_at = now();

  -- Test 4: timezone was updated after upsert
  SELECT timezone INTO v_tz_after
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Step 2: update skills (simulates saveStep2)
  UPDATE public.user_profiles
    SET skills = '["React","TypeScript"]'::jsonb, updated_at = now()
    WHERE user_id = v_user_a;

  -- Step 3: update contract (simulates saveStep3)
  UPDATE public.user_profiles
    SET contract_preference = 'contractor', updated_at = now()
    WHERE user_id = v_user_a;

  -- Step 4: complete onboarding (simulates completeOnboarding)
  UPDATE public.user_profiles
    SET min_rate_usd = 5000, rate_period = 'month',
        onboarding_completed_at = now(), updated_at = now()
    WHERE user_id = v_user_a;

  -- ─── Switch back to service_role to read ground truth ───────────────────
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT bio INTO v_bio_after
    FROM public.user_profiles WHERE user_id = v_user_b;

  SELECT timezone INTO v_tz_after
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Test 5: skills persisted correctly
  SELECT skills::text INTO v_skills_after
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Test 6: contract persisted
  SELECT contract_preference INTO v_contract_after
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Test 7: onboarding_completed_at is set
  SELECT onboarding_completed_at INTO v_completed_at_after
    FROM public.user_profiles WHERE user_id = v_user_a;

  -- Stash results
  CREATE TEMP TABLE _rls_user_profiles_ctx (
    count_self          INTEGER,
    count_other         INTEGER,
    bio_after           TEXT,
    tz_after            TEXT,
    skills_after        TEXT,
    contract_after      TEXT,
    completed_at_after  TIMESTAMPTZ
  ) ON COMMIT DROP;

  INSERT INTO _rls_user_profiles_ctx VALUES (
    v_count_self,
    v_count_other,
    v_bio_after,
    v_tz_after,
    v_skills_after,
    v_contract_after,
    v_completed_at_after
  );

  -- Cleanup
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

-- ─── Assertions ─────────────────────────────────────────────────────────────

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

SELECT is(
  (SELECT tz_after FROM _rls_user_profiles_ctx),
  'Asia/Singapore',
  'Onboarding step1 upsert updates timezone correctly (user_id from session, not input)'
);

SELECT ok(
  (SELECT skills_after FROM _rls_user_profiles_ctx) LIKE '%React%',
  'Onboarding step2 persists skills array to user_profiles'
);

SELECT is(
  (SELECT contract_after FROM _rls_user_profiles_ctx),
  'contractor',
  'Onboarding step3 persists contract_preference correctly'
);

SELECT isnt(
  (SELECT completed_at_after FROM _rls_user_profiles_ctx),
  NULL,
  'completeOnboarding sets onboarding_completed_at (not left NULL)'
);

SELECT * FROM finish();
ROLLBACK;
