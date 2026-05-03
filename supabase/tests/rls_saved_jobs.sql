-- =============================================================================
-- RLS Tests: saved_jobs
-- Verifies cross-user isolation on bookmarks.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_job_id UUID;
BEGIN
  -- Insert auth users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'saved_a@jobnomad.test', 'x', now(), now(), now()),
    (v_user_b, 'saved_b@jobnomad.test', 'x', now(), now(), now());

  -- Insert a fake job (service_role, bypasses RLS)
  INSERT INTO public.jobs (
    source, source_url, title, company, description,
    status, hash_dedup
  )
  VALUES (
    'remoteok', 'https://remoteok.com/test-1', 'Test Job', 'TestCo', 'Test description',
    'active', encode(digest('test-job-rls', 'sha256'), 'hex')
  )
  RETURNING id INTO v_job_id;

  -- User A saves the job (service_role insert to bypass RLS for setup)
  INSERT INTO public.saved_jobs (user_id, job_id)
  VALUES (v_user_a, v_job_id);

  -- -------------------------------------------------------------------------
  -- Test 1: User A can read their own saved jobs
  -- -------------------------------------------------------------------------
  SET LOCAL role = 'authenticated';
  SET LOCAL "request.jwt.claims" = concat('{"sub":"', v_user_a, '"}');

  ASSERT (
    SELECT COUNT(*) FROM public.saved_jobs WHERE user_id = v_user_a
  ) = 1, 'Test 1 FAIL: User A cannot see own saved job';

  -- -------------------------------------------------------------------------
  -- Test 2: User B CANNOT see User A's saved jobs
  -- -------------------------------------------------------------------------
  SET LOCAL "request.jwt.claims" = concat('{"sub":"', v_user_b, '"}');

  ASSERT (
    SELECT COUNT(*) FROM public.saved_jobs WHERE user_id = v_user_a
  ) = 0, 'Test 2 FAIL: User B can see User A saved jobs — RLS BROKEN';

  -- -------------------------------------------------------------------------
  -- Test 3: User B cannot delete User A's saved job
  -- -------------------------------------------------------------------------
  DELETE FROM public.saved_jobs WHERE user_id = v_user_a;
  ASSERT (
    SELECT COUNT(*) FROM public.saved_jobs WHERE user_id = v_user_a
  ) = 1, 'Test 3 FAIL: User B deleted User A saved job — RLS BROKEN';

  RESET role;
  RESET "request.jwt.claims";

  RAISE NOTICE 'RLS saved_jobs: ALL TESTS PASSED';

  -- Cleanup
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
END;
$$;

ROLLBACK;
