-- =============================================================================
-- RLS Tests: auth_rate_limits
-- Verifies that anon and authenticated users CANNOT access the table,
-- and that only service_role can read/write/call RPCs.
-- =============================================================================

BEGIN;

-- Plan: 6 tests
SELECT plan(6);

-- ---------------------------------------------------------------------------
-- Test 1: anon cannot SELECT from auth_rate_limits
-- ---------------------------------------------------------------------------
SET ROLE anon;
SELECT throws_ok(
  $$SELECT * FROM public.auth_rate_limits$$,
  '42501',  -- insufficient_privilege
  NULL,
  'anon cannot SELECT from auth_rate_limits'
);

-- ---------------------------------------------------------------------------
-- Test 2: anon cannot INSERT into auth_rate_limits
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.auth_rate_limits (ip_hash, attempts, window_start) VALUES ('test_hash', 1, now())$$,
  '42501',
  NULL,
  'anon cannot INSERT into auth_rate_limits'
);

-- ---------------------------------------------------------------------------
-- Test 3: anon cannot call check_auth_rate_limit
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT public.check_auth_rate_limit('test_hash')$$,
  '42501',
  NULL,
  'anon cannot call check_auth_rate_limit'
);

-- ---------------------------------------------------------------------------
-- Test 4: authenticated cannot SELECT from auth_rate_limits
-- ---------------------------------------------------------------------------
SET ROLE authenticated;
SELECT throws_ok(
  $$SELECT * FROM public.auth_rate_limits$$,
  '42501',
  NULL,
  'authenticated cannot SELECT from auth_rate_limits'
);

-- ---------------------------------------------------------------------------
-- Test 5: authenticated cannot call check_auth_rate_limit
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT public.check_auth_rate_limit('test_hash')$$,
  '42501',
  NULL,
  'authenticated cannot call check_auth_rate_limit'
);

-- ---------------------------------------------------------------------------
-- Test 6: authenticated cannot call cleanup_auth_rate_limits
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT public.cleanup_auth_rate_limits()$$,
  '42501',
  NULL,
  'authenticated cannot call cleanup_auth_rate_limits'
);

-- Finish
SELECT * FROM finish();
ROLLBACK;
