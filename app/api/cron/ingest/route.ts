/**
 * /api/cron/ingest — Multi-source job ingestion cron handler.
 *
 * Triggered by Vercel Cron once daily at midnight UTC (declared in vercel.json).
 * Also callable manually with the correct Authorization header.
 *
 * Architecture: thin wrapper — all business logic is in src/lib/sources/ingest.ts.
 * This keeps the function testable and N8N-migration-ready (phase 2 just calls
 * this HTTP endpoint instead of Vercel Cron).
 *
 * Security:
 * - Authorization: Bearer <CRON_SECRET> checked with timing-safe comparison (A07)
 * - service_role key injected here and never passed to client-side code (A01)
 * - No user auth — this is a system endpoint
 *
 * Monitoring:
 * - cron_runs row written at start (status='running') and end (status='completed'|'failed')
 * - UptimeRobot queries cron_runs for health checks (configured in §8.6)
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/src/lib/supabase/service'
import { runIngestion } from '@/src/lib/sources/ingest'
import type { IngestResult } from '@/src/lib/sources/types'

// ---------------------------------------------------------------------------
// Vercel Hobby: max duration = 60s
// ---------------------------------------------------------------------------

export const maxDuration = 60

// ---------------------------------------------------------------------------
// Authorization helper (timing-safe, A07)
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // No secret configured — reject all requests (fail closed)
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const provided = authHeader.slice(7) // remove "Bearer "
  const expected = `${cronSecret}`

  // Constant-time comparison prevents timing attacks
  try {
    const a = Buffer.from(provided.padEnd(expected.length, '\0'))
    const b = Buffer.from(expected.padEnd(provided.length, '\0'))
    // Both must be same length for timingSafeEqual
    const normalised = Math.max(a.length, b.length)
    const aBuf = Buffer.alloc(normalised)
    const bBuf = Buffer.alloc(normalised)
    a.copy(aBuf)
    b.copy(bBuf)
    return timingSafeEqual(aBuf, bBuf) && provided.length === expected.length
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Structured logger (safe — never logs descriptions or secrets)
// ---------------------------------------------------------------------------

function makeLogger(runId: string) {
  return function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -------------------------------------------------------------------------
  // 1. Authorization (A07 — timing-safe)
  // -------------------------------------------------------------------------
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = randomUUID()
  const supabase = createServiceClient()
  const log = makeLogger(runId)
  const startedAt = Date.now()

  log('info', 'ingest cron started', { runId })

  // -------------------------------------------------------------------------
  // 2. Write cron_runs start record
  // -------------------------------------------------------------------------
  const { data: cronRunData } = await supabase.from('cron_runs').insert({
    cron_name: 'ingest',
    started_at: new Date(startedAt).toISOString(),
    status: 'running',
  }).select('id').single()

  const cronRunId = cronRunData?.id ?? null

  // -------------------------------------------------------------------------
  // 3. Run ingestion (with 50s deadline — 10s buffer for DB writes)
  // -------------------------------------------------------------------------
  let ingestResult: IngestResult | null = null
  let runStatus: 'completed' | 'failed' | 'timeout' = 'completed'
  let errorMessage: string | null = null

  try {
    ingestResult = await runIngestion({
      supabase,
      deadlineMs: 50_000,
      runId,
      log,
    })

    if (ingestResult.deadlineHit) {
      runStatus = 'timeout'
      log('warn', 'ingest cron hit deadline', { runId, durationMs: ingestResult.durationMs })
    } else {
      log('info', 'ingest cron completed', {
        runId,
        jobsNew: ingestResult.jobsNew,
        jobsSkipped: ingestResult.jobsSkipped,
        jobsFailed: ingestResult.jobsFailed,
        durationMs: ingestResult.durationMs,
      })
    }
  } catch (err) {
    runStatus = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
    log('error', 'ingest cron threw unexpectedly', { runId, error: errorMessage })
  }

  const durationMs = Date.now() - startedAt

  // -------------------------------------------------------------------------
  // 4. Update cron_runs completion record
  // -------------------------------------------------------------------------
  if (cronRunId) {
    await supabase.from('cron_runs').update({
      completed_at: new Date().toISOString(),
      status: runStatus,
      jobs_fetched: ingestResult?.jobsFetched ?? 0,
      jobs_new: ingestResult?.jobsNew ?? 0,
      jobs_skipped: ingestResult?.jobsSkipped ?? 0,
      jobs_failed: ingestResult?.jobsFailed ?? 0,
      duration_ms: durationMs,
      error_message: errorMessage,
      metadata: ingestResult?.perSource
        ? JSON.parse(JSON.stringify(ingestResult.perSource))
        : null,
    }).eq('id', cronRunId)
  }

  // -------------------------------------------------------------------------
  // 5. Return result
  // -------------------------------------------------------------------------
  if (runStatus === 'failed') {
    return NextResponse.json(
      { error: 'Ingestion failed', runId, details: errorMessage },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    runId,
    status: runStatus,
    ...(ingestResult ?? {}),
  })
}
