-- =============================================================================
-- Migration: upsert_subscription()
-- Called by the Stripe webhook handler (/api/webhooks/stripe) via service_role.
-- Handles: checkout.session.completed, customer.subscription.updated,
--          customer.subscription.deleted, invoice.payment_failed
-- Ensures subscriptions row always exists and is consistent with Stripe state.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upsert_subscription(
  p_user_id               UUID,
  p_stripe_customer_id    TEXT,
  p_stripe_subscription_id TEXT,
  p_status                TEXT,
  p_tier                  TEXT,
  p_current_period_end    TIMESTAMPTZ DEFAULT NULL,
  p_trial_end             TIMESTAMPTZ DEFAULT NULL,
  p_cancel_at_period_end  BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    tier,
    current_period_end,
    trial_end,
    cancel_at_period_end,
    updated_at
  )
  VALUES (
    p_user_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_status,
    p_tier,
    p_current_period_end,
    p_trial_end,
    p_cancel_at_period_end,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    stripe_customer_id      = EXCLUDED.stripe_customer_id,
    stripe_subscription_id  = EXCLUDED.stripe_subscription_id,
    status                  = EXCLUDED.status,
    tier                    = EXCLUDED.tier,
    current_period_end      = EXCLUDED.current_period_end,
    trial_end               = EXCLUDED.trial_end,
    cancel_at_period_end    = EXCLUDED.cancel_at_period_end,
    updated_at              = now();
END;
$$;

-- Only service_role (Stripe webhook handler)
REVOKE ALL ON FUNCTION public.upsert_subscription FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- ensure_subscription_row()
-- Called after onboarding completion to guarantee a free-tier row exists.
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_subscription_row(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, tier)
  VALUES (p_user_id, 'active', 'free')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_subscription_row TO authenticated;
