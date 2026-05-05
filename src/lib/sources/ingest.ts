/**
 * Ingestion orchestrator.
 *
 * Coordinates all enabled source adapters within a deadline budget:
 *   1. Load source_state (ETags, Last-Modified) from DB
 *   2. For each enabled adapter (sequential, not parallel):
 *      a. Check deadline — stop early if exhausted
 *      b. Fetch jobs from adapter
 *      c. Filter already-known hashes (batch SELECT before AI calls)
 *      d. Upsert new jobs with status='pending_extraction'
 *      e. Update source_state (ETag, Last-Modified, failure count)
 *   3. Return IngestResult
 *
 * All Supabase operations use the service_role client (bypasses RLS).
 * This module is pure business logic — the route handler is a thin wrapper.
 *
 * Phase 2 migration: N8N will call /api/cron/ingest HTTP endpoint, which calls
 * this function. The business logic stays unchanged.
 *
 * Security (OWASP):
 *   A01: service_role client is injected, never imported directly here
 *   A03: Supabase JS uses parameterised queries; no SQL concatenation
 *   A09: descriptions never logged; only counts and hashes
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../supabase/database.types'
import type { IngestResult, PerSourceStats, SourceName, Logger } from './types'
import { normalizeJob } from './normalize'
import { ADAPTERS } from './adapters/index'
import { RateLimitError } from './http'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Batch size for DB upsert — Supabase free tier handles this fine */
const UPSERT_BATCH_SIZE = 100

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunIngestionOptions {
  /** Supabase service_role client (injected by route handler) */
  supabase: SupabaseClient<Database>
  /** Milliseconds from now() at which we must stop and return */
  deadlineMs: number
  /** Run ID (UUID) for correlation with cron_runs table */
  runId: string
  /** Structured logger */
  log: Logger
}

// ---------------------------------------------------------------------------
// Source state helpers
// ---------------------------------------------------------------------------

interface SourceState {
  last_etag: string | null
  last_modified: string | null
  consecutive_failures: number
}

async function loadSourceStates(
  supabase: SupabaseClient<Database>,
): Promise<Map<SourceName, SourceState>> {
  const { data, error } = await supabase
    .from('source_state')
    .select('source, last_etag, last_modified, consecutive_failures')

  const states = new Map<SourceName, SourceState>()

  if (error || !data) return states

  for (const row of data) {
    states.set(row.source as SourceName, {
      last_etag: row.last_etag,
      last_modified: row.last_modified,
      consecutive_failures: row.consecutive_failures,
    })
  }

  return states
}

async function updateSourceState(
  supabase: SupabaseClient<Database>,
  source: SourceName,
  patch: {
    last_fetched_at?: string
    last_etag?: string | null
    last_modified?: string | null
    consecutive_failures?: number
    last_error?: string | null
  },
): Promise<void> {
  await supabase
    .from('source_state')
    .upsert({
      source,
      updated_at: new Date().toISOString(),
      ...patch,
    }, { onConflict: 'source' })
}

// ---------------------------------------------------------------------------
// Dedup filter
// ---------------------------------------------------------------------------

/**
 * Given a list of hash strings, return those that are NOT already in `jobs`.
 * Batch SELECT keeps this to one round-trip regardless of batch size.
 */
async function filterKnownHashes(
  supabase: SupabaseClient<Database>,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()

  const { data } = await supabase
    .from('jobs')
    .select('hash_dedup')
    .in('hash_dedup', hashes)

  const known = new Set<string>()
  for (const row of data ?? []) {
    known.add(row.hash_dedup)
  }
  return known
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runIngestion(opts: RunIngestionOptions): Promise<IngestResult> {
  const { supabase, deadlineMs, runId, log } = opts
  const startedAt = Date.now()

  const result: IngestResult = {
    runId,
    jobsFetched: 0,
    jobsNew: 0,
    jobsSkipped: 0,
    jobsFailed: 0,
    durationMs: 0,
    perSource: {},
    deadlineHit: false,
  }

  // Load source states for conditional GET
  const sourceStates = await loadSourceStates(supabase)

  // Deadline-aware AbortController — aborts all pending fetches when deadline hits
  const deadlineController = new AbortController()
  const deadlineTimer = setTimeout(() => {
    deadlineController.abort()
  }, deadlineMs)

  try {
    for (const adapter of ADAPTERS) {
      // Check deadline before each adapter
      const elapsed = Date.now() - startedAt
      if (elapsed >= deadlineMs || deadlineController.signal.aborted) {
        log('warn', 'ingest: deadline hit — stopping before all adapters finished', {
          runId,
          elapsedMs: elapsed,
          source: adapter.source,
        })
        result.deadlineHit = true
        break
      }

      if (!adapter.enabled) {
        log('info', 'ingest: adapter disabled — skipping', { source: adapter.source })
        continue
      }

      const sourceState = sourceStates.get(adapter.source) ?? {
        last_etag: null,
        last_modified: null,
        consecutive_failures: 0,
      }

      const stats: PerSourceStats = {
        fetched: 0,
        new: 0,
        skipped: 0,
        failed: 0,
        notModified: false,
        durationMs: 0,
      }

      log('info', 'ingest: starting adapter', { source: adapter.source, runId })

      try {
        const fetchResult = await adapter.fetch({
          signal: deadlineController.signal,
          ifNoneMatch: sourceState.last_etag,
          ifModifiedSince: sourceState.last_modified,
          log,
        })

        stats.durationMs = fetchResult.durationMs
        stats.notModified = fetchResult.notModified

        if (fetchResult.notModified) {
          log('info', 'ingest: source unchanged (304)', { source: adapter.source })
          // Update timestamp even on 304 (we checked the source successfully)
          await updateSourceState(supabase, adapter.source, {
            last_fetched_at: new Date().toISOString(),
            last_etag: fetchResult.etag ?? sourceState.last_etag,
            last_modified: fetchResult.lastModified ?? sourceState.last_modified,
            consecutive_failures: 0,
            last_error: null,
          })
        } else {
          stats.fetched = fetchResult.jobs.length
          result.jobsFetched += stats.fetched

          // Normalize jobs and compute dedup hashes
          const normalized = await Promise.all(
            fetchResult.jobs.map(job => normalizeJob(job, adapter.source))
          )

          // Filter out known hashes (already in DB from any source)
          const allHashes = normalized.map(j => j.hash_dedup)
          const knownHashes = await filterKnownHashes(supabase, allHashes)

          const newJobs = normalized.filter(j => !knownHashes.has(j.hash_dedup))
          stats.skipped = normalized.length - newJobs.length
          result.jobsSkipped += stats.skipped

          // Upsert in batches
          let insertFailed = 0
          for (let i = 0; i < newJobs.length; i += UPSERT_BATCH_SIZE) {
            const batch = newJobs.slice(i, i + UPSERT_BATCH_SIZE)
            const { error } = await supabase.from('jobs').upsert(
              batch.map(job => ({
                source: job.source,
                source_id: job.source_id,
                source_url: job.source_url,
                title: job.title,
                company: job.company,
                description: job.description,
                logo_url: job.logo_url,
                posted_at: job.posted_at?.toISOString() ?? null,
                hash_dedup: job.hash_dedup,
                status: 'pending_extraction' as const,
                // All AI fields are null — populated by the extraction cron (T4)
                geo_policy: null,
                allowed_regions: null,
                allowed_countries: null,
                excluded_countries: null,
                tz_requirement_type: null,
                tz_reference: null,
                tz_min_overlap_hours: null,
                contract_type: null,
                visa_sponsorship: null,
                salary_min: null,
                salary_max: null,
                salary_currency: null,
                salary_period: null,
                skills_required: [],
                skills_nice_to_have: [],
                seniority: null,
                red_flags: [],
                confidence_scores: null,
                embedding: null,
              })),
              { onConflict: 'hash_dedup', ignoreDuplicates: true }
            )

            if (error) {
              log('error', 'ingest: batch upsert failed', {
                source: adapter.source,
                batchIndex: i / UPSERT_BATCH_SIZE,
                error: error.message,
              })
              insertFailed += batch.length
            }
          }

          stats.new = newJobs.length - insertFailed
          stats.failed = insertFailed
          result.jobsNew += stats.new
          result.jobsFailed += stats.failed

          // Update source state
          await updateSourceState(supabase, adapter.source, {
            last_fetched_at: new Date().toISOString(),
            last_etag: fetchResult.etag,
            last_modified: fetchResult.lastModified,
            consecutive_failures: 0,
            last_error: null,
          })

          log('info', 'ingest: adapter complete', {
            source: adapter.source,
            fetched: stats.fetched,
            new: stats.new,
            skipped: stats.skipped,
            failed: stats.failed,
            durationMs: stats.durationMs,
          })
        }

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isRateLimit = err instanceof RateLimitError

        stats.error = message
        result.jobsFailed += stats.failed

        log(isRateLimit ? 'warn' : 'error', 'ingest: adapter failed', {
          source: adapter.source,
          error: message,
          isRateLimit,
        })

        // Update failure count in source_state
        await updateSourceState(supabase, adapter.source, {
          consecutive_failures: sourceState.consecutive_failures + 1,
          last_error: message.slice(0, 500), // cap length
        })
      }

      result.perSource[adapter.source] = stats
    }
  } finally {
    clearTimeout(deadlineTimer)
  }

  result.durationMs = Date.now() - startedAt
  return result
}
