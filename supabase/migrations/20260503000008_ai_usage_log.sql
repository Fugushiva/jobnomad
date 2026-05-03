-- =============================================================================
-- Migration: ai_usage_log
-- Immutable audit trail of every AI API call (Gemini, OpenAI).
-- Required by §4 (AI pipeline conventions): "Every AI call writes a row here."
-- Used for cost monitoring and compliance (no PII in prompts rule).
-- Retention: 180 days (phase 1) per §5.4
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL for system/cron calls not tied to a specific user
  -- ON DELETE SET NULL: keep the cost record even after user deletes account
  job_id      UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  -- NULL for embedding/user-profile calls
  feature     TEXT NOT NULL,
  -- e.g. 'extraction', 'embedding_job', 'embedding_profile', 'cover_letter'
  model_used  TEXT NOT NULL,
  -- e.g. 'gemini-2.5-flash-lite', 'text-embedding-3-small'
  tokens_in   INTEGER CHECK (tokens_in IS NULL OR tokens_in >= 0),
  tokens_out  INTEGER CHECK (tokens_out IS NULL OR tokens_out >= 0),
  cost_usd    NUMERIC(10, 6) CHECK (cost_usd IS NULL OR cost_usd >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  -- Call latency in ms, useful for SLA monitoring
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  -- FALSE on API error or Zod validation failure
  error_code  TEXT,
  -- Gemini/OpenAI error code if success=false
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Cost monitoring: sum by model over time
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_model_date
  ON public.ai_usage_log (model_used, created_at DESC);

-- User-level cost attribution (for future per-user quotas)
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_date
  ON public.ai_usage_log (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Feature breakdown
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature
  ON public.ai_usage_log (feature, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (informational, not exposed in MVP UI but ready)
CREATE POLICY "ai_usage_log_select_own"
  ON public.ai_usage_log FOR SELECT
  USING (user_id = auth.uid());

-- Only service_role inserts. No auth.uid() INSERT policy.
