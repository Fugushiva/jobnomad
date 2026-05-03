-- =============================================================================
-- Migration: cleanup_expired_data()
-- Called by /api/cron/cleanup every Sunday (vercel.json schedule: "0 2 * * 0").
-- Implements phase 1 retention policy from §5.4:
--   - jobs status='active'     → expire after 14 days
--   - jobs status='expired'    → delete after 30 days
--   - job_views                → delete after 60 days
--   - email_digests            → delete after 30 days
--   - ai_usage_log             → delete after 180 days
--   - feedback_extraction      → delete after 180 days (keep for prompt analysis)
--   - cron_runs                → delete after 90 days
-- RGPD: user deletion is handled by auth.users cascade, soft-delete tracked here.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs_expired    INTEGER := 0;
  v_jobs_deleted    INTEGER := 0;
  v_views_deleted   INTEGER := 0;
  v_digests_deleted INTEGER := 0;
  v_ai_log_deleted  INTEGER := 0;
  v_feedback_deleted INTEGER := 0;
  v_cron_deleted    INTEGER := 0;
  v_result          JSONB;
BEGIN
  -- 1. Mark active jobs older than 14 days as expired
  UPDATE public.jobs
  SET status = 'expired'
  WHERE status = 'active'
    AND ingested_at < now() - INTERVAL '14 days';
  GET DIAGNOSTICS v_jobs_expired = ROW_COUNT;

  -- 2. Delete expired jobs older than 30 days
  --    (hard delete: cascades to saved_jobs, job_views, feedback_extraction)
  DELETE FROM public.jobs
  WHERE status = 'expired'
    AND ingested_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_jobs_deleted = ROW_COUNT;

  -- 3. Delete job_views older than 60 days
  DELETE FROM public.job_views
  WHERE created_at < now() - INTERVAL '60 days';
  GET DIAGNOSTICS v_views_deleted = ROW_COUNT;

  -- 4. Delete email_digests older than 30 days
  DELETE FROM public.email_digests
  WHERE sent_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_digests_deleted = ROW_COUNT;

  -- 5. Delete ai_usage_log older than 180 days
  DELETE FROM public.ai_usage_log
  WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS v_ai_log_deleted = ROW_COUNT;

  -- 6. Delete feedback_extraction older than 180 days
  DELETE FROM public.feedback_extraction
  WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS v_feedback_deleted = ROW_COUNT;

  -- 7. Delete cron_runs older than 90 days
  DELETE FROM public.cron_runs
  WHERE started_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_cron_deleted = ROW_COUNT;

  -- Build result JSON (returned to cron handler for logging to cron_runs)
  v_result := jsonb_build_object(
    'jobs_expired',      v_jobs_expired,
    'jobs_deleted',      v_jobs_deleted,
    'views_deleted',     v_views_deleted,
    'digests_deleted',   v_digests_deleted,
    'ai_log_deleted',    v_ai_log_deleted,
    'feedback_deleted',  v_feedback_deleted,
    'cron_runs_deleted', v_cron_deleted,
    'ran_at',            now()
  );

  RETURN v_result;
END;
$$;

-- Only service_role can call this (cron handler uses service_role client)
-- Do NOT grant to authenticated or anon
REVOKE ALL ON FUNCTION public.cleanup_expired_data FROM PUBLIC;
