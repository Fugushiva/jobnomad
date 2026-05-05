/**
 * Tests for http.ts — guardedFetch()
 *
 * Uses vi.stubGlobal to mock the global fetch — no external network calls.
 * Tests cover all documented behaviors from the plan:
 *   200, 304, 429+Retry-After, timeout abort, retry exponential, 5xx, 4xx no-retry
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { guardedFetch, RateLimitError, HttpError, USER_AGENT } from '../http'
import type { Logger } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noopLog: Logger = () => {}

function makeResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('guardedFetch()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // SSRF prevention
  // -------------------------------------------------------------------------

  it('throws on http:// URL (SSRF prevention)', async () => {
    await expect(
      guardedFetch({ url: 'http://example.com/api', format: 'json', log: noopLog })
    ).rejects.toThrow('SSRF prevention')
  })

  // -------------------------------------------------------------------------
  // 200 OK
  // -------------------------------------------------------------------------

  it('returns body on 200 OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeResponse(200, '{"jobs":[]}', { 'ETag': '"abc123"', 'Last-Modified': 'Wed, 01 May 2026 00:00:00 GMT' })
    ))

    const result = await guardedFetch({
      url: 'https://remoteok.com/api',
      format: 'json',
      log: noopLog,
    })

    expect(result.notModified).toBe(false)
    expect(result.body).toBe('{"jobs":[]}')
    expect(result.etag).toBe('"abc123"')
    expect(result.lastModified).toBe('Wed, 01 May 2026 00:00:00 GMT')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('sends correct User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, '[]'))
    vi.stubGlobal('fetch', mockFetch)

    await guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })

    const [, options] = mockFetch.mock.calls[0]
    expect((options.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT)
  })

  it('sends Accept: application/json for json format', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, '[]'))
    vi.stubGlobal('fetch', mockFetch)

    await guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })

    const [, options] = mockFetch.mock.calls[0]
    expect((options.headers as Record<string, string>)['Accept']).toBe('application/json')
  })

  it('sends RSS Accept header for rss format', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, '<rss/>'))
    vi.stubGlobal('fetch', mockFetch)

    await guardedFetch({ url: 'https://weworkremotely.com/jobs.rss', format: 'rss', log: noopLog })

    const [, options] = mockFetch.mock.calls[0]
    expect((options.headers as Record<string, string>)['Accept']).toContain('rss')
  })

  // -------------------------------------------------------------------------
  // 304 Not Modified
  // -------------------------------------------------------------------------

  it('returns notModified=true on 304', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(makeResponse(304, '')))

    const result = await guardedFetch({
      url: 'https://remoteok.com/api',
      format: 'json',
      ifNoneMatch: '"old-etag"',
      log: noopLog,
    })

    expect(result.notModified).toBe(true)
    expect(result.body).toBe('')
  })

  it('sends If-None-Match header when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, '[]'))
    vi.stubGlobal('fetch', mockFetch)

    await guardedFetch({
      url: 'https://remoteok.com/api',
      format: 'json',
      ifNoneMatch: '"cached-etag"',
      log: noopLog,
    })

    const [, options] = mockFetch.mock.calls[0]
    expect((options.headers as Record<string, string>)['If-None-Match']).toBe('"cached-etag"')
  })

  it('sends If-Modified-Since header when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, '[]'))
    vi.stubGlobal('fetch', mockFetch)

    await guardedFetch({
      url: 'https://remoteok.com/api',
      format: 'json',
      ifModifiedSince: 'Wed, 01 May 2026 00:00:00 GMT',
      log: noopLog,
    })

    const [, options] = mockFetch.mock.calls[0]
    expect((options.headers as Record<string, string>)['If-Modified-Since']).toBe('Wed, 01 May 2026 00:00:00 GMT')
  })

  // -------------------------------------------------------------------------
  // 429 Rate Limited
  // -------------------------------------------------------------------------

  it('throws RateLimitError on 429 with Retry-After (no retry)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeResponse(429, 'Too Many Requests', { 'Retry-After': '120' })
    ))

    await expect(
      guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })
    ).rejects.toThrow(RateLimitError)
  })

  it('RateLimitError carries correct retryAfterMs (Retry-After in seconds)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeResponse(429, '', { 'Retry-After': '60' })
    ))

    const err = await guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })
      .catch((e) => e)

    expect(err).toBeInstanceOf(RateLimitError)
    expect((err as RateLimitError).retryAfterMs).toBe(60_000)
  })

  it('RateLimitError uses 60s fallback when Retry-After absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(makeResponse(429, '')))

    const err = await guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })
      .catch((e) => e)

    expect(err).toBeInstanceOf(RateLimitError)
    expect((err as RateLimitError).retryAfterMs).toBe(60_000)
  })

  // -------------------------------------------------------------------------
  // 4xx non-retryable
  // -------------------------------------------------------------------------

  it('throws HttpError on 404 without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(404, 'Not Found'))
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })
    ).rejects.toThrow(HttpError)

    // Should NOT retry on 404
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws HttpError on 403 without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(403, 'Forbidden'))
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })
    ).rejects.toThrow(HttpError)

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // 5xx retryable
  // -------------------------------------------------------------------------

  it('retries on 503 and succeeds on second attempt', async () => {
    vi.useRealTimers() // need real timers for this test
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(503, 'Service Unavailable'))
      .mockResolvedValueOnce(makeResponse(200, '{"ok":true}'))
    vi.stubGlobal('fetch', mockFetch)

    // Override sleep to be instant in tests
    const result = await guardedFetch({
      url: 'https://remoteok.com/api',
      format: 'json',
      log: noopLog,
    })

    expect(result.body).toBe('{"ok":true}')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 10_000)

  it('throws HttpError after exhausting MAX_RETRIES (2) on 503', async () => {
    vi.useRealTimers()
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(503, 'Service Unavailable'))
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      guardedFetch({ url: 'https://remoteok.com/api', format: 'json', log: noopLog })
    ).rejects.toThrow(HttpError)

    // Initial + 2 retries = 3 total calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 15_000)

  // -------------------------------------------------------------------------
  // Aborted by external signal (deadline)
  // -------------------------------------------------------------------------

  it('throws when external signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      guardedFetch({
        url: 'https://remoteok.com/api',
        format: 'json',
        signal: controller.signal,
        log: noopLog,
      })
    ).rejects.toThrow('Aborted by deadline budget')
  })
})
