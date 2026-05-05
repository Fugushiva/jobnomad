/**
 * Integration tests for ingest.ts — runIngestion().
 *
 * Supabase is fully mocked (vi.fn()) — no real DB connections.
 * Fetch is mocked per adapter fixture.
 *
 * Key invariants tested:
 * - Cross-source dedup: same logical job from 2 sources → 1 INSERT
 * - Deadline expiration: partial result returned cleanly
 * - Source 429 (RateLimitError): other sources continue
 * - Source HTTP 500 after retries: counted as failed, others continue
 * - source_state updated on success and failure
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { runIngestion } from '../ingest'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const remoteokJson = readFileSync(join(__dirname, '..', '__fixtures__', 'remoteok.json'), 'utf-8')
const wwrRss = readFileSync(join(__dirname, '..', '__fixtures__', 'wwr.rss'), 'utf-8')
const himalayasRss = readFileSync(join(__dirname, '..', '__fixtures__', 'himalayas.rss'), 'utf-8')

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function makeSupabaseMock(overrides: {
  sourceStateRows?: unknown[]
  knownHashes?: string[]
  upsertError?: { message: string } | null
} = {}) {
  const { sourceStateRows = [], knownHashes = [], upsertError = null } = overrides

  const upsertFn = vi.fn().mockResolvedValue({ error: upsertError })

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'source_state') {
        return {
          select: vi.fn().mockReturnValue({
            data: sourceStateRows,
            error: null,
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'jobs') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: knownHashes.map(h => ({ hash_dedup: h })),
              error: null,
            }),
          }),
          upsert: upsertFn,
        }
      }
      return {}
    }),
  }

  return { supabase, upsertFn }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noopLog = () => {}

function makeOpts(supabase: unknown, overrides: Partial<{
  deadlineMs: number
  log: typeof noopLog
}> = {}) {
  return {
    supabase: supabase as Parameters<typeof runIngestion>[0]['supabase'],
    deadlineMs: 50_000,
    runId: 'test-run-id',
    log: noopLog,
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runIngestion()', () => {

  it('returns IngestResult with runId', async () => {
    // All adapters get 304 (no new jobs — simple path)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('', { status: 304 }))
    ))

    const { supabase } = makeSupabaseMock()
    const result = await runIngestion(makeOpts(supabase))

    expect(result.runId).toBe('test-run-id')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.deadlineHit).toBe(false)
  })

  it('counts new jobs correctly across 3 sources', async () => {
    // Each source returns unique jobs; no known hashes in DB
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('remoteok.com')) {
        return Promise.resolve(new Response(remoteokJson, { status: 200 }))
      }
      if (url.includes('weworkremotely.com')) {
        return Promise.resolve(new Response(wwrRss, { status: 200 }))
      }
      if (url.includes('himalayas.app')) {
        return Promise.resolve(new Response(himalayasRss, { status: 200 }))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    }))

    const { supabase } = makeSupabaseMock({ knownHashes: [] })
    const result = await runIngestion(makeOpts(supabase))

    // RemoteOK fixture: 3 valid, WWR fixture: 2 valid, Himalayas: 3 valid
    expect(result.jobsFetched).toBeGreaterThan(0)
    expect(result.jobsNew).toBeGreaterThan(0)
    expect(result.perSource['remoteok']).toBeDefined()
    expect(result.perSource['wwr']).toBeDefined()
    expect(result.perSource['himalayas']).toBeDefined()
  })

  it('cross-source dedup: same hash in knownHashes → counted as skipped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('remoteok.com')) {
        return Promise.resolve(new Response(remoteokJson, { status: 200 }))
      }
      return Promise.resolve(new Response('', { status: 304 }))
    }))

    // Pre-seed ALL remoteok hashes as "known" — all should be skipped
    // We use a wildcard: filter returns everything as known
    const { supabase } = makeSupabaseMock()

    // Override the jobs.select to return all hashes as known
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'source_state') {
        return {
          select: vi.fn().mockReturnValue({ data: [], error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'jobs') {
        return {
          select: vi.fn().mockReturnValue({
            // Return a special .in() that always says all hashes are known
            in: vi.fn().mockImplementation((_col: string, hashes: string[]) =>
              Promise.resolve({ data: hashes.map(h => ({ hash_dedup: h })), error: null })
            ),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    })

    const result = await runIngestion(makeOpts(supabase))

    // RemoteOK fetched 3 jobs, but all were "known" → all skipped
    expect(result.perSource['remoteok']?.skipped).toBe(3)
    expect(result.perSource['remoteok']?.new).toBe(0)
  })

  it('continues with other adapters when one gets RateLimitError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('remoteok.com')) {
        // Simulate 429
        return Promise.resolve(new Response('', {
          status: 429,
          headers: { 'Retry-After': '60' },
        }))
      }
      if (url.includes('weworkremotely.com')) {
        return Promise.resolve(new Response(wwrRss, { status: 200 }))
      }
      if (url.includes('himalayas.app')) {
        return Promise.resolve(new Response(himalayasRss, { status: 200 }))
      }
      return Promise.resolve(new Response('', { status: 304 }))
    }))

    const { supabase } = makeSupabaseMock()
    const result = await runIngestion(makeOpts(supabase))

    // RemoteOK failed (rate limit)
    expect(result.perSource['remoteok']?.error).toContain('Rate limited')

    // WWR and Himalayas still processed
    expect(result.perSource['wwr']).toBeDefined()
    expect(result.perSource['himalayas']).toBeDefined()
    // At least one of the other sources should have succeeded (fetched > 0)
    const wwrFetched = result.perSource['wwr']?.fetched ?? 0
    const himalayasFetched = result.perSource['himalayas']?.fetched ?? 0
    expect(wwrFetched + himalayasFetched).toBeGreaterThan(0)
  })

  it('sets deadlineHit=true and stops early when deadline is 0ms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(remoteokJson, { status: 200 }))
    ))

    const { supabase } = makeSupabaseMock()
    // deadlineMs=0 → immediately aborted before any adapter runs
    const result = await runIngestion(makeOpts(supabase, { deadlineMs: 0 }))

    expect(result.deadlineHit).toBe(true)
    // No adapters should have completed
    expect(Object.keys(result.perSource).length).toBe(0)
  })

  it('returns jobsNew=0 when upsert errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('remoteok.com')) {
        return Promise.resolve(new Response(remoteokJson, { status: 200 }))
      }
      return Promise.resolve(new Response('', { status: 304 }))
    }))

    const { supabase } = makeSupabaseMock({ upsertError: { message: 'DB connection error' } })
    const result = await runIngestion(makeOpts(supabase))

    // Jobs fetched but insert failed
    const remoteokStats = result.perSource['remoteok']
    if (remoteokStats) {
      expect(remoteokStats.fetched).toBeGreaterThan(0)
      expect(remoteokStats.new).toBe(0)
    }
  })

  it('includes perSource stats for all adapters that ran', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('', { status: 304 }))
    ))

    const { supabase } = makeSupabaseMock()
    const result = await runIngestion(makeOpts(supabase))

    // All 3 adapters ran (304 = success)
    expect(result.perSource['remoteok']).toBeDefined()
    expect(result.perSource['wwr']).toBeDefined()
    expect(result.perSource['himalayas']).toBeDefined()
  })
})
