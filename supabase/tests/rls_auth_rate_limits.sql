-- =============================================================================
-- RLS Tests: auth_rate_limits
-- Verifies that anon and authenticated users have NO privileges on the table
-- or the rate-limit RPCs, and that only service_role can use them.
--
-- NOTE: We use catalog-based assertions (function_privs_are / table_privs_are)
-- rather than calling the RPCs from the anon/authenticated roles. The Supabase
-- pg17 dev image (PostgreSQL 17.6 + supautils) crashes the backend with a
-- SIGSEGV when a role without EXECUTE privilege invokes a user-defined
-- function. The privilege catalog is the canonical source of truth for the
-- security boundary anyway, so this test is both safe and equivalent.
-- =============================================================================

BEGIN;

SELECT plan(8);

-- ---------------------------------------------------------------------------
-- Table: auth_rate_limits
-- anon and authenticated must have ZERO privileges on the table.
-- service_role must have full DML.
-- ---------------------------------------------------------------------------

SELECT table_privs_are(
  'public', 'auth_rate_limits', 'anon',
  ARRAY[]::TEXT[],
  'anon has no privileges on auth_rate_limits'
);

SELECT table_privs_are(
  'public', 'auth_rate_limits', 'authenticated',
  ARRAY[]::TEXT[],
  'authenticated has no privileges on auth_rate_limits'
);

SELECT table_privs_are(
  'public', 'auth_rate_limits', 'service_role',
  ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'],
  'service_role has full privileges on auth_rate_limits'
);

-- ---------------------------------------------------------------------------
-- RPC: check_auth_rate_limit(text, integer, integer)
-- Only service_role may EXECUTE.
-- ---------------------------------------------------------------------------

SELECT function_privs_are(
  'public', 'check_auth_rate_limit', ARRAY['text', 'integer', 'integer'],
  'anon', ARRAY[]::TEXT[],
  'anon cannot EXECUTE check_auth_rate_limit'
);

SELECT function_privs_are(
  'public', 'check_auth_rate_limit', ARRAY['text', 'integer', 'integer'],
  'authenticated', ARRAY[]::TEXT[],
  'authenticated cannot EXECUTE check_auth_rate_limit'
);

SELECT function_privs_are(
  'public', 'check_auth_rate_limit', ARRAY['text', 'integer', 'integer'],
  'service_role', ARRAY['EXECUTE'],
  'service_role can EXECUTE check_auth_rate_limit'
);

-- ---------------------------------------------------------------------------
-- RPC: cleanup_auth_rate_limits(integer)
-- Only service_role may EXECUTE.
-- ---------------------------------------------------------------------------

SELECT function_privs_are(
  'public', 'cleanup_auth_rate_limits', ARRAY['integer'],
  'authenticated', ARRAY[]::TEXT[],
  'authenticated cannot EXECUTE cleanup_auth_rate_limits'
);

SELECT function_privs_are(
  'public', 'cleanup_auth_rate_limits', ARRAY['integer'],
  'service_role', ARRAY['EXECUTE'],
  'service_role can EXECUTE cleanup_auth_rate_limits'
);

-- Finish
SELECT * FROM finish();
ROLLBACK;
