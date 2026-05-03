-- =============================================================================
-- Migration: Triggers
-- updated_at auto-update for tables that expose this column.
-- Pattern: single reusable trigger function, applied to each table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reusable trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Apply to user_profiles
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Apply to subscriptions
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Apply to saved_jobs
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_saved_jobs_updated_at ON public.saved_jobs;
CREATE TRIGGER trg_saved_jobs_updated_at
  BEFORE UPDATE ON public.saved_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create free subscription row on user profile completion
-- This trigger fires when onboarding_completed_at is set for the first time.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_profile_onboarding_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when onboarding_completed_at transitions from NULL to a value
  IF OLD.onboarding_completed_at IS NULL AND NEW.onboarding_completed_at IS NOT NULL THEN
    PERFORM public.ensure_subscription_row(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_onboarding_complete ON public.user_profiles;
CREATE TRIGGER trg_profile_onboarding_complete
  AFTER UPDATE OF onboarding_completed_at ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_onboarding_complete();
