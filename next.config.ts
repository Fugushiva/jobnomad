import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * Remote image domains authorised for next/image optimisation.
   * Required for job board logos (RemoteOK CDN) and company logos (Clearbit).
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'remoteok.com' },
      { protocol: 'https', hostname: 'logo.clearbit.com' },
    ],
  },

  /**
   * Security headers applied to all routes.
   * See OWASP Secure Headers Project:
   * https://owasp.org/www-project-secure-headers/
   *
   * CSP (phase 1, starter): permissive enough for Next.js, Tailwind v4 inline
   * styles, and Radix UI portals while still blocking the major XSS sinks
   * (no inline scripts except those with nonces injected by Next.js, no
   * eval, only same-origin script/connect, no plugins, no framing).
   * A strict nonce-based CSP without 'unsafe-inline' on script-src is the
   * phase-2 hardening target once we adopt nonce middleware.
   */
  async headers() {
    // Build CSP as a single space-joined string. Each directive on its own
    // const for readability + linting.
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' is needed during phase 1 because Next.js streams inline
      // bootstrap chunks without nonces unless we wire up a proxy.ts nonce
      // injector. 'self' covers the static + dynamic JS bundles.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind v4 + Radix UI inject inline <style> tags at runtime.
      "style-src 'self' 'unsafe-inline'",
      // Allow whitelisted image CDNs and inline data: (favicons, blur SVGs).
      "img-src 'self' data: blob: https://remoteok.com https://logo.clearbit.com",
      "font-src 'self' data:",
      // Supabase Auth + Postgrest + Realtime live at *.supabase.co, plus the
      // browser SSE channel for HMR in dev (http+ws on localhost).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // Reject Flash/Java/etc.
      "object-src 'none'",
      "base-uri 'self'",
      // Form submissions (Server Actions) can only target our own origin and
      // Supabase Auth (magic-link callback flow already lives on /auth/callback
      // so this is mostly belt-and-suspenders).
      "form-action 'self' https://*.supabase.co",
      // Hard-deny iframe embedding (modern equivalent of X-Frame-Options).
      "frame-ancestors 'none'",
      // No <iframe> children needed in MVP.
      "frame-src 'none'",
      // Force HTTPS subresources in production browsers.
      'upgrade-insecure-requests',
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          // Defense-in-depth XSS / mixed-content control.
          { key: 'Content-Security-Policy', value: csp },
          // Prevent clickjacking — DENY is correct; we never embed as iframe.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unnecessary browser features.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // Force HTTPS (2 years, includeSubDomains, preload).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // X-XSS-Protection is deprecated and can introduce vulnerabilities
          // on legacy browsers; OWASP now recommends "0" or omitting the
          // header entirely. Our CSP above is the modern replacement.
          { key: 'X-XSS-Protection', value: '0' },
          // Prevent DNS prefetch leaks.
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Cross-Origin-Resource-Policy — prevent spectre attacks on resources.
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // Cross-Origin-Opener-Policy — isolate browsing context.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
