/**
 * Request origin resolver for OAuth/PKCE redirect URLs.
 *
 * Why this exists:
 *   PKCE flow stores a code_verifier cookie on the domain where the auth
 *   request was initiated. The magic link click must redirect back to the
 *   SAME domain, otherwise exchangeCodeForSession() fails (cookie missing).
 *
 *   Vercel preview deployments use ephemeral hostnames like
 *   `jobnomad-abc123-org.vercel.app` which differ from `NEXT_PUBLIC_SITE_URL`.
 *   Using NEXT_PUBLIC_SITE_URL as emailRedirectTo breaks PKCE on previews.
 *
 *   This helper derives the origin from the actual request, while protecting
 *   against host-header injection attacks (an attacker spoofs the Host header
 *   to make Supabase send magic links pointing to attacker.com).
 *
 * Security model:
 *   1. Read the host from request headers (x-forwarded-host preferred over host)
 *   2. Validate the host against an allowlist
 *   3. If not allowed, fall back to NEXT_PUBLIC_SITE_URL
 *   4. Construct origin from validated scheme + host
 *
 * Allowed hosts:
 *   - The host of NEXT_PUBLIC_SITE_URL (production)
 *   - localhost / 127.0.0.1 (dev)
 *   - *.vercel.app (Vercel preview deployments)
 *
 *   This is intentionally narrow. Adding more hosts requires explicit code change.
 */
import { env } from '@/src/lib/env'

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

/** Hosts whitelisted for use as origin in OAuth/PKCE redirects. */
function getAllowedHostMatchers(): Array<(host: string) => boolean> {
  const matchers: Array<(host: string) => boolean> = []

  // 1. Exact match: host of NEXT_PUBLIC_SITE_URL (production canonical)
  // Also allow the www. subdomain since DNS/CDN may preserve the www prefix
  // from the incoming request before the apex redirect is applied.
  try {
    const siteHost = new URL(env.NEXT_PUBLIC_SITE_URL).host
    matchers.push((h) => h === siteHost)
    // Allow www.{apex} in case the request arrives with www. prefix
    // (Vercel redirects www→apex at the CDN layer, but the x-forwarded-host
    //  header seen by the server action may already reflect the user-facing host)
    if (!siteHost.startsWith('www.')) {
      matchers.push((h) => h === `www.${siteHost}`)
    }
  } catch {
    // env.NEXT_PUBLIC_SITE_URL is always validated by Zod, so this should never throw
  }

  // 2. Local development hosts
  matchers.push((h) => h === 'localhost' || h.startsWith('localhost:'))
  matchers.push((h) => h === '127.0.0.1' || h.startsWith('127.0.0.1:'))

  // 3. Vercel preview deployments (any *.vercel.app)
  // Vercel auto-generates URLs like `<project>-<hash>-<org>.vercel.app`
  matchers.push((h) => /^[a-z0-9-]+\.vercel\.app$/i.test(h))

  return matchers
}

/** True if the given host is allowed as an OAuth redirect origin. */
export function isAllowedAuthHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false
  // Defensive: reject control chars / spaces (host header injection attempts)
  if (/[\s\r\n\t]/.test(host)) return false
  // Reject overlong values (defensive)
  if (host.length > 253) return false

  const matchers = getAllowedHostMatchers()
  return matchers.some((m) => m(host))
}

// ---------------------------------------------------------------------------
// Origin resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical origin (scheme://host) for an OAuth redirect.
 *
 * Strategy:
 *   1. Try x-forwarded-host (Vercel sets this -- it's the user-facing host)
 *   2. Fall back to host header
 *   3. Validate the host against the allowlist
 *   4. If valid: combine with x-forwarded-proto (or 'https' default in prod)
 *   5. If invalid: fall back to NEXT_PUBLIC_SITE_URL
 *
 * @param requestHeaders - Headers from next/headers (server-side only)
 * @returns A safe origin URL like "https://jobnomad-abc.vercel.app"
 */
export function resolveAuthOrigin(requestHeaders: Headers): string {
  // 1. Get the user-facing host
  const forwardedHost = requestHeaders.get('x-forwarded-host')
  const directHost = requestHeaders.get('host')
  const candidate = (forwardedHost || directHost || '').trim()

  // 2. If we have a candidate AND it's allowed, build the origin from it
  if (candidate && isAllowedAuthHost(candidate)) {
    const proto = pickProtocol(requestHeaders, candidate)
    return `${proto}://${candidate}`
  }

  // 3. Fallback: use the canonical site URL from env
  // This is the safe default if host header was missing or unexpected
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '') // strip trailing slash
}

/**
 * Pick the protocol (http vs https) for a given host.
 *
 * Rules:
 *   - localhost / 127.0.0.1 -> http (no TLS in dev)
 *   - Otherwise -> respect x-forwarded-proto if it's http or https
 *   - Otherwise -> default to https (production safe default)
 */
function pickProtocol(headers: Headers, host: string): 'http' | 'https' {
  // Local dev: always http
  const lowerHost = host.toLowerCase()
  if (lowerHost === 'localhost' || lowerHost.startsWith('localhost:')) return 'http'
  if (lowerHost === '127.0.0.1' || lowerHost.startsWith('127.0.0.1:')) return 'http'

  // Trust x-forwarded-proto only if it's a known scheme
  const fp = headers.get('x-forwarded-proto')?.trim().toLowerCase()
  if (fp === 'http' || fp === 'https') return fp

  // Default: https (production-safe)
  return 'https'
}

/**
 * Build a full callback URL by appending /auth/callback to the resolved origin.
 * Convenience wrapper for the common case.
 */
export function resolveAuthCallbackUrl(requestHeaders: Headers): string {
  return `${resolveAuthOrigin(requestHeaders)}/auth/callback`
}
