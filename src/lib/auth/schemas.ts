/**
 * Zod schemas for auth-related input validation.
 *
 * Every user input touching auth goes through these schemas.
 * Defense-in-depth: even if the UI validates, the server re-validates.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Email schema (RFC 5321 practical subset)
// ---------------------------------------------------------------------------

/**
 * Email validation:
 * - Trimmed and lowercased before validation
 * - Max 254 chars (RFC 5321 limit)
 * - Must match email() built-in Zod validator
 *
 * We normalize aggressively to prevent duplicate accounts
 * from case/whitespace variations.
 */
export const emailSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, 'Email is required')
      .max(254, 'Email must be 254 characters or less')
      .email('Please enter a valid email address'),
  )

// ---------------------------------------------------------------------------
// Login form schema
// ---------------------------------------------------------------------------

export const loginFormSchema = z.object({
  email: emailSchema,
})

export type LoginFormData = z.infer<typeof loginFormSchema>

// ---------------------------------------------------------------------------
// Return-to URL (for redirect after auth)
// ---------------------------------------------------------------------------

/**
 * Validates and sanitizes the `next` / `returnTo` parameter.
 * Only accepts local paths to prevent open-redirect attacks.
 *
 * Allowed: /feed, /onboarding, /jobs/123
 * Blocked: //evil.com, javascript:alert(1), data:text/html,...,
 *          https://evil.com, \\evil.com, /\evil.com
 */
export const returnToSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return undefined
    return val.trim()
  })
  .pipe(
    z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true // undefined is fine (will use default)
          return isValidReturnTo(val)
        },
        { message: 'Invalid return URL' },
      ),
  )

/**
 * Pure validation function for return-to URLs.
 * Exported separately for use in route handlers without Zod overhead.
 *
 * Rules:
 * 1. Must start with a single forward slash
 * 2. Second character must NOT be a slash or backslash (blocks //evil, /\evil)
 * 3. Must not contain protocol-like patterns (javascript:, data:, vbscript:)
 * 4. Must not contain encoded variants of dangerous characters
 * 5. Max length 2048 to prevent buffer abuse
 */
export function isValidReturnTo(url: string): boolean {
  // Must be a string with content
  if (!url || typeof url !== 'string') return false

  // Max length
  if (url.length > 2048) return false

  // Must start with exactly one forward slash, followed by a non-slash, non-backslash char
  // This blocks: //evil.com, /\evil.com, / (root alone is fine as special case)
  if (url === '/') return true
  if (!url.startsWith('/')) return false
  if (url.length > 1 && (url[1] === '/' || url[1] === '\\')) return false

  // Block protocol schemes (case-insensitive)
  const lower = url.toLowerCase()
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'blob:', 'file:']
  for (const scheme of dangerousSchemes) {
    if (lower.includes(scheme)) return false
  }

  // Block URL-encoded variants of / and \ that could bypass checks
  // %2f = /, %5c = \, %2F = /, %5C = \
  if (url.includes('%2f') || url.includes('%2F')) return false
  if (url.includes('%5c') || url.includes('%5C')) return false

  // Block null bytes
  if (url.includes('%00') || url.includes('\0')) return false

  return true
}

/**
 * Sanitize a return-to value: validate and return the path, or fallback.
 * Use this in route handlers for one-liner safety.
 */
export function safeReturnTo(raw: string | null | undefined, fallback = '/feed'): string {
  if (!raw) return fallback
  const trimmed = raw.trim()
  return isValidReturnTo(trimmed) ? trimmed : fallback
}
