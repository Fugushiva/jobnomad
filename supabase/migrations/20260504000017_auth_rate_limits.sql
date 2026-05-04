-- =============================================================================
-- Migration: auth_rate_limits
-- Token-bucket rate limiting for magic link requests.
-- IP addresses are SHA-256 hashed with a pepper — no PII stored (RGPD).
-- Only service_role can read/write (no RLS policies for anon/authenticated).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  ip_hash       TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 1,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash)
);

-- RLS enabled but NO policies → only service_role can access
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Index for cleanup queries
CREATE INDEX idx_auth_rate_limits_window
  ON public.auth_rate_limits (window_start);

COMMENT ON TABLE public.auth_rate_limits IS
  'Token-bucket rate limiting for auth endpoints. ip_hash = sha256(ip + pepper). Cleaned up by cron every 24h.';

-- ---------------------------------------------------------------------------
-- RPC: check_auth_rate_limit
-- Returns TRUE if the request is allowed, FALSE if rate-limited.
-- Atomic: INSERT ... ON CONFLICT with window reset logic.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(
  p_ip_hash TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Try to get existing record
  SELECT attempts, window_start
    INTO v_attempts, v_window_start
    FROM public.auth_rate_limits
   WHERE ip_hash = p_ip_hash
   FOR UPDATE;  -- Lock the row for atomic update

  IF NOT FOUND THEN
    -- First attempt: insert new record
    INSERT INTO public.auth_rate_limits (ip_hash, attempts, window_start)
    VALUES (p_ip_hash, 1, now());
    RETURN TRUE;
  END IF;

  -- Check if window has expired → reset
  IF v_window_start + (p_window_minutes || ' minutes')::INTERVAL < now() THEN
    UPDATE public.auth_rate_limits
       SET attempts = 1,
           window_start = now()
     WHERE ip_hash = p_ip_hash;
    RETURN TRUE;
  END IF;

  -- Window still active: check limit
  IF v_attempts >= p_max_attempts THEN
    RETURN FALSE;  -- Rate limited
  END IF;

  -- Increment attempts
  UPDATE public.auth_rate_limits
     SET attempts = attempts + 1
   WHERE ip_hash = p_ip_hash;

  RETURN TRUE;
END;
$$;

-- Security: only service_role can call this function
REVOKE ALL ON FUNCTION public.check_auth_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_auth_rate_limit(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_auth_rate_limit(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: cleanup_auth_rate_limits
-- Called by /api/cron/cleanup to purge expired windows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_auth_rate_limits(
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.auth_rate_limits
   WHERE window_start < now() - (p_max_age_hours || ' hours')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_auth_rate_limits(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_auth_rate_limits(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_auth_rate_limits(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_auth_rate_limits(INTEGER) TO service_role;

-- Revoke direct table access from non-service roles
REVOKE ALL ON public.auth_rate_limits FROM PUBLIC;
REVOKE ALL ON public.auth_rate_limits FROM anon;
REVOKE ALL ON public.auth_rate_limits FROM authenticated;
GRANT ALL ON public.auth_rate_limits TO service_role;
