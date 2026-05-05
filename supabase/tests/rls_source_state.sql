-- =============================================================================
-- RLS Test: source_state
-- Verifies that authenticated and anonymous users cannot access source_state.
-- Only service_role (via bypass RLS) can read/write.
--
-- Run: psql $DATABASE_URL -f supabase/tests/rls_source_state.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Setup: create a test user
-- ---------------------------------------------------------------------------

SELECT plan(4);

-- Simulate an authenticated user (uses the same pattern as other RLS tests)
SET LOCAL role TO authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

-- ---------------------------------------------------------------------------
-- Test 1: authenticated user cannot SELECT from source_state
-- ---------------------------------------------------------------------------

SELECT is(
  (SELECT count(*)::integer FROM public.source_state),
  0,
  'authenticated user: SELECT on source_state returns 0 rows (RLS blocked)'
);

-- ---------------------------------------------------------------------------
-- Test 2: authenticated user cannot INSERT into source_state
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.source_state (source) VALUES ('remoteok')$$,
  '42501',
  NULL,
  'authenticated user: INSERT on source_state is blocked by RLS'
);

-- ---------------------------------------------------------------------------
-- Test 3: anonymous user cannot SELECT from source_state
-- ---------------------------------------------------------------------------

SET LOCAL role TO anon;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT count(*)::integer FROM public.source_state),
  0,
  'anon user: SELECT on source_state returns 0 rows (RLS blocked)'
);

-- ---------------------------------------------------------------------------
-- Test 4: anonymous user cannot INSERT into source_state
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.source_state (source) VALUES ('remoteok')$$,
  '42501',
  NULL,
  'anon user: INSERT on source_state is blocked by RLS'
);

-- ---------------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------------

SELECT * FROM finish();

ROLLBACK;
