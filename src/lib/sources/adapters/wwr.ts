/**
 * WeWorkRemotely (WWR) adapter — fetches from official RSS feeds.
 *
 * WWR has no public JSON API. RSS is the official data access method,
 * explicitly allowed by their ToS (§ 3.5 of JobNomad spec).
 *
 * Feeds fetched (multiple categories → merged):
 *   Programming:  https://weworkremotely.com/categories/remote-programming-jobs.rss
 *   DevOps/SysAdm: https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss
 *   Design:       https://weworkremotely.com/categories/remote-design-jobs.rss
 *
 * We use 3 feeds to maximise relevant content without spamming WWR.
 * Dedup (hash) handles overlap between categories.
 *
 * WWR RSS quirks:
 * - Title contains both job title AND company: "<company>: <title>"
 * - <company> field available per item
 * - Descriptions are HTML (CDATA)
 * - dates in RFC822 format
 */

import { guardedFetch } from '../http'
import { parseRss } from '../rss'
import { validateRawJobs } from '../schemas'
import type { SourceAdapter, FetchContext, FetchResult, RawJob } from '../types'

// ---------------------------------------------------------------------------
// Feed list
// ---------------------------------------------------------------------------

const WWR_FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
]

// ---------------------------------------------------------------------------
// Title parsing
// ---------------------------------------------------------------------------

/**
 * WWR titles include the company: "AlphaTech Inc: Senior Backend Engineer"
 * When the <company> field is already available, we prefer it.
 * But for safety, we also try to parse the title string.
 */
function cleanTitle(rawTitle: string): string {
  // Remove "Company: " prefix if it exists
  const colonIdx = rawTitle.indexOf(':')
  if (colonIdx > 0 && colonIdx < 60) {
    return rawTitle.slice(colonIdx + 1).trim()
  }
  return rawTitle.trim()
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const wwrAdapter: SourceAdapter = {
  source: 'wwr',

  get enabled(): boolean {
    const disabled = process.env.INGEST_DISABLED_SOURCES ?? ''
    return !disabled.split(',').map(s => s.trim()).includes('wwr')
  },

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const startedAt = Date.now()

    // Fetch all feeds — we use the same ifNoneMatch/ifModifiedSince for the first feed.
    // In practice, WWR RSS is updated frequently enough that 304 is rare.
    // Individual feed ETags are not tracked separately to keep source_state simple (1 row/source).
    // Phase 2 could track per-feed ETags if needed.

    const allJobs: RawJob[] = []
    let anyNotModified = false
    let lastEtag: string | null = null
    let lastModified: string | null = null

    for (let i = 0; i < WWR_FEEDS.length; i++) {
      // Check deadline before each feed
      if (ctx.signal.aborted) {
        ctx.log('warn', 'wwr: deadline hit — stopping feed fetching', { feedIndex: i })
        break
      }

      const feedUrl = WWR_FEEDS[i]

      // Only send conditional GET headers for the first feed
      const fetchResult = await guardedFetch({
        url: feedUrl,
        format: 'rss',
        ifNoneMatch: i === 0 ? ctx.ifNoneMatch : null,
        ifModifiedSince: i === 0 ? ctx.ifModifiedSince : null,
        signal: ctx.signal,
        log: ctx.log,
      })

      if (fetchResult.notModified && i === 0) {
        // If first feed is 304, assume all feeds unchanged (conservative)
        anyNotModified = true
        lastEtag = fetchResult.etag
        lastModified = fetchResult.lastModified
        ctx.log('info', 'wwr: first feed 304 — assuming all feeds unchanged')
        break
      }

      if (i === 0) {
        lastEtag = fetchResult.etag
        lastModified = fetchResult.lastModified
      }

      // Parse RSS
      const { jobs: rawJobs, failedItems } = parseRss(fetchResult.body)

      if (failedItems > 0) {
        ctx.log('warn', 'wwr: some RSS items failed parsing', { feedUrl, failedItems })
      }

      // Clean WWR-specific title format ("Company: Title")
      const cleanedJobs: RawJob[] = rawJobs.map(job => ({
        ...job,
        title: cleanTitle(job.title),
      }))

      allJobs.push(...cleanedJobs)
      ctx.log('info', 'wwr: feed parsed', { feedUrl, count: cleanedJobs.length })
    }

    if (anyNotModified) {
      return {
        jobs: [],
        notModified: true,
        etag: lastEtag,
        lastModified,
        durationMs: Date.now() - startedAt,
      }
    }

    // Deduplicate by source_url within this batch (same job can appear in multiple categories)
    const seenUrls = new Set<string>()
    const dedupedJobs = allJobs.filter(j => {
      if (seenUrls.has(j.source_url)) return false
      seenUrls.add(j.source_url)
      return true
    })

    // Validate with Zod
    const { valid, failedCount, errors } = validateRawJobs(dedupedJobs)

    if (errors.length > 0) {
      ctx.log('warn', 'wwr: some jobs failed Zod validation', {
        failedCount,
        sample: errors.slice(0, 3).map(e => e.error),
      })
    }

    ctx.log('info', 'wwr: fetch complete', {
      rawTotal: allJobs.length,
      afterDedup: dedupedJobs.length,
      valid: valid.length,
      failed: failedCount,
    })

    return {
      jobs: valid,
      notModified: false,
      etag: lastEtag,
      lastModified,
      durationMs: Date.now() - startedAt,
    }
  },
}
