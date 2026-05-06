-- =============================================================================
-- RLS Tests: job_views
-- Verifies cross-user isolation and immutability (no UPDATE/DELETE policies).
-- job_views are audit records: only the owning user can SELECT or INSERT.
-- No UPDATE or DELETE is permitted for any authenticated user.
-- =============================================================================

BEGIN;

SELECT plan(5);

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_job_id UUID;
  v_a_can_see      INTEGER;
  v_b_can_see_a    INTEGER;
  v_b_inserted     INTEGER;
  v_rows_after_del INTEGER;
BEGIN
  -- Setup
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'views_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'views_b@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
  VALUES ('remoteok', 'https://remoteok.com/views-rls-test', 'Views RLS Job', 'ViewsCo',
          'Description for RLS test', 'active',
          encode(digest('views-rls-job', 'sha256'), 'hex'))
  RETURNING id INTO v_job_id;

  -- User A inserts a view (using authenticated role + JWT claims)
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_a, '"}'), true);

  INSERT INTO public.job_views (user_id, job_id, action)
  VALUES (v_user_a, v_job_id, 'click_apply');

  -- Test 1: User A can SELECT own views
  SELECT COUNT(*) INTO v_a_can_see
    FROM public.job_views WHERE user_id = v_user_a;

  -- Test 2: User B CANNOT see User A's views
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_b, '"}'), true);

  SELECT COUNT(*) INTO v_b_can_see_a
    FROM public.job_views WHERE user_id = v_user_a;

  -- Test 3: User B cannot INSERT a view with user_id = user_a (RLS blocks)
  BEGIN
    INSERT INTO public.job_views (user_id, job_id, action)
    VALUES (v_user_a, v_job_id, 'view');
    -- If we reach here, the INSERT succeeded (should not happen)
    v_b_inserted := 1;
  EXCEPTION WHEN others THEN
    v_b_inserted := 0;
  END;

  -- Test 4: User B cannot DELETE User A's views
  -- RLS will silently filter the DELETE; verify from service_role
  DELETE FROM public.job_views WHERE user_id = v_user_a;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT COUNT(*) INTO v_rows_after_del
    FROM public.job_views WHERE user_id = v_user_a;

  CREATE TEMP TABLE _rls_job_views_ctx (
    a_can_see      INTEGER,
    b_can_see_a    INTEGER,
    b_inserted     INTEGER,
    rows_after_del INTEGER
  ) ON COMMIT DROP;

  INSERT INTO _rls_job_views_ctx
    VALUES (v_a_can_see, v_b_can_see_a, v_b_inserted, v_rows_after_del);

  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

SELECT is(
  (SELECT a_can_see FROM _rls_job_views_ctx),
  1,
  'User A can SELECT own job_views'
);

SELECT is(
  (SELECT b_can_see_a FROM _rls_job_views_ctx),
  0,
  'User B CANNOT see User A job_views'
);

SELECT is(
  (SELECT b_inserted FROM _rls_job_views_ctx),
  0,
  'User B CANNOT INSERT a view with another user_id'
);

SELECT is(
  (SELECT rows_after_del FROM _rls_job_views_ctx),
  1,
  'User B CANNOT DELETE User A job_views (verified from service_role)'
);

-- Test 5: RLS table metadata — no UPDATE policy should exist for job_views
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM pg_policies
    WHERE tablename = 'job_views'
      AND cmd IN ('UPDATE', 'DELETE')
  ),
  0,
  'No UPDATE or DELETE RLS policies exist on job_views (immutable audit records)'
);

SELECT * FROM finish();
ROLLBACK;
