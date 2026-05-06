/**
 * Rate-limit wrapper for auth endpoints.
 *
 * Uses the Supabase RPC `check_auth_rate_limit` (SECURITY DEFINER)
 * called via the service_role client.
 *
 * IPs are hashed with SHA-256 + pepper before storage (RGPD: no PII in DB).
 */
import { createServiceClient } from '@/src/lib/supabase/service'
import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// IP hashing (RGPD compliant — no plain IP stored)
// ---------------------------------------------------------------------------

/**
 * Known dev/test default values that MUST NOT be used in production.
 * Keep in sync with the Zod default in `src/lib/env.ts`.
 */
const DEV_PEPPER_DEFAULTS: ReadonlySet<string> = new Set([
  'jobnomad-dev-pepper',
  'jobnomad-dev-pepper-change-me',
])

/**
 * Hash an IP address with a pepper for storage.
 * Uses SHA-256 which is fast enough for rate-limiting lookups
 * and provides sufficient collision resistance.
 *
 * SECURITY: in production, requires `RATE_LIMIT_PEPPER` to be set to a
 * non-default value. Throws otherwise — without a real pepper, an attacker
 * can pre-compute IP-hash rainbow tables.
 */
export function hashIp(ip: string, pepper?: string): string {
  const explicit = pepper ?? process.env.RATE_LIMIT_PEPPER
  const effectivePepper = explicit ?? 'jobnomad-dev-pepper'

  if (process.env.NODE_ENV === 'production') {
    if (!explicit || DEV_PEPPER_DEFAULTS.has(explicit)) {
      throw new Error(
        'RATE_LIMIT_PEPPER must be set to a non-default value in production. ' +
          'Generate one with: `openssl rand -hex 32` and add it to Vercel env.',
      )
    }
  }

  return crypto
    .createHash('sha256')
    .update(`${effectivePepper}:${ip}`)
    .digest('hex')
}

// ---------------------------------------------------------------------------
// Extract client IP from request headers
// ---------------------------------------------------------------------------

/**
 * Extract client IP from request headers.
 *
 * Priority:
 * 1. x-forwarded-for (first entry — set by Vercel/CDN)
 * 2. x-real-ip
 * 3. Fallback to 'unknown'
 *
 * Note: On Vercel, x-forwarded-for is trustworthy (set by their edge).
 * In local dev, it may be missing — we fall back gracefully.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can be "client, proxy1, proxy2" — take first
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

// ---------------------------------------------------------------------------
// Rate-limit check
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean
  /** Human-readable message for logging (never expose to user) */
  reason: string
}

/**
 * Check if a request is within rate limits.
 *
 * @param ip - Raw IP address (will be hashed before DB lookup)
 * @param maxAttempts - Max attempts per window (default: 5)
 * @param windowMinutes - Window duration in minutes (default: 60)
 *
 * @returns { allowed: boolean, reason: string }
 */
export async function checkRateLimit(
  ip: string,
  maxAttempts = 5,
  windowMinutes = 60,
): Promise<RateLimitResult> {
  try {
    const ipHash = hashIp(ip)
    const supabase = createServiceClient()

    // Cast needed: the RPC is defined in migration 17 but database.types.ts
    // won't include it until `supabase gen types` runs after migration push.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('check_auth_rate_limit', {
      p_ip_hash: ipHash,
      p_max_attempts: maxAttempts,
      p_window_minutes: windowMinutes,
    }) as { data: boolean | null; error: { message: string } | null }

    if (error) {
      // On RPC error, fail OPEN (allow the request) to avoid locking users out.
      // Log the error for monitoring but don't block legitimate users.
      console.error('[rate-limit] RPC error:', error.message)
      return { allowed: true, reason: 'rpc_error_fail_open' }
    }

    return {
      allowed: data === true,
      reason: data === true ? 'within_limit' : 'rate_limited',
    }
  } catch (err) {
    // Unexpected error — fail open
    console.error('[rate-limit] Unexpected error:', err instanceof Error ? err.message : err)
    return { allowed: true, reason: 'unexpected_error_fail_open' }
  }
}
