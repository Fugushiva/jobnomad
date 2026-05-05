/**
 * HTTP fetch guard for the ingestion pipeline.
 *
 * Centralises all anti-ban and resilience logic:
 *   - Identifiable User-Agent (required by RemoteOK ToS)
 *   - Correct Accept headers per format
 *   - 10s timeout per request
 *   - Exponential backoff retry (max 2 attempts, jitter ±20%)
 *   - 429 Retry-After handling: abort this source, let others continue
 *   - Conditional GET: If-None-Match / If-Modified-Since → 304 awareness
 *   - SSRF prevention: HTTPS-only, no redirects to http://
 *   - No 4xx retry (except 408, 429)
 *
 * OWASP A10 (SSRF): URLs are always hardcoded in adapters, never from user input.
 * OWASP A09: responses are never logged beyond status codes.
 */

import type { Logger } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** MUST be identifiable per RemoteOK API ToS. Update contact if email changes. */
export const USER_AGENT = 'JobNomad/1.0 (+https://jobnomad.app/bot; mailto:bot@jobnomad.app)'

/** Timeout per individual HTTP request (ms) */
const REQUEST_TIMEOUT_MS = 10_000

/** Max retry attempts (excluding initial attempt) */
const MAX_RETRIES = 2

/** Base backoff delay for retry (ms) — actual = base * 2^attempt * jitter */
const BASE_BACKOFF_MS = 1_000

/** Jitter factor ±20% */
const JITTER_FACTOR = 0.2

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AcceptFormat = 'json' | 'rss'

export interface GuardedFetchOptions {
  url: string
  format: AcceptFormat
  /** ETag from last successful fetch, for conditional GET */
  ifNoneMatch?: string | null
  /** Last-Modified from last successful fetch, for conditional GET */
  ifModifiedSince?: string | null
  /** External AbortSignal (from deadline budget) */
  signal?: AbortSignal
  log: Logger
}

export interface GuardedFetchResult {
  /** true if server returned 304 — caller should use cached data */
  notModified: boolean
  /** Response body text (empty string if notModified) */
  body: string
  /** ETag from response headers (null if absent) */
  etag: string | null
  /** Last-Modified from response headers (null if absent) */
  lastModified: string | null
  /** Total wall time including all retries (ms) */
  durationMs: number
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class RateLimitError extends Error {
  constructor(
    public readonly url: string,
    public readonly retryAfterMs: number,
  ) {
    super(`Rate limited by ${url}. Retry-After: ${retryAfterMs}ms`)
    this.name = 'RateLimitError'
  }
}

export class TimeoutError extends Error {
  constructor(public readonly url: string) {
    super(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`)
    this.name = 'TimeoutError'
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jitter(ms: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * JITTER_FACTOR
  return Math.round(ms * factor)
}

function backoffMs(attempt: number): number {
  return jitter(BASE_BACKOFF_MS * Math.pow(2, attempt))
}

function parseRetryAfter(header: string | null): number {
  if (!header) return 60_000 // default 60s if header absent
  const seconds = parseInt(header, 10)
  if (!isNaN(seconds)) return seconds * 1000
  // Might be an HTTP-date — use 60s fallback
  return 60_000
}

function acceptHeader(format: AcceptFormat): string {
  if (format === 'json') return 'application/json'
  return 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8'
}

/** Sleep, respecting an external AbortSignal */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('Aborted during backoff'))
    }, { once: true })
  })
}

// ---------------------------------------------------------------------------
// Core fetch guard
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with all anti-ban and resilience measures applied.
 *
 * Throws:
 *   - RateLimitError on 429 (caller should skip this source for the run)
 *   - HttpError on non-retryable 4xx/5xx after exhausting retries
 *   - TimeoutError on request timeout
 *   - DOMException (AbortError) if external signal fires
 *
 * Returns GuardedFetchResult with notModified=true on 304.
 */
export async function guardedFetch(opts: GuardedFetchOptions): Promise<GuardedFetchResult> {
  const { url, format, signal: externalSignal, log } = opts

  // SSRF prevention: HTTPS only
  if (!url.startsWith('https://')) {
    throw new Error(`SSRF prevention: only HTTPS URLs allowed, got: ${url}`)
  }

  const startedAt = Date.now()

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: acceptHeader(format),
    'Accept-Encoding': 'gzip, deflate, br',
  }

  if (opts.ifNoneMatch) {
    headers['If-None-Match'] = opts.ifNoneMatch
  }
  if (opts.ifModifiedSince) {
    headers['If-Modified-Since'] = opts.ifModifiedSince
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check external deadline before each attempt
    if (externalSignal?.aborted) {
      throw new Error('Aborted by deadline budget')
    }

    // Per-request timeout controller
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)

    // Combine signals: abort if either timeout or external fires
    const combinedSignal = externalSignal
      ? AbortSignal.any([timeoutController.signal, externalSignal])
      : timeoutController.signal

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: combinedSignal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      const etag = response.headers.get('ETag')
      const lastModified = response.headers.get('Last-Modified')
      const durationMs = Date.now() - startedAt

      // 304 Not Modified — cached data still valid
      if (response.status === 304) {
        log('info', 'HTTP 304 Not Modified — cache hit', { url })
        return { notModified: true, body: '', etag, lastModified, durationMs }
      }

      // 429 Rate Limited — abort this source for the run
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'))
        log('warn', 'HTTP 429 Rate Limited — skipping source for this run', {
          url,
          retryAfterMs,
          attempt,
        })
        throw new RateLimitError(url, retryAfterMs)
      }

      // 2xx success
      if (response.ok) {
        const body = await response.text()
        if (attempt > 0) {
          log('info', `HTTP ${response.status} OK after ${attempt} retries`, { url })
        }
        return { notModified: false, body, etag, lastModified, durationMs }
      }

      // Retryable server errors: 408, 500, 502, 503, 504
      const retryable = [408, 500, 502, 503, 504].includes(response.status)

      // Non-retryable 4xx (other than 408/429 handled above): throw immediately
      if (!retryable) {
        throw new HttpError(
          response.status,
          url,
          `HTTP ${response.status} from ${url} (non-retryable)`,
        )
      }

      // Retryable server error — throw if last attempt, else backoff+retry below
      if (attempt === MAX_RETRIES) {
        throw new HttpError(
          response.status,
          url,
          `HTTP ${response.status} from ${url} after ${MAX_RETRIES} retries`,
        )
      }

      lastError = new HttpError(response.status, url, `HTTP ${response.status}`)
      log('warn', `HTTP ${response.status} — will retry`, { url, attempt })

    } catch (err) {
      clearTimeout(timeoutId)

      // Non-retryable errors: propagate immediately (no backoff)
      if (err instanceof RateLimitError) throw err
      if (err instanceof HttpError && ![408, 500, 502, 503, 504].includes(err.status)) throw err

      // AbortError: distinguish timeout vs external abort
      if (err instanceof Error && err.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new Error('Aborted by deadline budget')
        }
        throw new TimeoutError(url)
      }

      // Network error or retryable HttpError — retry or give up
      if (attempt === MAX_RETRIES) {
        throw err
      }

      lastError = err instanceof Error ? err : new Error(String(err))
      log('warn', `Network error — will retry`, { url, attempt, error: lastError.message })
    }

    // Backoff before retry
    const delay = backoffMs(attempt)
    log('info', `Backing off before retry`, { url, attempt, delayMs: delay })
    await sleep(delay, externalSignal)
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError ?? new Error(`guardedFetch exhausted retries for ${url}`)
}
