/**
 * Tests for WWR adapter.
 *
 * Mocks fetch globally — no network calls.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { wwrAdapter } from '../../adapters/wwr'
import type { FetchContext } from '../../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const wwrRss = readFileSync(
  join(__dirname, '..', '..', '__fixtures__', 'wwr.rss'),
  'utf-8'
)

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

afterEach(() => vi.restoreAllMocks())

describe('wwrAdapter', () => {
  it('has correct source name', () => {
    expect(wwrAdapter.source).toBe('wwr')
  })

  it('is enabled by default', () => {
    delete process.env.INGEST_DISABLED_SOURCES
    expect(wwrAdapter.enabled).toBe(true)
  })

  it('is disabled via INGEST_DISABLED_SOURCES', () => {
    process.env.INGEST_DISABLED_SOURCES = 'wwr'
    expect(wwrAdapter.enabled).toBe(false)
    delete process.env.INGEST_DISABLED_SOURCES
  })

  it('fetches all 3 feeds and returns parsed jobs', async () => {
    // All 3 feeds return the same fixture (2 valid jobs each → 6, but same URLs = dedup → 2)
    // Fresh Response per call — body can only be consumed once in happy-dom
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(wwrRss, { status: 200 }))
    ))

    const result = await wwrAdapter.fetch(makeCtx())
    // 2 valid jobs deduplicated (same URLs from same fixture)
    expect(result.jobs.length).toBeGreaterThanOrEqual(1)
    expect(result.notModified).toBe(false)
  })

  it('cleans "Company: Title" format from WWR titles', async () => {
    const wwrTitleRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[AlphaTech: Senior Backend Engineer]]></title>
      <link>https://weworkremotely.com/remote-jobs/alphatech-backend</link>
      <description><![CDATA[Great backend role at AlphaTech]]></description>
      <company><![CDATA[AlphaTech]]></company>
    </item>
  </channel>
</rss>`
    // Create a fresh Response for each call (body can only be consumed once)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(wwrTitleRss, { status: 200 }))
    ))

    const result = await wwrAdapter.fetch(makeCtx())
    expect(result.jobs.length).toBeGreaterThanOrEqual(1)
    // Title should have "AlphaTech: " prefix removed
    expect(result.jobs[0].title).toBe('Senior Backend Engineer')
  })

  it('returns notModified=true if first feed returns 304', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 304 }))
    )

    const result = await wwrAdapter.fetch(makeCtx({ ifNoneMatch: '"old-etag"' }))
    expect(result.notModified).toBe(true)
    expect(result.jobs).toHaveLength(0)
  })

  it('deduplicates jobs with same source_url across feeds', async () => {
    // All 3 feeds return exactly the same item — should result in 1 job (by URL)
    const singleItemRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Unique Job</title>
      <link>https://weworkremotely.com/remote-jobs/unique-123</link>
      <description>A truly unique job</description>
      <company>UniqueCo</company>
    </item>
  </channel>
</rss>`
    // Fresh Response per call — body can only be consumed once
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(singleItemRss, { status: 200 }))
    ))

    const result = await wwrAdapter.fetch(makeCtx())
    expect(result.jobs).toHaveLength(1)
  })
})
