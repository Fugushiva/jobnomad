-- =============================================================================
-- Migration: job_views
-- Tracks user interactions with job cards. Dual purpose:
--   1. Free-tier quota counting (FM10: 20-30 views/day for free users)
--   2. Analytics: click-through rate, dismiss signals for future ranking
-- Retention: 60 days (phase 1) per §5.4
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  action      TEXT NOT NULL
    CHECK (action IN ('view', 'click_apply', 'dismiss')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Free-tier quota check: count views for user today
CREATE INDEX IF NOT EXISTS idx_job_views_user_date
  ON public.job_views (user_id, created_at DESC);

-- Analytics: job-level stats
CREATE INDEX IF NOT EXISTS idx_job_views_job_action
  ON public.job_views (job_id, action);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_views_select_own"
  ON public.job_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "job_views_insert_own"
  ON public.job_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No update/delete: views are immutable audit records
