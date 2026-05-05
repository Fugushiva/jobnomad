'use server'

/**
 * Server Actions for auth — sign out.
 *
 * Security guarantees:
 *  - 'use server' → Next.js 16 enforces CSRF protection automatically
 *    (POST-only, origin check, action ID bound to the server bundle).
 *  - scope: 'local' → invalidates only the current browser session,
 *    not all sessions across devices (avoids involuntary global logout).
 *  - supabase.auth.signOut() is called server-side → the Supabase session
 *    is invalidated on the auth server, not just the client cookie.
 *  - Errors are logged server-side only — never exposed to the client.
 *  - redirect() throws internally → no code executes after the redirect.
 *  - No user input accepted → no validation / injection surface.
 *  - No PII (email, user ID) logged.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'

/**
 * signOut — invalidates the current Supabase session and redirects to the
 * landing page with a `?signed_out=1` flag so the landing page can show a
 * confirmation toast without exposing any URL-reflected content.
 *
 * Always redirects (success or error) — the user is never left in a broken
 * state even if the Supabase API call fails (the session cookie will be
 * cleared on the next Supabase middleware refresh regardless).
 */
export async function signOut(): Promise<never> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      // Log server-side for observability. Never forward to client.
      console.error('[auth/signOut] Supabase signOut error:', error.message)
    }
  } catch (err) {
    // Catch unexpected errors (network, SDK) so the redirect always fires.
    console.error(
      '[auth/signOut] Unexpected error:',
      err instanceof Error ? err.message : String(err),
    )
  }

  // Redirect to the landing page. The ?signed_out=1 flag is a boolean UI
  // signal only — it is not reflected in any HTML output and carries no PII.
  redirect('/?signed_out=1')
}
