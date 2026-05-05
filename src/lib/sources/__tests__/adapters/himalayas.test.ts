/**
 * Tests for Himalayas adapter.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { himalayasAdapter } from '../../adapters/himalayas'
import type { FetchContext } from '../../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const himalayasRss = readFileSync(
  join(__dirname, '..', '..', '__fixtures__', 'himalayas.rss'),
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

describe('himalayasAdapter', () => {
  it('has correct source name', () => {
    expect(himalayasAdapter.source).toBe('himalayas')
  })

  it('is enabled by default', () => {
    delete process.env.INGEST_DISABLED_SOURCES
    expect(himalayasAdapter.enabled).toBe(true)
  })

  it('is disabled via INGEST_DISABLED_SOURCES', () => {
    process.env.INGEST_DISABLED_SOURCES = 'himalayas'
    expect(himalayasAdapter.enabled).toBe(false)
    delete process.env.INGEST_DISABLED_SOURCES
  })

  it('fetches and parses 3 valid jobs from fixture', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(himalayasRss, { status: 200, headers: { ETag: '"h-etag-1"' } })
    ))

    const result = await himalayasAdapter.fetch(makeCtx())
    expect(result.jobs).toHaveLength(3)
    expect(result.notModified).toBe(false)
  })

  it('extracts correct title and company from real Himalayas RSS format', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(himalayasRss, { status: 200 })
    ))

    const result = await himalayasAdapter.fetch(makeCtx())
    expect(result.jobs[0].title).toBe('Senior Full-Stack Engineer')
    expect(result.jobs[0].company).toBe('GammaCloud')
  })

  it('captures etag from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(himalayasRss, { status: 200, headers: { ETag: '"himalayas-v42"' } })
    ))

    const result = await himalayasAdapter.fetch(makeCtx())
    expect(result.etag).toBe('"himalayas-v42"')
  })

  it('returns notModified=true on 304', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response('', { status: 304 })
    ))

    const result = await himalayasAdapter.fetch(makeCtx({ ifNoneMatch: '"old"' }))
    expect(result.notModified).toBe(true)
    expect(result.jobs).toHaveLength(0)
  })

  it('sends If-None-Match when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(himalayasRss, { status: 200 })
    )
    vi.stubGlobal('fetch', mockFetch)

    await himalayasAdapter.fetch(makeCtx({ ifNoneMatch: '"cached"' }))

    const [, options] = mockFetch.mock.calls[0]
    expect((options.headers as Record<string, string>)['If-None-Match']).toBe('"cached"')
  })
})
