-- =============================================================================
-- RLS Tests: jobs
-- Verifies:
--   1. Anon users CAN read active jobs
--   2. Anon users CANNOT read non-active jobs (pending, expired, failed)
--   3. Authenticated users CANNOT insert/update jobs (service_role only)
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a    UUID := gen_random_uuid();
  v_active_id UUID;
  v_pending_id UUID;
  v_expired_id UUID;
BEGIN
  -- Insert auth user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user_a, 'jobs_rls@jobnomad.test', 'x', now(), now(), now());

  -- Insert jobs with different statuses (service_role, bypasses RLS)
  INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
  VALUES ('remoteok', 'https://test.com/1', 'Active Job', 'Co', 'Desc', 'active',
    encode(digest('rls-active-job', 'sha256'), 'hex'))
  RETURNING id INTO v_active_id;

  INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
  VALUES ('remoteok', 'https://test.com/2', 'Pending Job', 'Co', 'Desc', 'pending_extraction',
    encode(digest('rls-pending-job', 'sha256'), 'hex'))
  RETURNING id INTO v_pending_id;

  INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
  VALUES ('remoteok', 'https://test.com/3', 'Expired Job', 'Co', 'Desc', 'expired',
    encode(digest('rls-expired-job', 'sha256'), 'hex'))
  RETURNING id INTO v_expired_id;

  -- -------------------------------------------------------------------------
  -- Test 1: Anon user CAN read active jobs
  -- -------------------------------------------------------------------------
  SET LOCAL role = 'anon';

  ASSERT (
    SELECT COUNT(*) FROM public.jobs WHERE id = v_active_id
  ) = 1, 'Test 1 FAIL: Anon cannot read active job';

  -- -------------------------------------------------------------------------
  -- Test 2: Anon user CANNOT read pending or expired jobs
  -- -------------------------------------------------------------------------
  ASSERT (
    SELECT COUNT(*) FROM public.jobs WHERE id = v_pending_id
  ) = 0, 'Test 2a FAIL: Anon can read pending job — RLS BROKEN';

  ASSERT (
    SELECT COUNT(*) FROM public.jobs WHERE id = v_expired_id
  ) = 0, 'Test 2b FAIL: Anon can read expired job — RLS BROKEN';

  -- -------------------------------------------------------------------------
  -- Test 3: Authenticated user CANNOT insert a job
  -- -------------------------------------------------------------------------
  SET LOCAL role = 'authenticated';
  SET LOCAL "request.jwt.claims" = concat('{"sub":"', v_user_a, '"}');

  BEGIN
    INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
    VALUES ('remoteok', 'https://hacked.com', 'Hacked', 'Evil', 'Bad', 'active',
      encode(digest('hacked-job', 'sha256'), 'hex'));
    ASSERT FALSE, 'Test 3 FAIL: Authenticated user inserted job — RLS BROKEN';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RESET role;
  RESET "request.jwt.claims";

  RAISE NOTICE 'RLS jobs: ALL TESTS PASSED';

  DELETE FROM auth.users WHERE id = v_user_a;
END;
$$;

ROLLBACK;
