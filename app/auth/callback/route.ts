/**
 * GET /auth/callback — PKCE code exchange.
 *
 * Supabase redirects here after the user clicks the magic link.
 * The URL contains ?code=... which we exchange for a session.
 *
 * Query params:
 *   - code: PKCE authorization code (required)
 *   - next: optional return-to path (validated against open-redirect)
 *
 * On success: redirect to `next` or /feed
 * On error: redirect to /auth/error?reason=...
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { safeReturnTo } from '@/src/lib/auth/schemas'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get('code')
  const next = safeReturnTo(searchParams.get('next'), '/feed')

  if (!code) {
    // No code in URL — likely a direct visit or tampered link
    return NextResponse.redirect(
      new URL('/auth/error?reason=missing_code', origin),
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] Code exchange failed:', error.message)

    // Distinguish expired vs other errors for better UX
    const reason = error.message.includes('expired')
      ? 'link_expired'
      : 'exchange_failed'

    return NextResponse.redirect(
      new URL(`/auth/error?reason=${reason}`, origin),
    )
  }

  // Session established — redirect to target
  return NextResponse.redirect(new URL(next, origin))
}
