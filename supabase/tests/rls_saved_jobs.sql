-- =============================================================================
-- RLS Tests: saved_jobs
-- Verifies cross-user isolation on bookmarks (read AND delete).
-- Ground-truth verification is always done from service_role to avoid
-- the false-negative trap where RLS-filtered counts look like deletions.
-- =============================================================================

BEGIN;

SELECT plan(3);

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_job_id UUID;
  v_a_can_see INTEGER;
  v_b_can_see_a INTEGER;
  v_a_rows_after_b_delete INTEGER;
BEGIN
  -- Setup
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'saved_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'saved_b@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
  VALUES ('remoteok', 'https://remoteok.com/test-1', 'Test Job', 'TestCo', 'Test description',
    'active', encode(digest('test-job-rls', 'sha256'), 'hex'))
  RETURNING id INTO v_job_id;

  INSERT INTO public.saved_jobs (user_id, job_id) VALUES (v_user_a, v_job_id);

  -- Test 1: User A can read own saved jobs
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_a, '"}'), true);

  SELECT COUNT(*) INTO v_a_can_see
    FROM public.saved_jobs WHERE user_id = v_user_a;

  -- Test 2: User B CANNOT see User A's saved jobs
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_b, '"}'), true);

  SELECT COUNT(*) INTO v_b_can_see_a
    FROM public.saved_jobs WHERE user_id = v_user_a;

  -- Test 3: User B cannot delete User A's saved job.
  -- RLS will silently filter the DELETE; we verify by counting from service_role.
  DELETE FROM public.saved_jobs WHERE user_id = v_user_a;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT COUNT(*) INTO v_a_rows_after_b_delete
    FROM public.saved_jobs WHERE user_id = v_user_a;

  CREATE TEMP TABLE _rls_saved_jobs_ctx (
    a_can_see INTEGER, b_can_see_a INTEGER, a_rows_after_b_delete INTEGER
  ) ON COMMIT DROP;
  INSERT INTO _rls_saved_jobs_ctx
    VALUES (v_a_can_see, v_b_can_see_a, v_a_rows_after_b_delete);

  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

SELECT is(
  (SELECT a_can_see FROM _rls_saved_jobs_ctx),
  1,
  'User A can read own saved jobs'
);

SELECT is(
  (SELECT b_can_see_a FROM _rls_saved_jobs_ctx),
  0,
  'User B CANNOT see User A saved jobs'
);

SELECT is(
  (SELECT a_rows_after_b_delete FROM _rls_saved_jobs_ctx),
  1,
  'User B CANNOT delete User A saved jobs (verified from service_role)'
);

SELECT * FROM finish();
ROLLBACK;
