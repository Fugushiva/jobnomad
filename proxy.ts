/**
 * proxy.ts — Next.js 16 proxy (replaces middleware.ts)
 *
 * Runs before every matched route to:
 * 1. Refresh the Supabase JWT session cookie (7-day window)
 * 2. Pass the refreshed response headers downstream
 *
 * IMPORTANT: This file MUST NOT contain auth-guard redirects.
 * Redirect logic lives in Server Components/Actions to avoid loops.
 * Proxy is for session refresh only (Supabase SSR requirement).
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Start with an unmodified response
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. Set cookies on the request (so downstream Server Components see them)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // 2. Create a new response that carries these cookie headers
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do NOT use supabase.auth.getSession() here.
  // getUser() sends a request to the Supabase Auth server every time
  // to revalidate the Auth token → this is the secure approach.
  // getSession() only reads from the cookie and doesn't validate.
  //
  // We don't need the user object here — we just need the side-effect
  // of refreshing the session cookie via getUser().
  await supabase.auth.getUser()

  return supabaseResponse
}

/**
 * Matcher: run proxy on all routes EXCEPT:
 * - _next/static (static files)
 * - _next/image (image optimization)
 * - favicon.ico
 * - Static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
 *
 * This ensures auth cookie refresh happens on all page navigations
 * and API calls, but not on static asset requests.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
