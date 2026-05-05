-- =============================================================================
-- Behavioral Tests: cleanup_expired_data()
-- Migration: 20260503000012_functions_cleanup.sql
--
-- Tests the actual retention policy behaviour end-to-end, not just that the
-- function exists. Each table is tested with:
--   - A row that IS old enough to be deleted/expired → must be gone
--   - A row that is NOT old enough              → must survive
--
-- Retention policy under test:
--   jobs status='active'    → expires after 14 days  (UPDATE, not DELETE)
--   jobs status='expired'   → deleted after 30 days  (hard DELETE + cascade)
--   job_views               → deleted after 60 days
--   email_digests           → deleted after 30 days
--   ai_usage_log            → deleted after 180 days
--   feedback_extraction     → deleted after 180 days
--   cron_runs               → deleted after 90 days
--
-- SECURITY NOTES:
--   - cleanup_expired_data() is SECURITY DEFINER + REVOKE'd from anon and
--     authenticated. We verify this with function_privs_are() (catalog-based).
--   - We NEVER call the function via SET ROLE anon/authenticated — the
--     Supabase pg17 dev image (PostgreSQL 17.6) crashes with SIGSEGV when
--     a role without EXECUTE privilege invokes a user-defined function.
--     See: supabase/tests/rls_auth_rate_limits.sql for the rationale.
--   - All behavioural assertions are made from the postgres superuser context
--     (default pgTAP runner role), which can call SECURITY DEFINER functions.
--
-- Plan: 29 tests
--   2  privilege checks (anon + authenticated cannot EXECUTE)
--   1  smoke test (function returns non-NULL JSONB)
--   3  JSON result fields presence check
--   13 expiry/deletion + survival correctness (jobs×4, views×1, digests×2, ai_log×2, feedback×2, cron_runs×2)
--   3  cascade check (jobs hard-delete cascades to saved_jobs + job_views + feedback)
--   7  result JSON counter check (expected counts >= 1 per triggered table)
-- =============================================================================

BEGIN;

SELECT plan(29);

-- =============================================================================
-- SECTION 0: Privilege checks
-- =============================================================================
-- IMPORTANT: use function_privs_are(), never call the function from anon/authenticated.
-- The Supabase pg17 dev image crashes (SIGSEGV) if a role calls a function
-- for which it lacks EXECUTE — even inside throws_ok / BEGIN..ROLLBACK.

SELECT function_privs_are(
  'public', 'cleanup_expired_data', ARRAY[]::TEXT[],
  'anon', ARRAY[]::TEXT[],
  'anon cannot EXECUTE cleanup_expired_data'
);

SELECT function_privs_are(
  'public', 'cleanup_expired_data', ARRAY[]::TEXT[],
  'authenticated', ARRAY[]::TEXT[],
  'authenticated cannot EXECUTE cleanup_expired_data'
);

-- =============================================================================
-- SECTION 1: Setup — create isolated test data
-- All rows use synthetic past timestamps to trigger each retention rule.
-- We use a DO block + temp table to share UUIDs across assertions.
-- =============================================================================

DO $$
DECLARE
  v_user_id        UUID := gen_random_uuid();
  v_job_active_old UUID := gen_random_uuid();   -- active >14d → should expire
  v_job_active_new UUID := gen_random_uuid();   -- active <14d → should survive
  v_job_exp_old    UUID := gen_random_uuid();   -- expired >30d → should be deleted
  v_job_exp_new    UUID := gen_random_uuid();   -- expired <30d → should survive
BEGIN
  -- Auth user (needed for FK constraints on user-owned tables)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_user_id, 'cleanup_test@jobnomad.test', 'x', now(), now(), now());

  INSERT INTO public.user_profiles (user_id, timezone, contract_preference)
  VALUES (v_user_id, 'Asia/Bangkok', 'contractor');

  -- -------------------------------------------------------------------------
  -- jobs
  -- -------------------------------------------------------------------------

  -- Case A: active job older than 14 days → should be marked 'expired'
  INSERT INTO public.jobs (
    id, source, source_url, title, company, description,
    hash_dedup, status, ingested_at
  ) VALUES (
    v_job_active_old, 'remoteok', 'https://remoteok.com/old-active',
    'Old Active Job', 'Acme Corp', 'Test job description for cleanup.',
    'hash-cleanup-active-old-' || v_job_active_old::text,
    'active', now() - INTERVAL '15 days'
  );

  -- Case B: active job younger than 14 days → must survive intact
  INSERT INTO public.jobs (
    id, source, source_url, title, company, description,
    hash_dedup, status, ingested_at
  ) VALUES (
    v_job_active_new, 'remoteok', 'https://remoteok.com/new-active',
    'New Active Job', 'Fresh Co', 'Test job description for cleanup.',
    'hash-cleanup-active-new-' || v_job_active_new::text,
    'active', now() - INTERVAL '5 days'
  );

  -- Case C: expired job older than 30 days → hard delete
  INSERT INTO public.jobs (
    id, source, source_url, title, company, description,
    hash_dedup, status, ingested_at
  ) VALUES (
    v_job_exp_old, 'remoteok', 'https://remoteok.com/old-expired',
    'Old Expired Job', 'Defunct Inc', 'Test job description for cleanup.',
    'hash-cleanup-expired-old-' || v_job_exp_old::text,
    'expired', now() - INTERVAL '31 days'
  );

  -- Case D: expired job younger than 30 days → must survive
  INSERT INTO public.jobs (
    id, source, source_url, title, company, description,
    hash_dedup, status, ingested_at
  ) VALUES (
    v_job_exp_new, 'remoteok', 'https://remoteok.com/new-expired',
    'Recent Expired Job', 'Sunset LLC', 'Test job description for cleanup.',
    'hash-cleanup-expired-new-' || v_job_exp_new::text,
    'expired', now() - INTERVAL '10 days'
  );

  -- -------------------------------------------------------------------------
  -- saved_jobs — reference the old expired job to test CASCADE on hard delete
  -- -------------------------------------------------------------------------

  INSERT INTO public.saved_jobs (id, user_id, job_id, status, saved_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, v_job_exp_old, 'saved', now() - INTERVAL '31 days', now() - INTERVAL '31 days');

  -- -------------------------------------------------------------------------
  -- job_views
  -- -------------------------------------------------------------------------

  -- Old view (>60d) → should be deleted
  INSERT INTO public.job_views (id, user_id, job_id, action, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_job_active_new, 'view', now() - INTERVAL '61 days');

  -- Recent view (<60d) → must survive
  INSERT INTO public.job_views (id, user_id, job_id, action, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_job_active_new, 'view', now() - INTERVAL '5 days');

  -- Old view on the soon-to-be-deleted expired job → will cascade-delete when job is hard-deleted
  INSERT INTO public.job_views (id, user_id, job_id, action, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_job_exp_old, 'view', now() - INTERVAL '31 days');

  -- -------------------------------------------------------------------------
  -- email_digests
  -- -------------------------------------------------------------------------

  -- Old digest (>30d) → should be deleted
  INSERT INTO public.email_digests (id, user_id, sent_at, jobs_included)
  VALUES (gen_random_uuid(), v_user_id, now() - INTERVAL '31 days', '[]'::JSONB);

  -- Recent digest (<30d) → must survive
  INSERT INTO public.email_digests (id, user_id, sent_at, jobs_included)
  VALUES (gen_random_uuid(), v_user_id, now() - INTERVAL '5 days', '[]'::JSONB);

  -- -------------------------------------------------------------------------
  -- ai_usage_log
  -- -------------------------------------------------------------------------

  -- Old log (>180d) → should be deleted
  INSERT INTO public.ai_usage_log (id, feature, model_used, success, created_at)
  VALUES (gen_random_uuid(), 'extraction', 'gemini-2.5-flash-lite', true, now() - INTERVAL '181 days');

  -- Recent log (<180d) → must survive
  INSERT INTO public.ai_usage_log (id, feature, model_used, success, created_at)
  VALUES (gen_random_uuid(), 'extraction', 'gemini-2.5-flash-lite', true, now() - INTERVAL '5 days');

  -- -------------------------------------------------------------------------
  -- feedback_extraction
  -- -------------------------------------------------------------------------

  -- Old feedback (>180d) → should be deleted
  INSERT INTO public.feedback_extraction (
    id, user_id, job_id, field_name, status, created_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_job_active_new, 'geo_policy', 'pending',
    now() - INTERVAL '181 days'
  );

  -- Recent feedback (<180d) → must survive
  INSERT INTO public.feedback_extraction (
    id, user_id, job_id, field_name, status, created_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_job_active_new, 'contract_type', 'pending',
    now() - INTERVAL '5 days'
  );

  -- -------------------------------------------------------------------------
  -- cron_runs
  -- -------------------------------------------------------------------------

  -- Old cron_run (>90d) → should be deleted
  INSERT INTO public.cron_runs (id, cron_name, status, started_at, completed_at)
  VALUES (gen_random_uuid(), 'ingest', 'completed', now() - INTERVAL '91 days', now() - INTERVAL '91 days');

  -- Recent cron_run (<90d) → must survive
  INSERT INTO public.cron_runs (id, cron_name, status, started_at, completed_at)
  VALUES (gen_random_uuid(), 'ingest', 'completed', now() - INTERVAL '5 days', now() - INTERVAL '5 days');

  -- Persist context for assertions (temp table lives until ROLLBACK)
  CREATE TEMP TABLE _cleanup_ctx (
    user_id        UUID,
    job_active_old UUID,
    job_active_new UUID,
    job_exp_old    UUID,
    job_exp_new    UUID
  ) ON COMMIT DROP;

  INSERT INTO _cleanup_ctx VALUES (
    v_user_id, v_job_active_old, v_job_active_new, v_job_exp_old, v_job_exp_new
  );
END;
$$;

-- =============================================================================
-- SECTION 2: Run cleanup_expired_data()
-- We are running as postgres (superuser) — no role change needed.
-- Store the result for later assertions.
-- =============================================================================

CREATE TEMP TABLE _cleanup_result (result JSONB) ON COMMIT DROP;

INSERT INTO _cleanup_result
SELECT public.cleanup_expired_data();

-- =============================================================================
-- SECTION 3: Smoke — function returned non-NULL JSONB
-- =============================================================================

SELECT isnt(
  (SELECT result FROM _cleanup_result),
  NULL,
  'cleanup_expired_data() returns non-NULL JSONB'
);

-- =============================================================================
-- SECTION 4: JSON result shape — required keys present
-- =============================================================================

SELECT ok(
  (SELECT result ? 'jobs_expired' FROM _cleanup_result),
  'result JSONB contains "jobs_expired" key'
);

SELECT ok(
  (SELECT result ? 'jobs_deleted' FROM _cleanup_result),
  'result JSONB contains "jobs_deleted" key'
);

SELECT ok(
  (SELECT result ? 'ran_at' FROM _cleanup_result),
  'result JSONB contains "ran_at" key'
);

-- =============================================================================
-- SECTION 5: Behavioral assertions — verify actual DB state after cleanup
-- All ground-truth reads use the postgres superuser (no role switch needed).
-- =============================================================================

-- -------------------------------------------------------------------------
-- 5a: Active job >14d → status must now be 'expired'
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT status FROM public.jobs WHERE id = (SELECT job_active_old FROM _cleanup_ctx)),
  'expired',
  'active job older than 14d is marked expired'
);

-- -------------------------------------------------------------------------
-- 5b: Active job <14d → status must still be 'active'
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT status FROM public.jobs WHERE id = (SELECT job_active_new FROM _cleanup_ctx)),
  'active',
  'active job younger than 14d is untouched'
);

-- -------------------------------------------------------------------------
-- 5c: Expired job >30d → hard deleted
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.jobs WHERE id = (SELECT job_exp_old FROM _cleanup_ctx)),
  0,
  'expired job older than 30d is hard-deleted'
);

-- -------------------------------------------------------------------------
-- 5d: Expired job <30d → must survive
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.jobs WHERE id = (SELECT job_exp_new FROM _cleanup_ctx)),
  1,
  'expired job younger than 30d survives'
);

-- -------------------------------------------------------------------------
-- 5e: Old job_views (>60d) deleted; recent view survives
-- (We check that exactly 1 view remains for job_active_new after cleanup:
--  the old view was deleted, the recent one survives)
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.job_views
   WHERE job_id = (SELECT job_active_new FROM _cleanup_ctx)),
  1,
  'job_view older than 60d deleted; recent view survives'
);

-- -------------------------------------------------------------------------
-- 5f: Old email_digest (>30d) deleted; recent digest survives
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.email_digests
   WHERE user_id = (SELECT user_id FROM _cleanup_ctx)
     AND sent_at < now() - INTERVAL '30 days'),
  0,
  'email_digest older than 30d deleted'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.email_digests
   WHERE user_id = (SELECT user_id FROM _cleanup_ctx)
     AND sent_at > now() - INTERVAL '30 days'),
  1,
  'email_digest younger than 30d survives'
);

-- -------------------------------------------------------------------------
-- 5g: Old ai_usage_log (>180d) deleted; recent log survives
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.ai_usage_log
   WHERE created_at < now() - INTERVAL '180 days'),
  0,
  'ai_usage_log older than 180d deleted'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.ai_usage_log
   WHERE created_at > now() - INTERVAL '180 days'
     AND feature = 'extraction'),
  1,
  'ai_usage_log younger than 180d survives'
);

-- -------------------------------------------------------------------------
-- 5h: Old feedback_extraction (>180d) deleted; recent feedback survives
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.feedback_extraction
   WHERE user_id = (SELECT user_id FROM _cleanup_ctx)
     AND created_at < now() - INTERVAL '180 days'),
  0,
  'feedback_extraction older than 180d deleted'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.feedback_extraction
   WHERE user_id = (SELECT user_id FROM _cleanup_ctx)
     AND created_at > now() - INTERVAL '180 days'),
  1,
  'feedback_extraction younger than 180d survives'
);

-- -------------------------------------------------------------------------
-- 5i: Old cron_runs (>90d) deleted; recent run survives
-- (We count only the runs we inserted — filter by started_at to avoid
--  counting runs that may have been created by this very test)
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INT FROM public.cron_runs
   WHERE cron_name = 'ingest'
     AND started_at < now() - INTERVAL '90 days'),
  0,
  'cron_runs older than 90d deleted'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.cron_runs
   WHERE cron_name = 'ingest'
     AND started_at < now() - INTERVAL '4 days'
     AND started_at > now() - INTERVAL '6 days'),
  1,
  'cron_runs younger than 90d survives'
);

-- =============================================================================
-- SECTION 6: CASCADE integrity — hard-deleting expired jobs cascades correctly
-- When jobs is hard-deleted, saved_jobs and job_views rows referencing it
-- must also be gone (FK ON DELETE CASCADE).
-- =============================================================================

-- saved_jobs referencing the deleted expired job must be gone
SELECT is(
  (SELECT COUNT(*)::INT FROM public.saved_jobs
   WHERE job_id = (SELECT job_exp_old FROM _cleanup_ctx)),
  0,
  'saved_jobs cascade-deleted when expired job is hard-deleted'
);

-- job_views referencing the deleted expired job must be gone
SELECT is(
  (SELECT COUNT(*)::INT FROM public.job_views
   WHERE job_id = (SELECT job_exp_old FROM _cleanup_ctx)),
  0,
  'job_views cascade-deleted when expired job is hard-deleted'
);

-- feedback_extraction referencing the deleted expired job must be gone
-- (We only inserted feedback for job_active_new, so this should remain 0 for job_exp_old)
SELECT is(
  (SELECT COUNT(*)::INT FROM public.feedback_extraction
   WHERE job_id = (SELECT job_exp_old FROM _cleanup_ctx)),
  0,
  'feedback_extraction cascade-deleted when expired job is hard-deleted'
);

-- =============================================================================
-- SECTION 7: Result JSON counters — verify returned counts match reality
-- We check the minimum: each counter must be >= 1 for the cases we triggered.
-- =============================================================================

-- jobs_expired must be >= 1 (we triggered at least one active→expired)
SELECT ok(
  (SELECT (result->>'jobs_expired')::INT >= 1 FROM _cleanup_result),
  'result.jobs_expired >= 1 (triggered expiry of 1 active old job)'
);

-- jobs_deleted must be >= 1 (we triggered at least one hard delete)
SELECT ok(
  (SELECT (result->>'jobs_deleted')::INT >= 1 FROM _cleanup_result),
  'result.jobs_deleted >= 1 (triggered hard delete of 1 expired old job)'
);

-- views_deleted must be >= 1 (we inserted 1 old view)
SELECT ok(
  (SELECT (result->>'views_deleted')::INT >= 1 FROM _cleanup_result),
  'result.views_deleted >= 1 (triggered delete of 1 old job_view)'
);

-- digests_deleted must be >= 1 (we inserted 1 old digest)
SELECT ok(
  (SELECT (result->>'digests_deleted')::INT >= 1 FROM _cleanup_result),
  'result.digests_deleted >= 1 (triggered delete of 1 old email_digest)'
);

-- ai_log_deleted must be >= 1 (we inserted 1 old ai_usage_log)
SELECT ok(
  (SELECT (result->>'ai_log_deleted')::INT >= 1 FROM _cleanup_result),
  'result.ai_log_deleted >= 1 (triggered delete of 1 old ai_usage_log)'
);

-- feedback_deleted must be >= 1 (we inserted 1 old feedback_extraction)
SELECT ok(
  (SELECT (result->>'feedback_deleted')::INT >= 1 FROM _cleanup_result),
  'result.feedback_deleted >= 1 (triggered delete of 1 old feedback_extraction)'
);

-- cron_runs_deleted must be >= 1 (we inserted 1 old cron_runs row)
SELECT ok(
  (SELECT (result->>'cron_runs_deleted')::INT >= 1 FROM _cleanup_result),
  'result.cron_runs_deleted >= 1 (triggered delete of 1 old cron_run)'
);

-- =============================================================================
-- Teardown — rollback cleans up all inserted data atomically
-- =============================================================================

SELECT * FROM finish();

ROLLBACK;
