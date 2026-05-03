-- =============================================================================
-- Migration: saved_jobs
-- User bookmarks. Also tracks application lifecycle status (FM07, FM08).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'applied', 'rejected', 'interviewing', 'offered')),
  notes       TEXT,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Feed: user's saved jobs, newest first
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_saved_at
  ON public.saved_jobs (user_id, saved_at DESC);

-- Status filter on saved jobs page
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_status
  ON public.saved_jobs (user_id, status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_jobs_select_own"
  ON public.saved_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "saved_jobs_insert_own"
  ON public.saved_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_jobs_update_own"
  ON public.saved_jobs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_jobs_delete_own"
  ON public.saved_jobs FOR DELETE
  USING (user_id = auth.uid());
