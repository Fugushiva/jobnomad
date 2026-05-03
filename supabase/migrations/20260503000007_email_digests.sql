-- =============================================================================
-- Migration: email_digests
-- Records every digest email sent (FM12: daily digest via Vercel Cron + Resend).
-- Used for debug, delivery tracking, and anti-duplicate guard (don't send twice/day).
-- Retention: 30 days (phase 1) per §5.4
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_digests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  jobs_included JSONB NOT NULL DEFAULT '[]',
  -- Array of job IDs included in this digest snapshot (for click attribution)
  resend_email_id TEXT,
  -- Resend API email ID for bounce/open tracking (optional, set after send)
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Anti-duplicate: check if user already received today's digest
CREATE INDEX IF NOT EXISTS idx_email_digests_user_sent_at
  ON public.email_digests (user_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_digests_select_own"
  ON public.email_digests FOR SELECT
  USING (user_id = auth.uid());

-- Only service_role inserts (cron digest handler). No auth.uid() INSERT policy.
