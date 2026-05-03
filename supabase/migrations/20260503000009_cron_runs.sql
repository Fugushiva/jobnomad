-- =============================================================================
-- Migration: cron_runs
-- Health tracking table for Vercel Cron jobs.
-- Referenced in §8.6: "Monitoring du dernier run cron via table cron_runs."
-- Used by UptimeRobot custom HTTP check and internal alerting.
-- NOT exposed to end users (no user RLS — service_role only).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cron_name       TEXT NOT NULL,
  -- 'ingest', 'digest', 'cleanup'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  -- NULL = still running or crashed
  status          TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  jobs_fetched    INTEGER,
  jobs_new        INTEGER,
  jobs_skipped    INTEGER,
  -- Skipped due to dedup
  jobs_failed     INTEGER,
  emails_sent     INTEGER,
  rows_deleted    INTEGER,
  duration_ms     INTEGER,
  error_message   TEXT,
  metadata        JSONB
  -- Any extra cron-specific stats as a safety valve
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Latest run per cron job (UptimeRobot health check query)
CREATE INDEX IF NOT EXISTS idx_cron_runs_name_started
  ON public.cron_runs (cron_name, started_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated users — this is admin/monitoring data only.
-- service_role bypasses RLS for all operations.
-- Exposing via a secure admin endpoint is a phase 2 concern.
