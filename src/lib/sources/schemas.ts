/**
 * Zod schemas for validating raw job data coming from external sources.
 *
 * Every adapter must validate its output with rawJobSchema before
 * returning it. Invalid jobs are counted as `failed` and skipped —
 * they never reach the database.
 *
 * Security: strict validation prevents:
 * - A01: SSRF via crafted source_url (must be https)
 * - A03: oversized payloads (description capped at 64 KB)
 * - A08: corrupted data stored silently
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** HTTPS-only URL validation — blocks http:// and other schemes */
const httpsUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://'), {
    message: 'Only HTTPS URLs are allowed (SSRF prevention)',
  })

/** Nullable HTTPS URL — used for logo_url (may be absent in RSS) */
const nullableHttpsUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://'), {
    message: 'Only HTTPS URLs are allowed',
  })
  .nullable()
  .optional()
  .transform((v) => v ?? null)

// ---------------------------------------------------------------------------
// Raw job schema
// ---------------------------------------------------------------------------

export const rawJobSchema = z.object({
  source_id: z.string().nullable().optional().transform((v) => v ?? null),

  source_url: httpsUrl,

  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(500, 'Title exceeds 500 chars')
    .trim(),

  company: z
    .string()
    .min(1, 'Company cannot be empty')
    .max(300, 'Company name exceeds 300 chars')
    .trim(),

  description: z
    .string()
    .min(1, 'Description cannot be empty')
    // 64 KB cap — prevents DB bloat, still ample for any job posting
    .max(65536, 'Description exceeds 64 KB limit')
    .trim(),

  posted_at: z
    .union([z.date(), z.null()])
    .optional()
    .transform((v) => v ?? null),

  logo_url: nullableHttpsUrl,
})

export type RawJobInput = z.input<typeof rawJobSchema>
export type RawJobOutput = z.output<typeof rawJobSchema>

// ---------------------------------------------------------------------------
// Batch validation helper
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: RawJobOutput[]
  failedCount: number
  errors: Array<{ index: number; error: string }>
}

/**
 * Validate an array of raw job candidates.
 * Returns valid items and a count of failures — never throws.
 */
export function validateRawJobs(candidates: unknown[]): ValidationResult {
  const valid: RawJobOutput[] = []
  const errors: Array<{ index: number; error: string }> = []

  for (let i = 0; i < candidates.length; i++) {
    const result = rawJobSchema.safeParse(candidates[i])
    if (result.success) {
      valid.push(result.data)
    } else {
      const message = result.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ')
      errors.push({ index: i, error: message })
    }
  }

  return { valid, failedCount: errors.length, errors }
}
