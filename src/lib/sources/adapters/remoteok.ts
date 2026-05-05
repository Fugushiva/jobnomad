/**
 * RemoteOK adapter — fetches from the official public JSON API.
 *
 * Endpoint: https://remoteok.com/api
 * Format: JSON array (first element is a metadata object, skip it)
 * ToS: public API, User-Agent required — handled by guardedFetch()
 * Rate limits: not officially documented, but polite usage (6h intervals) is safe.
 *
 * Key fields available from RemoteOK:
 *   id, position (title), company, description, url, logo, date (unix timestamp), tags, salary_min, salary_max
 *
 * Note: RemoteOK sends HTML in `description` — kept raw, Gemini handles it in T4.
 */

import { guardedFetch } from '../http'
import { validateRawJobs } from '../schemas'
import type { SourceAdapter, FetchContext, FetchResult, RawJob } from '../types'

// ---------------------------------------------------------------------------
// RemoteOK API response shape (partial — only fields we use)
// ---------------------------------------------------------------------------

interface RemoteOKJob {
  id?: unknown
  position?: unknown
  company?: unknown
  description?: unknown
  url?: unknown
  logo?: unknown
  date?: unknown       // Unix timestamp string or number
  tags?: unknown[]
  salary_min?: unknown
  salary_max?: unknown
  slug?: unknown
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function asStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function parseDate(v: unknown): Date | null {
  if (!v) return null
  // RemoteOK sends unix timestamps as strings ("1746057600") or numbers
  const raw = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (isNaN(raw)) {
    // Try as ISO string
    const d = new Date(String(v))
    return isNaN(d.getTime()) ? null : d
  }
  // Unix timestamp in seconds
  return new Date(raw * 1000)
}

function parseLogo(logo: unknown): string | null {
  const s = asStr(logo).trim()
  if (!s) return null
  // RemoteOK logos may be relative paths — prepend base
  if (s.startsWith('http://')) return null  // reject http (SSRF)
  if (s.startsWith('https://')) return s
  if (s.startsWith('/')) return `https://remoteok.com${s}`
  return null
}

function parseUrl(url: unknown, id: unknown): string | null {
  const s = asStr(url).trim()
  if (s.startsWith('https://')) return s
  // Construct from ID if url is relative or missing
  const idStr = asStr(id).trim()
  if (idStr) return `https://remoteok.com/remote-jobs/${idStr}`
  return null
}

/**
 * Map a single RemoteOK API job object to RawJob candidate.
 * Returns null if required fields are missing/invalid.
 */
function mapJob(raw: RemoteOKJob): Omit<RawJob, 'source_id' | 'source_url'> & { source_id: string | null; source_url: string | null } | null {
  const title = asStr(raw.position).trim()
  if (!title) return null

  const company = asStr(raw.company).trim()
  if (!company) return null

  const description = asStr(raw.description).trim()
  if (!description) return null

  const source_url = parseUrl(raw.url, raw.id ?? raw.slug)
  if (!source_url) return null

  return {
    source_id: asStr(raw.id || raw.slug) || null,
    source_url,
    title,
    company,
    description,
    posted_at: parseDate(raw.date),
    logo_url: parseLogo(raw.logo),
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const remoteOKAdapter: SourceAdapter = {
  source: 'remoteok',

  get enabled(): boolean {
    const disabled = process.env.INGEST_DISABLED_SOURCES ?? ''
    return !disabled.split(',').map(s => s.trim()).includes('remoteok')
  },

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const startedAt = Date.now()

    const result = await guardedFetch({
      url: 'https://remoteok.com/api',
      format: 'json',
      ifNoneMatch: ctx.ifNoneMatch,
      ifModifiedSince: ctx.ifModifiedSince,
      signal: ctx.signal,
      log: ctx.log,
    })

    if (result.notModified) {
      return {
        jobs: [],
        notModified: true,
        etag: result.etag,
        lastModified: result.lastModified,
        durationMs: Date.now() - startedAt,
      }
    }

    // Parse JSON — RemoteOK returns an array where index 0 is a metadata object
    let parsed: unknown[]
    try {
      parsed = JSON.parse(result.body)
    } catch {
      throw new Error('RemoteOK API returned non-JSON response')
    }

    if (!Array.isArray(parsed)) {
      throw new Error('RemoteOK API response is not an array')
    }

    // Skip first element (metadata/legal notice object)
    const jobObjects = parsed.slice(1)

    // Map and validate
    const candidates: unknown[] = []
    for (const raw of jobObjects) {
      if (!raw || typeof raw !== 'object') continue
      const mapped = mapJob(raw as RemoteOKJob)
      if (mapped && mapped.source_url) {
        candidates.push(mapped)
      }
    }

    const { valid, failedCount, errors } = validateRawJobs(candidates)

    if (errors.length > 0) {
      ctx.log('warn', 'remoteok: some jobs failed Zod validation', {
        failedCount,
        sample: errors.slice(0, 3).map(e => e.error),
      })
    }

    ctx.log('info', 'remoteok: fetched and parsed jobs', {
      total: jobObjects.length,
      valid: valid.length,
      failed: failedCount,
    })

    return {
      jobs: valid,
      notModified: false,
      etag: result.etag,
      lastModified: result.lastModified,
      durationMs: Date.now() - startedAt,
    }
  },
}
