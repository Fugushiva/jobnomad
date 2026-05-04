/**
 * POST /auth/signout — Sign out the current user.
 *
 * Uses POST to prevent CSRF via link prefetch (GET-based sign-out is unsafe).
 * Clears the Supabase session cookie and redirects to the login page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[auth/signout] Error:', error.message)
      // Don't block — the session cookie will be cleared anyway
    }
  } catch (err) {
    console.error(
      '[auth/signout] Unexpected error:',
      err instanceof Error ? err.message : err,
    )
  }

  // Always redirect to login regardless of errors
  return NextResponse.redirect(new URL('/auth/login', origin), {
    status: 302,
  })
}
