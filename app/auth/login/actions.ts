'use server'

/**
 * Server Action: sendMagicLink
 *
 * Validates email, checks rate limit, then calls Supabase signInWithOtp.
 * Returns a discriminated union so the client can show appropriate UI
 * without leaking internal details.
 */
import { headers } from 'next/headers'
import { loginFormSchema } from '@/src/lib/auth/schemas'
import { checkRateLimit, extractClientIp } from '@/src/lib/auth/rate-limit'
import { resolveAuthCallbackUrl } from '@/src/lib/auth/origin'
import { createClient } from '@/src/lib/supabase/server'

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type SendMagicLinkResult =
  | { success: true }
  | { success: false; error: 'validation'; message: string }
  | { success: false; error: 'rate_limited'; message: string }
  | { success: false; error: 'server'; message: string }

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function sendMagicLink(
  _prevState: SendMagicLinkResult | null,
  formData: FormData,
): Promise<SendMagicLinkResult> {
  // 1. Validate input
  const raw = formData.get('email')
  const parsed = loginFormSchema.safeParse({ email: raw })

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid email'
    return { success: false, error: 'validation', message: msg }
  }

  const { email } = parsed.data

  // 2. Rate-limit check (by hashed IP)
  const reqHeaders = await headers()
  const ip = extractClientIp(reqHeaders)
  const rateLimit = await checkRateLimit(ip)

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: 'rate_limited',
      message: 'Too many attempts. Please try again in an hour.',
    }
  }

  // 3. Send magic link via Supabase Auth
  try {
    const supabase = await createClient()

    // PKCE requires the magic link click to land back on the SAME origin where
    // the request was initiated (so the code_verifier cookie is readable).
    // Resolve from request headers (validated against allowlist), not from
    // env.NEXT_PUBLIC_SITE_URL -- otherwise Vercel preview deployments break.
    const emailRedirectTo = resolveAuthCallbackUrl(reqHeaders)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // The callback URL where Supabase redirects after clicking the link.
        // PKCE: Supabase appends ?code=... to this URL automatically.
        emailRedirectTo,
        shouldCreateUser: true,
      },
    })

    if (error) {
      console.error('[auth/login] Supabase OTP error:', error.message)
      // Don't leak Supabase error details to the client.
      // Always return success-like message to prevent email enumeration.
      // The user sees the same "check your email" screen regardless.
    }
  } catch (err) {
    console.error(
      '[auth/login] Unexpected error:',
      err instanceof Error ? err.message : err,
    )
    // Same: don't reveal whether the email exists
  }

  // 4. Always return success to prevent email enumeration.
  // If the email doesn't exist and shouldCreateUser is false,
  // Supabase returns an error — but we still say "check your email".
  return { success: true }
}
