/**
 * Tests for src/lib/feed/queries.ts
 *
 * Uses a hand-rolled Supabase query builder stub — no real DB needed.
 * Tests:
 *  - SELECT columns, ordering, range
 *  - Permissive NULL filters (contract, seniority, geo_policy, salary_min)
 *  - Error propagation
 *  - Page offset math
 */

import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/lib/supabase/database.types'
import { fetchFeedJobs, FEED_PAGE_SIZE } from '../queries'
import type { FeedFilters } from '../schemas'

// ---------------------------------------------------------------------------
// Stub Supabase query builder
// ---------------------------------------------------------------------------

interface QueryState {
  table: string
  columns: string
  filters: Array<{ method: string; args: unknown[] }>
  rangeFrom: number
  rangeTo: number
}

function buildStubClient(
  returnData: unknown[] | null = [],
  returnError: { message: string } | null = null,
  returnCount: number | null = 0,
): { supabase: SupabaseClient<Database>; state: QueryState } {
  const state: QueryState = {
    table: '',
    columns: '',
    filters: [],
    rangeFrom: 0,
    rangeTo: 0,
  }

  const asyncResult = Promise.resolve({
    data: returnData,
    error: returnError,
    count: returnCount,
  })

  // Fluent chain — all methods return `chain` and record themselves
  const chain: Record<string, unknown> = {}
  const chainMethods = ['eq', 'or', 'order', 'range']
  chainMethods.forEach((method) => {
    chain[method] = (...args: unknown[]) => {
      state.filters.push({ method, args })
      if (method === 'range') {
        state.rangeFrom = args[0] as number
        state.rangeTo = args[1] as number
      }
      return chain
    }
  })
  // Make chain thenable so `await query` works
  chain.then = asyncResult.then.bind(asyncResult)
  chain.catch = asyncResult.catch.bind(asyncResult)

  const supabase = {
    from: (table: string) => {
      state.table = table
      return {
        select: (columns: string) => {
          state.columns = columns
          return chain
        },
      }
    },
  } as unknown as SupabaseClient<Database>

  return { supabase, state }
}

// ---------------------------------------------------------------------------
// Default filters (no active filters)
// ---------------------------------------------------------------------------

const defaultFilters: FeedFilters = {
  page: 1,
  contract: undefined,
  seniority: undefined,
  geo_policy: undefined,
  salary_min: undefined,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchFeedJobs', () => {
  it('queries the jobs table', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, defaultFilters, 1)
    expect(state.table).toBe('jobs')
  })

  it('selects the expected columns', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, defaultFilters, 1)
    const cols = state.columns
    expect(cols).toContain('id')
    expect(cols).toContain('title')
    expect(cols).toContain('company')
    expect(cols).toContain('red_flags')
    expect(cols).toContain('posted_at')
    expect(cols).toContain('salary_min')
    expect(cols).toContain('salary_max')
    expect(cols).toContain('contract_type')
  })

  it('filters by status = active', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, defaultFilters, 1)
    const eqFilter = state.filters.find(
      (f) => f.method === 'eq' && (f.args as string[])[0] === 'status',
    )
    expect(eqFilter).not.toBeUndefined()
    expect((eqFilter!.args as string[])[1]).toBe('active')
  })

  it('sets correct range for page 1', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, defaultFilters, 1)
    expect(state.rangeFrom).toBe(0)
    expect(state.rangeTo).toBe(FEED_PAGE_SIZE - 1)
  })

  it('sets correct range for page 2', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, defaultFilters, 2)
    expect(state.rangeFrom).toBe(FEED_PAGE_SIZE)
    expect(state.rangeTo).toBe(FEED_PAGE_SIZE * 2 - 1)
  })

  it('clamps page < 1 to page 1 offset', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, defaultFilters, 0)
    expect(state.rangeFrom).toBe(0)
  })

  it('returns jobs array and total from DB', async () => {
    const mockJobs = [
      { id: 'a', title: 'Engineer', company: 'Acme', skills_required: [], red_flags: [], ingested_at: '2026-01-01' },
    ]
    const { supabase } = buildStubClient(mockJobs, null, 42)
    const result = await fetchFeedJobs(supabase, defaultFilters, 1)
    expect(result.jobs).toHaveLength(1)
    expect(result.total).toBe(42)
  })

  it('returns empty array when data is null', async () => {
    const { supabase } = buildStubClient(null, null, 0)
    const result = await fetchFeedJobs(supabase, defaultFilters, 1)
    expect(result.jobs).toEqual([])
    expect(result.total).toBe(0)
  })

  it('throws on DB error', async () => {
    const { supabase } = buildStubClient(null, { message: 'connection refused' }, null)
    await expect(fetchFeedJobs(supabase, defaultFilters, 1)).rejects.toThrow(
      'connection refused',
    )
  })

  it('adds permissive OR filter for contract when set', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(
      supabase,
      { ...defaultFilters, contract: 'contractor' },
      1,
    )
    const orFilter = state.filters.find(
      (f) =>
        f.method === 'or' &&
        typeof (f.args as string[])[0] === 'string' &&
        ((f.args as string[])[0]).includes('contract_type'),
    )
    expect(orFilter).not.toBeUndefined()
    const orArg = (orFilter!.args as string[])[0]
    expect(orArg).toContain('contractor')
    expect(orArg).toContain('null')
  })

  it('adds permissive OR filter for seniority when set', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(
      supabase,
      { ...defaultFilters, seniority: 'senior' },
      1,
    )
    const orFilter = state.filters.find(
      (f) =>
        f.method === 'or' &&
        ((f.args as string[])[0]).includes('seniority'),
    )
    expect(orFilter).not.toBeUndefined()
  })

  it('adds permissive OR filter for geo_policy when set', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(
      supabase,
      { ...defaultFilters, geo_policy: 'worldwide' },
      1,
    )
    const orFilter = state.filters.find(
      (f) =>
        f.method === 'or' &&
        ((f.args as string[])[0]).includes('geo_policy'),
    )
    expect(orFilter).not.toBeUndefined()
  })

  it('adds permissive OR filter for salary_min when set', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(
      supabase,
      { ...defaultFilters, salary_min: 60000 },
      1,
    )
    const orFilter = state.filters.find(
      (f) =>
        f.method === 'or' &&
        ((f.args as string[])[0]).includes('salary_min'),
    )
    expect(orFilter).not.toBeUndefined()
    expect((orFilter!.args as string[])[0]).toContain('60000')
  })

  it('does NOT add contract filter when contract is undefined', async () => {
    const { supabase, state } = buildStubClient([], null, 0)
    await fetchFeedJobs(supabase, { ...defaultFilters, contract: undefined }, 1)
    const contractOrFilter = state.filters.find(
      (f) =>
        f.method === 'or' &&
        ((f.args as string[])[0]).includes('contract_type'),
    )
    expect(contractOrFilter).toBeUndefined()
  })
})
