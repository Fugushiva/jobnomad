-- =============================================================================
-- RLS Tests: jobs
-- Verifies:
--   1. Anon users CAN read active jobs
--   2. Anon users CANNOT read non-active jobs (pending, expired)
--   3. Authenticated users CANNOT insert jobs (service_role only)
-- =============================================================================

BEGIN;

SELECT plan(4);

DO $$
DECLARE
  v_user_a     UUID := gen_random_uuid();
  v_active_id  UUID;
  v_pending_id UUID;
  v_expired_id UUID;
  v_anon_active  INTEGER;
  v_anon_pending INTEGER;
  v_anon_expired INTEGER;
  v_inserted_after BOOLEAN;
BEGIN
  -- Setup: auth user + 3 jobs in different statuses (service_role bypasses RLS)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user_a, 'jobs_rls@jobnomad.test', 'x', now(), now(), now());

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

  -- Become anon
  SET LOCAL role = 'anon';

  SELECT COUNT(*) INTO v_anon_active  FROM public.jobs WHERE id = v_active_id;
  SELECT COUNT(*) INTO v_anon_pending FROM public.jobs WHERE id = v_pending_id;
  SELECT COUNT(*) INTO v_anon_expired FROM public.jobs WHERE id = v_expired_id;

  -- Become authenticated and try to insert a job
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims', concat('{"sub":"', v_user_a, '"}'), true);

  v_inserted_after := FALSE;
  BEGIN
    INSERT INTO public.jobs (source, source_url, title, company, description, status, hash_dedup)
    VALUES ('remoteok', 'https://hacked.com', 'Hacked', 'Evil', 'Bad', 'active',
      encode(digest('hacked-job', 'sha256'), 'hex'));
    v_inserted_after := TRUE;
  EXCEPTION WHEN OTHERS THEN
    -- Expected: RLS / privilege denied
    v_inserted_after := FALSE;
  END;

  -- Switch to service_role for ground-truth verification
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);

  CREATE TEMP TABLE _rls_jobs_ctx (
    anon_active INTEGER, anon_pending INTEGER, anon_expired INTEGER,
    inserted_as_authenticated BOOLEAN
  ) ON COMMIT DROP;
  INSERT INTO _rls_jobs_ctx VALUES (v_anon_active, v_anon_pending, v_anon_expired, v_inserted_after);

  DELETE FROM auth.users WHERE id = v_user_a;
END;
$$;

SELECT is(
  (SELECT anon_active FROM _rls_jobs_ctx),
  1,
  'anon CAN read active jobs'
);

SELECT is(
  (SELECT anon_pending FROM _rls_jobs_ctx),
  0,
  'anon CANNOT read pending jobs'
);

SELECT is(
  (SELECT anon_expired FROM _rls_jobs_ctx),
  0,
  'anon CANNOT read expired jobs'
);

SELECT is(
  (SELECT inserted_as_authenticated FROM _rls_jobs_ctx),
  FALSE,
  'authenticated CANNOT insert jobs (service_role only)'
);

SELECT * FROM finish();
ROLLBACK;
