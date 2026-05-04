/**
 * Zod-validated environment variables.
 * Imported once at app boot — fails fast if any required var is missing.
 *
 * Usage:
 *   import { env } from '@/src/lib/env'
 *   env.NEXT_PUBLIC_SUPABASE_URL  // typed, validated
 *
 * SECURITY: Never log the full env object. Only public vars are safe to expose.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // --- Public (safe for browser) ---
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

  // --- Server-only secrets (never ship to client) ---
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required')
    .optional(), // Optional during client-side build; required at runtime for server code

  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 chars').optional(),

  RATE_LIMIT_PEPPER: z
    .string()
    .min(16, 'RATE_LIMIT_PEPPER must be at least 16 chars')
    .default('jobnomad-dev-pepper-change-me'),

  // --- Third-party (server-only) ---
  RESEND_API_KEY: z.string().optional(),
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
