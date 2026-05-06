/**
 * lib/feed/queries.ts — Feed query builder (Phase 1, no RPC).
 *
 * Phase 1: simple SELECT * FROM jobs WHERE status = 'active' ORDER BY posted_at DESC
 * with permissive NULL-tolerant filters and keyset pagination.
 *
 * Columns tagged as AI-computed (red_flags, confidence_scores, seniority,
 * contract_type, geo_policy, salary_min) can be NULL — every filter is
 * written as `(col = :val OR col IS NULL)` so a NULL column passes all
 * filters rather than being excluded.
 *
 * Architecture note: this is a pure domain function. It receives a Supabase
 * client (already created with correct auth cookies by the Server Component)
 * so it stays testable without mocking Next.js headers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/lib/supabase/database.types'
import type { FeedFilters } from './schemas'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FEED_PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned for each row — subset of jobs columns safe for the feed. */
export type FeedJob = {
  id: string
  title: string
  company: string
  logo_url: string | null
  source_url: string
  source: string
  skills_required: string[]
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_period: string | null
  contract_type: string | null
  geo_policy: string | null
  seniority: string | null
  red_flags: unknown // Json — validated permissively downstream
  posted_at: string | null
  ingested_at: string
}

export type FeedResult = {
  jobs: FeedJob[]
  /** Total count for pagination (estimated — Supabase count: 'exact'). */
  total: number
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

/**
 * Fetch a page of active jobs with optional permissive filters.
 *
 * All AI-derived columns (contract_type, seniority, geo_policy, salary_min)
 * default to "pass" when NULL — `(col = filter OR col IS NULL)`.
 *
 * Supabase's PostgREST does not support OR directly on a column in the
 * query builder, so we use the `.or()` method.
 *
 * @param supabase - Authenticated Supabase client (server-side)
 * @param filters  - Validated FeedFilters (from Zod schema)
 * @param page     - 1-indexed page number
 */
export async function fetchFeedJobs(
  supabase: SupabaseClient<Database>,
  filters: FeedFilters,
  page: number,
): Promise<FeedResult> {
  const offset = (Math.max(1, page) - 1) * FEED_PAGE_SIZE

  let query = supabase
    .from('jobs')
    .select(
      [
        'id',
        'title',
        'company',
        'logo_url',
        'source_url',
        'source',
        'skills_required',
        'salary_min',
        'salary_max',
        'salary_currency',
        'salary_period',
        'contract_type',
        'geo_policy',
        'seniority',
        'red_flags',
        'posted_at',
        'ingested_at',
      ].join(', '),
      { count: 'exact' },
    )
    .eq('status', 'active')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false }) // tie-break
    .range(offset, offset + FEED_PAGE_SIZE - 1)

  // -- Permissive filters: NULL columns pass all filters --------------------

  if (filters.contract) {
    // (contract_type = 'X' OR contract_type IS NULL)
    query = query.or(`contract_type.eq.${filters.contract},contract_type.is.null`)
  }

  if (filters.seniority) {
    query = query.or(`seniority.eq.${filters.seniority},seniority.is.null`)
  }

  if (filters.geo_policy) {
    query = query.or(`geo_policy.eq.${filters.geo_policy},geo_policy.is.null`)
  }

  if (filters.salary_min != null) {
    // salary_min >= threshold OR salary_min IS NULL (unknown salary passes)
    query = query.or(
      `salary_min.gte.${filters.salary_min},salary_min.is.null`,
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`[feed] DB error: ${error.message}`)
  }

  return {
    jobs: (data ?? []) as unknown as FeedJob[],
    total: count ?? 0,
  }
}
