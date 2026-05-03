-- =============================================================================
-- Migration: Revoke remaining anon/authenticated EXECUTE grants
-- Fixes 4 remaining security advisor warnings after migration 15.
-- =============================================================================

-- ensure_subscription_row: trigger-only, never called via RPC
-- anon and authenticated should not be able to create subscription rows
REVOKE EXECUTE ON FUNCTION public.ensure_subscription_row(UUID) FROM anon, authenticated;

-- on_profile_onboarding_complete: trigger function, never called directly
REVOKE EXECUTE ON FUNCTION public.on_profile_onboarding_complete() FROM anon, authenticated;

-- free_tier_remaining: has internal auth check, but revoke anon anyway
-- (authenticated keeps EXECUTE — they need it to check their own quota)
REVOKE EXECUTE ON FUNCTION public.free_tier_remaining(UUID) FROM anon;

-- match_jobs_for_user: has internal auth check, but revoke anon anyway
-- (authenticated keeps EXECUTE — they need it for the feed)
REVOKE EXECUTE ON FUNCTION public.match_jobs_for_user(
  UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT[], TEXT
) FROM anon;
