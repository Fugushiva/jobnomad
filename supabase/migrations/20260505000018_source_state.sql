-- =============================================================================
-- Migration: source_state
-- Tracks per-source HTTP state for conditional GET (ETag/Last-Modified)
-- and consecutive failure counting.
--
-- Written by the ingestion cron (service_role) before and after each run.
-- Used by: src/lib/sources/adapters/*.ts (via ingest.ts)
--
-- Security: RLS ENABLED, zero user-facing policies.
-- Only service_role can read/write (same pattern as cron_runs).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.source_state (
  -- Primary key: the source identifier (matches jobs.source CHECK constraint)
  source TEXT PRIMARY KEY
    CHECK (source IN ('remoteok', 'wwr', 'himalayas', 'workingnomads')),

  -- HTTP conditional GET state
  last_fetched_at TIMESTAMPTZ,
  -- Value of the ETag header from the last successful fetch
  -- Used in the next request as If-None-Match
  last_etag       TEXT,
  -- Value of the Last-Modified header from the last successful fetch
  -- Used in the next request as If-Modified-Since
  last_modified   TEXT,

  -- Failure tracking (for observability — not circuit breaking in phase 1)
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  -- Brief error message from the last failure (never includes PII/secrets)

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Comment on columns
-- ---------------------------------------------------------------------------

COMMENT ON TABLE  public.source_state IS
  'HTTP conditional GET state and failure tracking per ingestion source. Admin-only (service_role).';

COMMENT ON COLUMN public.source_state.last_etag IS
  'ETag from last successful HTTP response — sent as If-None-Match on next fetch.';

COMMENT ON COLUMN public.source_state.last_modified IS
  'Last-Modified from last HTTP response — sent as If-Modified-Since on next fetch.';

COMMENT ON COLUMN public.source_state.consecutive_failures IS
  'Resets to 0 on each successful fetch. Incremented on any fetch error.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.source_state ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated or anonymous users.
-- service_role bypasses RLS for all INSERT/UPDATE/SELECT operations.
-- This is the same pattern as cron_runs (admin-only data).
-- Exposing via a secure admin endpoint is a phase 2 concern.

-- ---------------------------------------------------------------------------
-- Seed: pre-create rows for all supported sources
-- The cron will upsert these on every run — no init required.
-- But pre-seeding ensures the rows exist before the first cron run
-- without needing an extra INSERT in the application code.
-- ---------------------------------------------------------------------------

INSERT INTO public.source_state (source, consecutive_failures)
VALUES
  ('remoteok',      0),
  ('wwr',           0),
  ('himalayas',     0),
  ('workingnomads', 0)
ON CONFLICT (source) DO NOTHING;
