/**
 * /api/cron/cleanup — Weekly data retention enforcement cron handler.
 *
 * Triggered by Vercel Cron every Sunday at 03:00 UTC (declared in vercel.json).
 * Also callable manually with the correct Authorization header (ops/debugging).
 *
 * Architecture: thin wrapper — all business logic lives in src/lib/cleanup/run-cleanup.ts.
 * This keeps the function testable in isolation and N8N-migration-ready (phase 2 just
 * calls this HTTP endpoint instead of Vercel Cron).
 *
 * Retention policy enforced by the underlying cleanup_expired_data() Postgres function
 * (migration 20260503000012_functions_cleanup.sql):
 *   - jobs status='active'    → expire after 14 days
 *   - jobs status='expired'   → delete after 30 days  (cascades to saved_jobs, job_views, feedback)
 *   - job_views               → delete after 60 days
 *   - email_digests           → delete after 30 days
 *   - ai_usage_log            → delete after 180 days
 *   - feedback_extraction     → delete after 180 days
 *   - cron_runs               → delete after 90 days
 *
 * Security (OWASP):
 *   A07 — Authorization: Bearer <CRON_SECRET> checked with timing-safe comparison.
 *   A01 — SUPABASE_SERVICE_ROLE_KEY is server-only; never shipped to the client.
 *   A09 — Only counts and run IDs are logged. No user data, no secrets.
 *
 * Monitoring:
 *   - cron_runs row written at start (status='running') and on completion
 *     (status='completed'|'failed'), with rows_deleted and per-table metadata.
 *   - UptimeRobot / health checks can query cron_runs for the latest cleanup run.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/src/lib/supabase/service'
import { isAuthorizedCronRequest, makeCronLogger } from '@/src/lib/cron/auth'
import { runCleanup } from '@/src/lib/cleanup/run-cleanup'
import type { RunCleanupResult } from '@/src/lib/cleanup/run-cleanup'

// ---------------------------------------------------------------------------
// Vercel Hobby: max duration = 60s
// ---------------------------------------------------------------------------

export const maxDuration = 60

// ---------------------------------------------------------------------------
// Force dynamic rendering — this route must never be cached
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -------------------------------------------------------------------------
  // 1. Authorization (A07 — timing-safe, fail closed)
  // -------------------------------------------------------------------------
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = randomUUID()
  const supabase = createServiceClient()
  const log = makeCronLogger(runId)
  const startedAt = Date.now()

  log('info', 'cleanup cron started', { runId })

  // -------------------------------------------------------------------------
  // 2. Write cron_runs start record (status='running')
  //    This ensures we can detect crashed runs (no completed_at and status stays 'running').
  // -------------------------------------------------------------------------
  const { data: cronRunData } = await supabase
    .from('cron_runs')
    .insert({
      cron_name: 'cleanup',
      started_at: new Date(startedAt).toISOString(),
      status: 'running',
    })
    .select('id')
    .single()

  const cronRunId = cronRunData?.id ?? null

  // -------------------------------------------------------------------------
  // 3. Run cleanup
  // -------------------------------------------------------------------------
  let cleanupResult: RunCleanupResult | null = null
  let runStatus: 'completed' | 'failed' = 'completed'
  let errorMessage: string | null = null

  try {
    cleanupResult = await runCleanup({ supabase, runId, log })

    log('info', 'cleanup cron completed', {
      runId,
      rowsDeleted: cleanupResult.rowsDeleted,
      durationMs: cleanupResult.durationMs,
    })
  } catch (err) {
    runStatus = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
    log('error', 'cleanup cron threw unexpectedly', { runId, error: errorMessage })
  }

  const durationMs = Date.now() - startedAt

  // -------------------------------------------------------------------------
  // 4. Update cron_runs completion record
  // -------------------------------------------------------------------------
  if (cronRunId) {
    await supabase
      .from('cron_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: runStatus,
        rows_deleted: cleanupResult?.rowsDeleted ?? 0,
        duration_ms: durationMs,
        error_message: errorMessage,
        // Per-table breakdown stored in metadata for observability
        metadata: cleanupResult?.perTable
          ? JSON.parse(JSON.stringify(cleanupResult.perTable))
          : null,
      })
      .eq('id', cronRunId)
  }

  // -------------------------------------------------------------------------
  // 5. Return result
  // -------------------------------------------------------------------------
  if (runStatus === 'failed') {
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        runId,
        details: errorMessage,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    runId,
    status: runStatus,
    rowsDeleted: cleanupResult?.rowsDeleted ?? 0,
    perTable: cleanupResult?.perTable ?? null,
    ranAt: cleanupResult?.ranAt ?? null,
    durationMs,
  })
}
