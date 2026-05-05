/**
 * Himalayas adapter — fetches from the official public RSS feed.
 *
 * Endpoint: https://himalayas.app/jobs/rss
 * Format: RSS 2.0
 * ToS: Public RSS, attribution required (Himalayas branding visible in UI — handled by JobCard)
 *
 * Himalayas RSS characteristics:
 * - Plain text descriptions (no CDATA)
 * - ISO 8601 dates
 * - <company> field per item
 * - <guid> is a custom string ID (not a URL)
 * - logo_url not available in RSS (null → Gemini may infer in T4)
 *
 * Single feed — no category splits needed for Himalayas.
 */

import { guardedFetch } from '../http'
import { parseRss } from '../rss'
import { validateRawJobs } from '../schemas'
import type { SourceAdapter, FetchContext, FetchResult } from '../types'

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const himalayasAdapter: SourceAdapter = {
  source: 'himalayas',

  get enabled(): boolean {
    const disabled = process.env.INGEST_DISABLED_SOURCES ?? ''
    return !disabled.split(',').map(s => s.trim()).includes('himalayas')
  },

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const startedAt = Date.now()

    const fetchResult = await guardedFetch({
      url: 'https://himalayas.app/jobs/rss',
      format: 'rss',
      ifNoneMatch: ctx.ifNoneMatch,
      ifModifiedSince: ctx.ifModifiedSince,
      signal: ctx.signal,
      log: ctx.log,
    })

    if (fetchResult.notModified) {
      return {
        jobs: [],
        notModified: true,
        etag: fetchResult.etag,
        lastModified: fetchResult.lastModified,
        durationMs: Date.now() - startedAt,
      }
    }

    const { jobs: rawJobs, failedItems } = parseRss(fetchResult.body)

    if (failedItems > 0) {
      ctx.log('warn', 'himalayas: some RSS items failed parsing', { failedItems })
    }

    const { valid, failedCount, errors } = validateRawJobs(rawJobs)

    if (errors.length > 0) {
      ctx.log('warn', 'himalayas: some jobs failed Zod validation', {
        failedCount,
        sample: errors.slice(0, 3).map(e => e.error),
      })
    }

    ctx.log('info', 'himalayas: fetch complete', {
      raw: rawJobs.length,
      valid: valid.length,
      failed: failedCount,
    })

    return {
      jobs: valid,
      notModified: false,
      etag: fetchResult.etag,
      lastModified: fetchResult.lastModified,
      durationMs: Date.now() - startedAt,
    }
  },
}
