/**
 * Zod-validated environment variables.
 * Imported once at app boot -- fails fast if any required var is missing.
 *
 * Usage:
 *   import { env } from '@/src/lib/env'
 *   env.NEXT_PUBLIC_SUPABASE_URL  // typed, validated
 *
 * SECURITY: Never log the full env object. Only public vars are safe to expose.
 *
 * Variable groups:
 *   NEXT_PUBLIC_*         -> safe for browser bundle (inlined by Next.js)
 *   SUPABASE_*            -> server-only Supabase secrets
 *   RESEND_*              -> server-only email sending secrets
 *   EMAIL_FROM_*          -> sender identity config (non-secret but server-only)
 *   STRIPE_*              -> server-only payment secrets
 *   GEMINI_API_KEY / OPENAI_API_KEY  -> server-only AI keys
 *   CRON_SECRET                      -> server-only cron authentication
 *   RATE_LIMIT_PEPPER                -> server-only rate-limit hashing pepper
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True in a real production runtime (not a CI build with placeholders). */
const isProduction = process.env.NODE_ENV === 'production'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // -------------------------------------------------------------------------
  // Public (safe for browser)
  // -------------------------------------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),

  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'),

  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL')
    .default('http://localhost:3000'),

  // -------------------------------------------------------------------------
  // Supabase -- server-only secrets
  // -------------------------------------------------------------------------

  /** Service role key -- NEVER expose to client. Used only in cron handlers. */
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required')
    .optional(), // Required at runtime for server code; optional during client-side build

  /**
   * Project ref (e.g. "abcdefghijkl") -- used by the SMTP setup script.
   * Not sensitive but server-only (not needed in browser bundles).
   */
  SUPABASE_PROJECT_REF: z
    .string()
    .regex(/^[a-z]{20}$/, 'SUPABASE_PROJECT_REF must be exactly 20 lowercase letters')
    .optional(),

  /**
   * Supabase personal access token -- used ONLY by scripts/setup-supabase-smtp.ts
   * to call the Management API. NEVER used at app runtime.
   * Keep out of Vercel runtime env vars; only set in local .env.local + CI secret.
   */
  SUPABASE_ACCESS_TOKEN: z
    .string()
    .startsWith('sbp_', 'SUPABASE_ACCESS_TOKEN must start with "sbp_"')
    .optional(),

  // -------------------------------------------------------------------------
  // Resend -- server-only email sending secret
  // -------------------------------------------------------------------------

  /**
   * Resend API key (re_...).
   * Required in production -- Supabase Auth will fail to send emails without it.
   * In development, Supabase CLI uses Inbucket so no real API key is needed.
   */
  RESEND_API_KEY: isProduction
    ? z.string().startsWith('re_', 'RESEND_API_KEY must start with "re_"')
    : z.string().optional(),

  // -------------------------------------------------------------------------
  // Email sender identity -- server-only
  // -------------------------------------------------------------------------

  /**
   * From address used in transactional emails, e.g. "auth@jobnomad.app".
   * Must be a verified domain in Resend.
   * Required in production to ensure correctly signed emails.
   */
  EMAIL_FROM_ADDRESS: isProduction
    ? z
        .string()
        .email('EMAIL_FROM_ADDRESS must be a valid email address')
        .refine(
          (v) =>
            !v.endsWith('@example.com') &&
            !v.endsWith('@resend.dev') &&
            !v.endsWith('@localhost'),
          'EMAIL_FROM_ADDRESS must use your verified domain (not example.com/resend.dev/localhost) in production',
        )
    : z.string().email('EMAIL_FROM_ADDRESS must be a valid email address').optional(),

  /**
   * From name used in transactional emails, e.g. "JobNomad".
   * Shown in email client as the sender display name.
   */
  EMAIL_FROM_NAME: z.string().min(1, 'EMAIL_FROM_NAME must not be empty').default('JobNomad'),

  // -------------------------------------------------------------------------
  // Security
  // -------------------------------------------------------------------------

  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 chars').optional(),

  RATE_LIMIT_PEPPER: z
    .string()
    .min(16, 'RATE_LIMIT_PEPPER must be at least 16 chars')
    .default('jobnomad-dev-pepper-change-me'),

  // -------------------------------------------------------------------------
  // Third-party -- server-only
  // -------------------------------------------------------------------------

  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Parse & export
// ---------------------------------------------------------------------------

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Environment validation failed:\n${formatted}\n\nCheck your .env.local file.`,
    )
  }

  return result.data
}

/**
 * Validated environment variables.
 * Access as `env.NEXT_PUBLIC_SUPABASE_URL`, etc.
 */
export const env = parseEnv()
