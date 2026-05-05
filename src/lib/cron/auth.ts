/**
 * Shared helpers for all Vercel Cron route handlers.
 *
 * Centralises the two pieces of infrastructure every cron handler needs:
 *   1. `isAuthorizedCronRequest` — timing-safe CRON_SECRET verification (A07)
 *   2. `makeCronLogger`          — structured JSON logger (safe, no secrets)
 *
 * Security notes (OWASP):
 *   A07 (Auth Failures)   — timingSafeEqual prevents timing oracle attacks.
 *                           Fail-closed when CRON_SECRET is unset.
 *   A09 (Logging Failures) — logger never emits secrets, descriptions, or user data.
 *                           Only counters, IDs, and status strings are logged.
 *
 * Usage in a cron route handler:
 *
 *   import { isAuthorizedCronRequest, makeCronLogger } from '@/src/lib/cron/auth'
 *
 *   export async function GET(request: NextRequest) {
 *     if (!isAuthorizedCronRequest(request)) {
 *       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *     }
 *     const log = makeCronLogger(runId)
 *     ...
 *   }
 */

import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'warn' | 'error'

export type CronLogger = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) => void

// ---------------------------------------------------------------------------
// Authorization — timing-safe Bearer token check (A07)
// ---------------------------------------------------------------------------

/**
 * Returns true only when the request carries a valid `Authorization: Bearer <CRON_SECRET>` header.
 *
 * - Fails closed: if `CRON_SECRET` env var is not set, all requests are rejected.
 * - Uses `timingSafeEqual` with length-normalised buffers to prevent timing attacks.
 * - An empty secret is treated as "not set" and always returns false.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  // Fail closed — no secret configured means no valid requests
  if (!cronSecret || cronSecret.length === 0) {
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const provided = authHeader.slice(7) // strip "Bearer "
  const expected = cronSecret

  // Constant-time comparison — both buffers padded to the same length
  // so the comparison never leaks the secret length.
  try {
    const normalised = Math.max(provided.length, expected.length)
    const aBuf = Buffer.alloc(normalised)
    const bBuf = Buffer.alloc(normalised)
    Buffer.from(provided).copy(aBuf)
    Buffer.from(expected).copy(bBuf)
    // Additionally check that lengths match AFTER we've done the constant-time
    // comparison — this prevents a padded-but-actually-longer secret from passing.
    return timingSafeEqual(aBuf, bBuf) && provided.length === expected.length
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Structured logger — safe, no secrets (A09)
// ---------------------------------------------------------------------------

/**
 * Creates a structured JSON logger scoped to a single cron run.
 *
 * Every log line is emitted as a single-line JSON object:
 *   { level, message, runId, ...meta, ts }
 *
 * The `ts` field is an ISO-8601 UTC timestamp added automatically.
 * The caller is responsible for ensuring `meta` contains no secrets.
 */
export function makeCronLogger(runId: string): CronLogger {
  return function log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    const entry = JSON.stringify({
      level,
      message,
      runId,
      ...meta,
      ts: new Date().toISOString(),
    })
    if (level === 'error') {
      console.error(entry)
    } else if (level === 'warn') {
      console.warn(entry)
    } else {
      console.log(entry)
    }
  }
}
