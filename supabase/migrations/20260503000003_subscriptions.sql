-- =============================================================================
-- Migration: subscriptions
-- One row per user, upserted by the Stripe webhook handler.
-- Created with tier='free' when user completes onboarding.
-- Updated to tier='pro' on Stripe subscription activation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  tier                    TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'pro')),
  current_period_end      TIMESTAMPTZ,
  -- NULL for free tier; set to billing period end for pro
  trial_end               TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Users cannot directly insert/update/delete subscriptions.
-- Only service_role (Stripe webhook handler) mutates this table.
-- No INSERT/UPDATE/DELETE policies for auth.uid() — service_role bypasses RLS.
