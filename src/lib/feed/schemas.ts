/**
 * lib/feed/schemas.ts — Zod validation for feed URL query params (filters).
 *
 * All filter fields are optional. Unknown / malformed values are silently
 * coerced to undefined so a crafted URL never crashes the page.
 *
 * Phase 1 filter set (permissive on NULL — see queries.ts):
 *   contract   — contractor | employee | both
 *   seniority  — junior | mid | senior | lead | any
 *   geo_policy — worldwide | specific_regions | specific_countries
 *   salary_min — integer ≥ 0 (USD annual equivalent)
 *   page       — integer ≥ 1 (default 1)
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Individual filter coercions
// ---------------------------------------------------------------------------

const contractEnum = z.enum(['contractor', 'employee', 'both'])
const seniorityEnum = z.enum(['junior', 'mid', 'senior', 'lead', 'any'])
const geoPolicyEnum = z.enum(['worldwide', 'specific_regions', 'specific_countries'])

// coerce() ensures string query params like "20000" become numbers safely.
const salaryMinSchema = z.coerce
  .number()
  .int()
  .min(0)
  .optional()
  .catch(undefined)

const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .default(1)
  .catch(1)

// ---------------------------------------------------------------------------
// Feed filters schema
// ---------------------------------------------------------------------------

export const feedFiltersSchema = z.object({
  contract: contractEnum.optional().catch(undefined),
  seniority: seniorityEnum.optional().catch(undefined),
  geo_policy: geoPolicyEnum.optional().catch(undefined),
  salary_min: salaryMinSchema,
  page: pageSchema,
})

export type FeedFilters = z.infer<typeof feedFiltersSchema>

// ---------------------------------------------------------------------------
// Helper: parse raw searchParams (Next.js 16 async searchParams)
// ---------------------------------------------------------------------------

/**
 * Parse raw search params (Record<string, string | string[] | undefined>)
 * into validated FeedFilters. Always returns a valid object — never throws.
 */
export function parseFeedFilters(
  raw: Record<string, string | string[] | undefined>,
): FeedFilters {
  // Flatten arrays: take first value only for each key
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v
  }
  return feedFiltersSchema.parse(flat)
}
