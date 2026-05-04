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
   * CSP note (phase 2): Radix UI portals inject elements into <body> and
   * Tailwind v4 requires 'unsafe-inline' for style-src. A strict nonce-based
   * CSP is planned for phase 2 after assessing server-side nonce injection.
   * Tracked in: https://github.com/Fugushiva/jobnomad/issues (phase 2 backlog)
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking — DENY is correct; we never embed as iframe
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // Force HTTPS (2 years, includeSubDomains, preload)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // XSS protection (legacy browsers) — belt-and-suspenders with CSP
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Prevent DNS prefetch leaks
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Cross-Origin-Resource-Policy — prevent spectre attacks on resources
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // Cross-Origin-Opener-Policy — isolate browsing context
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
