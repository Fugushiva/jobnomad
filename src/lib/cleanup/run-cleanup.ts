/**
 * Cleanup orchestrator.
 *
 * Thin adapter between the cron route handler and the `cleanup_expired_data()`
 * Postgres function defined in migration 20260503000012_functions_cleanup.sql.
 *
 * Responsibilities:
 *   1. Call `SELECT cleanup_expired_data()` via the service_role RPC client.
 *   2. Validate the returned JSONB against a Zod schema (defence-in-depth —
 *      even though we own the SQL function, schema drift or future changes
 *      should be caught early and loudly rather than silently producing
 *      wrong monitoring data).
 *   3. Compute the total `rowsDeleted` scalar for the `cron_runs` table.
 *   4. Return a typed `RunCleanupResult` for the route handler to log.
 *
 * Architecture:
 *   - No business logic here. The retention policy lives entirely in SQL.
 *   - This module is pure and easily unit-testable (inject Supabase client).
 *   - Phase 2: if we migrate to N8N, the route handler calls this same
 *     function; N8N just hits the HTTP endpoint instead.
 *
 * Security (OWASP):
 *   A03: Supabase JS uses parameterised queries. No SQL string building here.
 *   A08: Zod validates the RPC response before we trust any of its fields.
 *   A09: Logger receives only counters and run IDs — no user data, no secrets.
 */

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/database.types'
import type { CronLogger } from '../cron/auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-table deletion counts returned by `cleanup_expired_data()`.
 * Field names mirror the SQL function's JSONB keys exactly.
 */
export interface CleanupPerTable {
  jobs_expired: number       // active → expired (UPDATE, not DELETE)
  jobs_deleted: number       // hard DELETE of expired jobs > 30d
  views_deleted: number      // job_views > 60d
  digests_deleted: number    // email_digests > 30d
  ai_log_deleted: number     // ai_usage_log > 180d
  feedback_deleted: number   // feedback_extraction > 180d
  cron_runs_deleted: number  // cron_runs > 90d
}

export interface RunCleanupResult {
  runId: string
  /** Sum of all deletion/expiry counts — written to cron_runs.rows_deleted */
  rowsDeleted: number
  /** Per-table breakdown — written to cron_runs.metadata */
  perTable: CleanupPerTable
  durationMs: number
  /** ISO-8601 timestamp from the DB function itself */
  ranAt: string
}

// ---------------------------------------------------------------------------
// Zod schema — validates the JSONB returned by cleanup_expired_data()
// ---------------------------------------------------------------------------

const CleanupResultSchema = z.object({
  jobs_expired:      z.number().int().min(0),
  jobs_deleted:      z.number().int().min(0),
  views_deleted:     z.number().int().min(0),
  digests_deleted:   z.number().int().min(0),
  ai_log_deleted:    z.number().int().min(0),
  feedback_deleted:  z.number().int().min(0),
  cron_runs_deleted: z.number().int().min(0),
  ran_at:            z.string().min(1),
})

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunCleanupOptions {
  /** Supabase service_role client (injected by route handler) */
  supabase: SupabaseClient<Database>
  /** Run ID (UUID) for correlation with cron_runs table */
  runId: string
  /** Structured logger */
  log: CronLogger
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function runCleanup(opts: RunCleanupOptions): Promise<RunCleanupResult> {
  const { supabase, runId, log } = opts
  const startedAt = Date.now()

  log('info', 'cleanup: calling cleanup_expired_data()', { runId })

  // Call the Postgres function via RPC.
  // The function is SECURITY DEFINER + REVOKE'd from anon/authenticated
  // so it will only execute when called with the service_role client.
  const { data, error } = await supabase.rpc('cleanup_expired_data')

  if (error) {
    log('error', 'cleanup: RPC cleanup_expired_data failed', {
      runId,
      errorCode: error.code,
      errorMessage: error.message,
    })
    throw new Error(`cleanup_expired_data RPC failed: ${error.message}`)
  }

  if (data === null || data === undefined) {
    throw new Error('cleanup_expired_data returned null — expected JSONB')
  }

  // Validate the returned JSONB (A08 — defence in depth)
  const parseResult = CleanupResultSchema.safeParse(data)
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const errorMsg = `cleanup_expired_data returned unexpected schema: ${issue?.path.join('.') ?? '?'} — ${issue?.message ?? 'unknown'}`
    log('error', 'cleanup: response validation failed', { runId, error: errorMsg })
    throw new Error(errorMsg)
  }

  const result = parseResult.data

  const perTable: CleanupPerTable = {
    jobs_expired:      result.jobs_expired,
    jobs_deleted:      result.jobs_deleted,
    views_deleted:     result.views_deleted,
    digests_deleted:   result.digests_deleted,
    ai_log_deleted:    result.ai_log_deleted,
    feedback_deleted:  result.feedback_deleted,
    cron_runs_deleted: result.cron_runs_deleted,
  }

  // Total rows affected (expired + all hard deletes)
  const rowsDeleted =
    perTable.jobs_expired +
    perTable.jobs_deleted +
    perTable.views_deleted +
    perTable.digests_deleted +
    perTable.ai_log_deleted +
    perTable.feedback_deleted +
    perTable.cron_runs_deleted

  const durationMs = Date.now() - startedAt

  log('info', 'cleanup: completed', {
    runId,
    rowsDeleted,
    ...perTable,
    durationMs,
  })

  return {
    runId,
    rowsDeleted,
    perTable,
    durationMs,
    ranAt: result.ran_at,
  }
}
