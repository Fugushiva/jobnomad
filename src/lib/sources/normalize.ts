/**
 * Normalization utilities for job deduplication.
 *
 * The hash must be stable across sources — the same job fetched from
 * RemoteOK and re-posted on WWR should produce the same hash_dedup.
 *
 * Algorithm (per spec §5, ADR-003):
 *   sha256( normalize(title) + '|' + normalize(company) + '|' + normalize(description[0:200]) )
 *
 * Uses Web Crypto API (crypto.subtle) — no third-party crypto dependencies,
 * available in Node.js 20+ and Vercel Edge runtime.
 */

import type { RawJob, NormalizedJob, SourceName } from './types'

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a string for stable deduplication.
 *
 * Rules (conservative — prefer false-negative over false-positive dedup):
 * 1. Lowercase
 * 2. Unicode NFC normalization (é == é)
 * 3. Collapse all whitespace sequences to single space
 * 4. Strip leading/trailing whitespace
 * 5. Remove control characters (U+0000–U+001F, U+007F–U+009F)
 *
 * We do NOT remove punctuation — "Sr." and "Sr" are the same role but
 * "React.js" and "ReactJS" are legitimately the same skill yet differ.
 * Keeping punctuation is slightly less aggressive but avoids false positives
 * that would silently drop genuinely different jobs.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    // Remove control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// SHA-256 hash (Web Crypto, async)
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hex digest of the given string.
 * Uses Web Crypto (no external dep, works in Node 20+ and Vercel Edge).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Dedup hash
// ---------------------------------------------------------------------------

/**
 * Compute the canonical deduplication hash for a raw job.
 *
 * Hash input: normalize(title) + '\x00' + normalize(company) + '\x00' + normalize(description[0:200])
 *
 * The 200-char description prefix catches rewrites of the same posting
 * without being sensitive to minor edits in the body. Using '|' as separator
 * prevents "A" + "B|C" == "A|B" + "C" collisions.
 */
export async function buildHashDedup(job: Pick<RawJob, 'title' | 'company' | 'description'>): Promise<string> {
  const nTitle = normalize(job.title)
  const nCompany = normalize(job.company)
  const nDesc = normalize(job.description.slice(0, 200))
  // Use \x00 as field separator — it is stripped by normalize(), so it can
  // never appear in any normalized field value. This prevents the boundary
  // collision: normalize("A") + "\x00" + normalize("B\x00C") cannot equal
  // normalize("A\x00B") + "\x00" + normalize("C").
  const input = `${nTitle}\x00${nCompany}\x00${nDesc}`
  return sha256Hex(input)
}

// ---------------------------------------------------------------------------
// Full normalization pipeline
// ---------------------------------------------------------------------------

/**
 * Normalize a raw job and compute its dedup hash.
 * Returns a NormalizedJob ready for upsert into `jobs`.
 */
export async function normalizeJob(raw: RawJob, source: SourceName): Promise<NormalizedJob> {
  const hash_dedup = await buildHashDedup(raw)
  return {
    ...raw,
    source,
    hash_dedup,
    // Trim title and company (description is kept raw for Gemini in T4)
    title: raw.title.trim(),
    company: raw.company.trim(),
  }
}
