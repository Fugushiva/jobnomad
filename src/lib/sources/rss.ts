/**
 * RSS 2.0 parser for the ingestion pipeline.
 *
 * Security posture (A06 — Vulnerable Components):
 * - Uses fast-xml-parser v5 with processEntities:false (blocks XXE / entity expansion)
 * - htmlEntities:true decodes &amp; &lt; etc. in CDATA safely
 * - No external entity loading possible
 *
 * Handles common RSS quirks from job boards:
 * - Content inside <![CDATA[...]]> (very common for descriptions)
 * - Mixed RFC822 / ISO 8601 / custom date formats
 * - Missing optional fields (logo, date, guid)
 * - Items as array OR single object (common parsing gotcha)
 * - Encoding: UTF-8 only (latin-1 would require a different pipeline)
 */

import { XMLParser } from 'fast-xml-parser'
import type { RawJob } from './types'

// ---------------------------------------------------------------------------
// Parser configuration (XXE-safe)
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // processEntities: false prevents entity expansion attacks (XXE / DoS)
  processEntities: false,
  // htmlEntities: true decodes &amp; &lt; &gt; &apos; &quot; inside CDATA
  htmlEntities: true,
  // Don't auto-coerce tag values (e.g. "123" stays "123", not 123)
  parseTagValue: false,
  trimValues: true,
  // CDATA sections are mapped to the tag's string value by fast-xml-parser
  // when cdataPropName is not set — they appear as plain text which is what we want
})

// ---------------------------------------------------------------------------
// RSS item shape (loose — we only read what we need)
// ---------------------------------------------------------------------------

interface RssChannel {
  title?: unknown
  item?: unknown
}

interface RssRoot {
  rss?: { channel?: RssChannel }
  feed?: unknown // Atom feeds — not supported, silently returns []
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

/**
 * Parse a date string from RSS pubDate.
 * Accepts: RFC822 ("Thu, 01 May 2026 00:00:00 +0000") and ISO 8601.
 * Returns null on failure — missing dates are normal in RSS.
 */
function parseDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// String coercion (fast-xml-parser may return numbers for all-digit values)
// ---------------------------------------------------------------------------

function asString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return ''
}

// ---------------------------------------------------------------------------
// HTTPS URL validation (inline, no zod import needed here)
// ---------------------------------------------------------------------------

function isHttpsUrl(val: unknown): val is string {
  if (typeof val !== 'string') return false
  try {
    const u = new URL(val)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Item extraction
// ---------------------------------------------------------------------------

/**
 * Extract a single RawJob from an RSS <item> object.
 * Returns null if required fields (title, company, description, url) are missing.
 */
export function extractItemJob(item: Record<string, unknown>, defaultCompany?: string): RawJob | null {
  const title = asString(item['title']).trim()
  if (!title) return null

  // Link / source_url
  const link = asString(item['link'] ?? item['guid']).trim()
  if (!isHttpsUrl(link)) return null

  // Description (content of the job posting)
  const description = asString(item['description'] ?? item['content:encoded'] ?? item['content']).trim()
  if (!description) return null

  // Company: job boards use different fields.
  // Some feeds (e.g. WWR) encode company in the title ("Company: Title") —
  // the adapter is responsible for extracting it post-parse.
  // We allow empty company here and let the adapter/validator decide.
  const company = asString(
    item['company'] ??
    item['himalayasJobs:companyName'] ??
    item['dc:creator'] ??
    item['author'] ??
    defaultCompany ??
    ''
  ).trim()

  // GUID / source_id (optional)
  const guidRaw = item['guid']
  const source_id = typeof guidRaw === 'object' && guidRaw !== null
    ? asString((guidRaw as Record<string, unknown>)['#text'] ?? '')
    : asString(guidRaw)

  // Date
  const posted_at = parseDate(item['pubDate'] ?? item['published'] ?? item['dc:date'])

  // Logo (optional — rarely present in RSS)
  // Himalayas uses <media:content url="..."> as an object: { '@_url': '...', '@_medium': 'image' }
  const mediaContent = item['media:content']
  const mediaContentUrl = mediaContent && typeof mediaContent === 'object'
    ? asString((mediaContent as Record<string, unknown>)['@_url'] ?? '')
    : ''
  const logoRaw = asString(item['media:thumbnail'] ?? item['enclosure'] ?? '') || mediaContentUrl
  const logo_url = isHttpsUrl(logoRaw) ? logoRaw : null

  return {
    source_id: source_id || null,
    source_url: link,
    title,
    company,
    description,
    posted_at,
    logo_url,
  }
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export interface ParseRssResult {
  jobs: RawJob[]
  /** Number of items that failed validation (missing required fields) */
  failedItems: number
}

/**
 * Parse an RSS 2.0 XML string into an array of RawJob.
 *
 * @param xml - Raw XML string from the HTTP response body
 * @param defaultCompany - Fallback company name (some feeds omit it per-item)
 * @returns ParseRssResult with jobs array and count of items that failed
 *
 * Throws if the XML is completely unparseable (not valid XML at all).
 * Individual malformed items are silently skipped (counted in failedItems).
 */
export function parseRss(xml: string, defaultCompany?: string): ParseRssResult {
  if (!xml || xml.trim().length === 0) {
    return { jobs: [], failedItems: 0 }
  }

  // Parse XML — throws on completely invalid XML or on external entity declarations
  // (fast-xml-parser throws "External entities are not supported" — this IS the security
  // boundary we want: XXE attacks are rejected at parse time, not silently ignored)
  let root: RssRoot
  try {
    root = parser.parse(xml)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // External entities = XXE attempt — rethrow with a clearer message
    if (message.includes('External entities')) {
      throw new Error(`RSS parse rejected: external entity declaration detected (XXE prevention). Source: ${message}`)
    }
    throw err
  }

  // Support RSS 2.0 only (Atom <feed> is not used by our sources)
  const channel = root?.rss?.channel
  if (!channel) {
    return { jobs: [], failedItems: 0 }
  }

  // Normalise items: can be array or single object
  const rawItems = channel.item
  if (!rawItems) {
    return { jobs: [], failedItems: 0 }
  }

  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems]

  const jobs: RawJob[] = []
  let failedItems = 0

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      failedItems++
      continue
    }
    const job = extractItemJob(item as Record<string, unknown>, defaultCompany)
    if (job) {
      jobs.push(job)
    } else {
      failedItems++
    }
  }

  return { jobs, failedItems }
}
