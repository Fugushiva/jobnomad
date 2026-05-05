/**
 * Tests for remoteok adapter.
 *
 * All HTTP calls are mocked — no network calls.
 * Fixture: __fixtures__/remoteok.json (anonymized real-world shape)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { remoteOKAdapter } from '../../adapters/remoteok'
import type { FetchContext } from '../../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureJson = readFileSync(
  join(__dirname, '..', '..', '__fixtures__', 'remoteok.json'),
  'utf-8'
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noopLog = () => {}

function makeCtx(overrides: Partial<FetchContext> = {}): FetchContext {
  return {
    signal: new AbortController().signal,
    ifNoneMatch: null,
    ifModifiedSince: null,
    log: noopLog,
    ...overrides,
  }
}

function mockFetch200(body: string, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValueOnce(
    new Response(body, { status: 200, headers })
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('remoteOKAdapter', () => {
  it('has correct source name', () => {
    expect(remoteOKAdapter.source).toBe('remoteok')
  })

  it('is enabled by default (no env var)', () => {
    delete process.env.INGEST_DISABLED_SOURCES
    expect(remoteOKAdapter.enabled).toBe(true)
  })

  it('is disabled when source is in INGEST_DISABLED_SOURCES', () => {
    process.env.INGEST_DISABLED_SOURCES = 'remoteok,wwr'
    expect(remoteOKAdapter.enabled).toBe(false)
    delete process.env.INGEST_DISABLED_SOURCES
  })

  it('fetches and parses 3 valid jobs from fixture (1 no-title skipped)', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson, {
      'ETag': '"fixture-etag"',
      'Last-Modified': 'Wed, 01 May 2026 00:00:00 GMT',
    }))

    const result = await remoteOKAdapter.fetch(makeCtx())

    // Fixture has 4 job entries (after metadata at index 0), 1 has empty title → 3 valid
    expect(result.jobs).toHaveLength(3)
    expect(result.notModified).toBe(false)
  })

  it('parses title correctly', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson))
    const result = await remoteOKAdapter.fetch(makeCtx())
    expect(result.jobs[0].title).toBe('Senior Backend Engineer')
  })

  it('parses company correctly', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson))
    const result = await remoteOKAdapter.fetch(makeCtx())
    expect(result.jobs[0].company).toBe('AlphaTech Inc')
  })

  it('constructs absolute https:// source_url', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson))
    const result = await remoteOKAdapter.fetch(makeCtx())
    expect(result.jobs[0].source_url).toMatch(/^https:\/\/remoteok\.com/)
  })

  it('converts relative logo path to absolute https:// URL', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson))
    const result = await remoteOKAdapter.fetch(makeCtx())
    // job[1] has logo "/assets/jobs/betasoft-logo.png" — should become https://remoteok.com/...
    expect(result.jobs[1].logo_url).toMatch(/^https:\/\/remoteok\.com\/assets/)
  })

  it('converts unix timestamp date to Date object', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson))
    const result = await remoteOKAdapter.fetch(makeCtx())
    expect(result.jobs[0].posted_at).toBeInstanceOf(Date)
    // Unix timestamp 1746057600 = 2025-05-01 (fixture date is 2025, intentional)
    expect(result.jobs[0].posted_at?.getFullYear()).toBeGreaterThanOrEqual(2025)
  })

  it('returns notModified=true on 304', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response('', { status: 304 })
    ))

    const result = await remoteOKAdapter.fetch(makeCtx({
      ifNoneMatch: '"old-etag"',
    }))

    expect(result.notModified).toBe(true)
    expect(result.jobs).toHaveLength(0)
  })

  it('captures etag from response headers', async () => {
    vi.stubGlobal('fetch', mockFetch200(fixtureJson, { ETag: '"new-etag-123"' }))
    const result = await remoteOKAdapter.fetch(makeCtx())
    expect(result.etag).toBe('"new-etag-123"')
  })

  it('throws on non-JSON response', async () => {
    vi.stubGlobal('fetch', mockFetch200('<html>Error page</html>'))
    await expect(remoteOKAdapter.fetch(makeCtx())).rejects.toThrow('non-JSON')
  })

  it('throws on non-array JSON response', async () => {
    vi.stubGlobal('fetch', mockFetch200('{"error":"not an array"}'))
    await expect(remoteOKAdapter.fetch(makeCtx())).rejects.toThrow('not an array')
  })
})
