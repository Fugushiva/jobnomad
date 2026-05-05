#!/usr/bin/env tsx
/**
 * scripts/setup-supabase-smtp.ts
 *
 * Idempotent script that configures Resend SMTP on a Supabase project
 * via the Supabase Management API.
 *
 * Usage:
 *   npm run smtp:dry      # Preview the payload without sending
 *   npm run smtp:setup    # Apply the SMTP config to Supabase
 *   npm run smtp:verify   # Read back the current SMTP config (audit)
 *
 * Required env vars (in .env.local or shell):
 *   SUPABASE_PROJECT_REF    20-char project ref (e.g. abcdefghijklmnopqrst)
 *   SUPABASE_ACCESS_TOKEN   Personal access token (sbp_...)
 *   RESEND_API_KEY          Resend API key (re_...)
 *   EMAIL_FROM_ADDRESS      From address (auth@jobnomad.app)
 *   EMAIL_FROM_NAME         From name (JobNomad)
 *
 * SECURITY:
 *   - The SMTP password (RESEND_API_KEY) is NEVER logged, only its prefix.
 *   - The Bearer token (SUPABASE_ACCESS_TOKEN) is NEVER logged.
 *   - Dry-run mode does not call any external API.
 *   - Verify mode is read-only (GET request only).
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Load .env.local if not already in process.env
// ---------------------------------------------------------------------------

function loadDotEnv() {
  // Only load .env.local in scripts -- Next.js handles this at app runtime
  const envPath = join(process.cwd(), '.env.local')
  try {
    const contents = readFileSync(envPath, 'utf8')
    for (const line of contents.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      // Don't override vars already set in the shell environment
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // .env.local may not exist (e.g. CI where vars are injected directly)
  }
}

loadDotEnv()

// ---------------------------------------------------------------------------
// Validate required env vars
// ---------------------------------------------------------------------------

const requiredEnvSchema = z.object({
  SUPABASE_PROJECT_REF: z
    .string()
    .regex(/^[a-z]{20}$/, 'SUPABASE_PROJECT_REF must be exactly 20 lowercase letters'),
  SUPABASE_ACCESS_TOKEN: z
    .string()
    .startsWith('sbp_', 'SUPABASE_ACCESS_TOKEN must start with "sbp_"'),
  RESEND_API_KEY: z
    .string()
    .startsWith('re_', 'RESEND_API_KEY must start with "re_"'),
  EMAIL_FROM_ADDRESS: z
    .string()
    .email('EMAIL_FROM_ADDRESS must be a valid email'),
  EMAIL_FROM_NAME: z
    .string()
    .min(1, 'EMAIL_FROM_NAME must not be empty')
    .default('JobNomad'),
})

type RequiredEnv = z.infer<typeof requiredEnvSchema>

// ---------------------------------------------------------------------------
// SMTP payload builder
// ---------------------------------------------------------------------------

export interface SmtpConfig {
  smtp_admin_email: string
  smtp_host: string
  smtp_port: string   // Supabase Management API expects a string, not a number
  smtp_user: string
  smtp_pass: string
  smtp_sender_name: string
  smtp_max_frequency: number
  mailer_secure_email_change_enabled: boolean
  external_email_enabled: boolean
  mailer_otp_exp: number
}

export function buildSmtpConfig(vars: RequiredEnv): SmtpConfig {
  return {
    smtp_admin_email: vars.EMAIL_FROM_ADDRESS,
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',  // API requires string
    smtp_user: 'resend',
    smtp_pass: vars.RESEND_API_KEY,
    smtp_sender_name: vars.EMAIL_FROM_NAME,
    smtp_max_frequency: 60,
    mailer_secure_email_change_enabled: true,
    external_email_enabled: true,
    mailer_otp_exp: 3600,
  }
}

/** Return a redacted version safe to log (NEVER log the real smtp_pass) */
export function redactSmtpConfig(config: SmtpConfig): Record<string, unknown> {
  return {
    ...config,
    smtp_pass: `${config.smtp_pass.slice(0, 5)}...REDACTED`,
  }
}

// ---------------------------------------------------------------------------
// Management API helpers
// ---------------------------------------------------------------------------

export const MANAGEMENT_API_BASE = 'https://api.supabase.com/v1'

export interface ApiResult {
  ok: boolean
  status: number
  data: unknown
  error?: string
}

export async function callManagementApi(
  method: 'GET' | 'PATCH',
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<ApiResult> {
  const url = `${MANAGEMENT_API_BASE}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const init: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }

  const response = await fetch(url, init)
  const text = await response.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
    }
  }

  return { ok: true, status: response.status, data }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = join(process.cwd(), 'supabase', 'templates')

interface EmailTemplateSet {
  magic_link?: { html: string; txt: string }
  confirm_signup?: { html: string; txt: string }
  recovery?: { html: string; txt: string }
}

function loadTemplates(): EmailTemplateSet {
  function loadFile(filename: string): string | undefined {
    const path = join(TEMPLATES_DIR, filename)
    if (existsSync(path)) {
      return readFileSync(path, 'utf8')
    }
    return undefined
  }

  const result: EmailTemplateSet = {}

  const mlHtml = loadFile('magic-link.html')
  const mlTxt = loadFile('magic-link.txt')
  if (mlHtml && mlTxt) {
    result.magic_link = { html: mlHtml, txt: mlTxt }
  }

  const csHtml = loadFile('confirm-signup.html')
  const csTxt = loadFile('confirm-signup.txt')
  if (csHtml && csTxt) {
    result.confirm_signup = { html: csHtml, txt: csTxt }
  }

  const recHtml = loadFile('recovery.html')
  const recTxt = loadFile('recovery.txt')
  if (recHtml && recTxt) {
    result.recovery = { html: recHtml, txt: recTxt }
  }

  return result
}

/**
 * Push email templates to Supabase Auth config.
 * Supabase Management API field names for templates:
 *   mailer_templates_magic_link_content    -- magic link HTML
 *   mailer_templates_magic_link_content_plain -- magic link TXT (not always in API)
 *   (Supabase's template API is limited -- we use the main config PATCH endpoint)
 *
 * Note: Supabase's Management API does not yet expose all template fields.
 * The templates in supabase/templates/ serve as the source of truth.
 * Configure them manually in the Dashboard (Authentication > Email Templates)
 * using the content of these files, or via the Supabase CLI local config.
 */
export async function pushTemplates(vars: RequiredEnv): Promise<void> {
  const templates = loadTemplates()
  const loaded = Object.keys(templates)

  if (loaded.length === 0) {
    console.log('[smtp:templates] No templates found in supabase/templates/. Skipping.')
    return
  }

  console.log(`[smtp:templates] Found templates: ${loaded.join(', ')}`)

  // Build the config patch with template fields supported by the Management API
  // Field names from: https://api.supabase.com/api/v1#tag/projects/patch/v1/projects/{ref}/config/auth
  const templatePayload: Record<string, string> = {}

  if (templates.magic_link) {
    templatePayload['mailer_templates_magic_link_content'] = templates.magic_link.html
  }
  if (templates.confirm_signup) {
    templatePayload['mailer_templates_confirmation_content'] = templates.confirm_signup.html
  }
  if (templates.recovery) {
    templatePayload['mailer_templates_recovery_content'] = templates.recovery.html
  }

  if (Object.keys(templatePayload).length === 0) {
    console.log('[smtp:templates] No template fields to push. Skipping.')
    return
  }

  console.log('[smtp:templates] Pushing templates to Supabase Auth config...')

  const result = await callManagementApi(
    'PATCH',
    `/projects/${vars.SUPABASE_PROJECT_REF}/config/auth`,
    vars.SUPABASE_ACCESS_TOKEN,
    templatePayload,
  )

  if (!result.ok) {
    console.warn('[smtp:templates] WARNING: Template push failed:', result.error)
    console.warn('[smtp:templates] Templates may need to be set manually in the Supabase Dashboard.')
    console.warn('[smtp:templates] Dashboard > Authentication > Email Templates')
    console.warn('[smtp:templates] Template files are in supabase/templates/')
    // Non-fatal: template push failure does not block SMTP config
  } else {
    console.log('[smtp:templates] Templates pushed successfully.')
  }
}

export async function applySmtpConfig(vars: RequiredEnv): Promise<void> {
  const config = buildSmtpConfig(vars)

  console.log('[smtp:setup] Applying SMTP config to Supabase project:', vars.SUPABASE_PROJECT_REF)
  console.log('[smtp:setup] Payload (redacted):', JSON.stringify(redactSmtpConfig(config), null, 2))

  const result = await callManagementApi(
    'PATCH',
    `/projects/${vars.SUPABASE_PROJECT_REF}/config/auth`,
    vars.SUPABASE_ACCESS_TOKEN,
    config as unknown as Record<string, unknown>,
  )

  if (!result.ok) {
    console.error('[smtp:setup] ERROR:', result.error)
    console.error('[smtp:setup] Response body:', JSON.stringify(result.data, null, 2))
    process.exit(1)
  }

  console.log('[smtp:setup] SUCCESS. SMTP config applied.')

  // Also push email templates
  await pushTemplates(vars)

  console.log('[smtp:setup] Run "npm run smtp:verify" to confirm the config is live.')
}

export async function verifySmtpConfig(vars: RequiredEnv): Promise<void> {
  console.log('[smtp:verify] Reading SMTP config from Supabase project:', vars.SUPABASE_PROJECT_REF)

  const result = await callManagementApi(
    'GET',
    `/projects/${vars.SUPABASE_PROJECT_REF}/config/auth`,
    vars.SUPABASE_ACCESS_TOKEN,
  )

  if (!result.ok) {
    console.error('[smtp:verify] ERROR:', result.error)
    process.exit(1)
  }

  const data = result.data as Record<string, unknown>

  // Only print the SMTP-relevant fields (not the full auth config which is verbose)
  const smtpFields = [
    'smtp_admin_email',
    'smtp_host',
    'smtp_port',
    'smtp_user',
    'smtp_sender_name',
    'smtp_max_frequency',
    'mailer_secure_email_change_enabled',
    'external_email_enabled',
    'mailer_otp_exp',
    // smtp_pass is intentionally NOT printed -- it's a secret
  ]

  const smtpConfig: Record<string, unknown> = {}
  for (const field of smtpFields) {
    if (field in data) {
      smtpConfig[field] = data[field]
    }
  }

  console.log('[smtp:verify] Current SMTP config (smtp_pass REDACTED):')
  console.log(JSON.stringify(smtpConfig, null, 2))

  // Validate that config matches expected values
  const issues: string[] = []

  if (smtpConfig.smtp_host !== 'smtp.resend.com') {
    issues.push(`smtp_host: expected "smtp.resend.com", got "${smtpConfig.smtp_host}"`)
  }
  // API returns port as string -- compare as string
  if (String(smtpConfig.smtp_port) !== '465') {
    issues.push(`smtp_port: expected "465", got "${smtpConfig.smtp_port}"`)
  }
  if (smtpConfig.smtp_user !== 'resend') {
    issues.push(`smtp_user: expected "resend", got "${smtpConfig.smtp_user}"`)
  }
  if (smtpConfig.smtp_admin_email !== vars.EMAIL_FROM_ADDRESS) {
    issues.push(
      `smtp_admin_email: expected "${vars.EMAIL_FROM_ADDRESS}", got "${smtpConfig.smtp_admin_email}"`,
    )
  }
  if (smtpConfig.external_email_enabled !== true) {
    issues.push(`external_email_enabled: expected true, got ${smtpConfig.external_email_enabled}`)
  }

  if (issues.length > 0) {
    console.warn('[smtp:verify] WARNING: Config drift detected:')
    for (const issue of issues) {
      console.warn(`  - ${issue}`)
    }
    console.warn('[smtp:verify] Run "npm run smtp:setup" to re-apply the correct config.')
    process.exit(2) // exit 2 = drift (not an error, but requires attention)
  }

  console.log('[smtp:verify] Config is correct. No drift detected.')
}

export function dryRun(vars: RequiredEnv): void {
  const config = buildSmtpConfig(vars)
  console.log('[smtp:dry] DRY RUN -- no API calls will be made.')
  console.log('[smtp:dry] Would PATCH /projects/{ref}/config/auth with:')
  console.log(JSON.stringify(redactSmtpConfig(config), null, 2))
  console.log('[smtp:dry] Target project:', vars.SUPABASE_PROJECT_REF)
  console.log('[smtp:dry] Management API endpoint:', `${MANAGEMENT_API_BASE}/projects/${vars.SUPABASE_PROJECT_REF}/config/auth`)
  console.log('[smtp:dry] To apply, run: npm run smtp:setup')
}

// ---------------------------------------------------------------------------
// Main entry point (only runs when executed directly, not when imported)
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isVerify = args.includes('--verify')

  // Parse env vars
  const parsed = requiredEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('[smtp] ERROR: Missing or invalid environment variables:')
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    console.error('\nRequired vars: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, RESEND_API_KEY,')
    console.error('               EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME')
    console.error('\nSet these in .env.local or export them in your shell.')
    process.exit(1)
  }

  const vars = parsed.data

  if (isDryRun) {
    dryRun(vars)
  } else if (isVerify) {
    await verifySmtpConfig(vars)
  } else {
    await applySmtpConfig(vars)
  }
}

// Run main only when this file is the entry point
// In ESM, import.meta.url is the canonical URL of the current module
const isMain = process.argv[1] === import.meta.filename ||
  process.argv[1]?.endsWith('setup-supabase-smtp.ts') ||
  process.argv[1]?.endsWith('setup-supabase-smtp.js')

if (isMain) {
  main().catch((err) => {
    console.error('[smtp] Unhandled error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
