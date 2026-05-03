-- =============================================================================
-- Migration: feedback_extraction
-- Stores user-reported extraction errors (§8 Stratégie IA: "signaler une erreur
-- d'extraction" button on each job card).
-- Used for: manual prompt improvement, weekly sampling (§7.1), drift detection.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_extraction (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  field_name  TEXT NOT NULL,
  -- Which field is wrong: 'geo_policy', 'timezone', 'contract_type', 'salary', 'red_flags', 'other'
  reported_value TEXT,
  -- What the AI extracted (snapshot at report time)
  correct_value  TEXT,
  -- What the user believes is correct (freeform)
  comment        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'applied', 'rejected')),
  -- 'applied' = feedback used to improve prompt; 'rejected' = AI was right
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id, field_name)
  -- One feedback per field per user per job to prevent spam
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_feedback_extraction_status
  ON public.feedback_extraction (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_extraction_job
  ON public.feedback_extraction (job_id, field_name);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedback_extraction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_extraction_select_own"
  ON public.feedback_extraction FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "feedback_extraction_insert_own"
  ON public.feedback_extraction FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own feedback (correct a mistake)
CREATE POLICY "feedback_extraction_update_own"
  ON public.feedback_extraction FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete: feedback is an audit trail, soft-reject instead
