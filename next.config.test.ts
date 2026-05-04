/**
 * next.config.ts — guard tests
 *
 * These tests protect critical configuration from being accidentally removed:
 * - images.remotePatterns (required for job board images in Next.js 16)
 * - Security response headers (OWASP Secure Headers Project)
 *
 * If you need to update the config, update these tests too.
 */
import { describe, it, expect } from 'vitest'
import nextConfig from './next.config'

// ---------------------------------------------------------------------------
// images.remotePatterns
// ---------------------------------------------------------------------------

describe('next.config — images.remotePatterns', () => {
  const patterns = nextConfig.images?.remotePatterns as Array<{
    protocol: string
    hostname: string
  }>

  it('should have remotePatterns configured', () => {
    expect(patterns).toBeDefined()
    expect(Array.isArray(patterns)).toBe(true)
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('should allow remoteok.com (job board CDN)', () => {
    const match = patterns.find(
      (p) => p.hostname === 'remoteok.com' && p.protocol === 'https',
    )
    expect(match).toBeDefined()
  })

  it('should allow logo.clearbit.com (company logos)', () => {
    const match = patterns.find(
      (p) => p.hostname === 'logo.clearbit.com' && p.protocol === 'https',
    )
    expect(match).toBeDefined()
  })

  it('should only allow https (no http)', () => {
    const httpPatterns = patterns.filter((p) => p.protocol === 'http')
    expect(httpPatterns).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

describe('next.config — security headers', () => {
  it('should have a headers() function configured', () => {
    expect(typeof nextConfig.headers).toBe('function')
  })

  it('should apply headers to all routes (/:path*)', async () => {
    const headersList = await (nextConfig.headers as () => Promise<unknown[]>)()
    expect(Array.isArray(headersList)).toBe(true)
    expect(headersList.length).toBeGreaterThan(0)

    const allRoutes = (headersList as Array<{ source: string; headers: unknown[] }>).find(
      (h) => h.source === '/:path*',
    )
    expect(allRoutes).toBeDefined()
  })

  it('should include X-Frame-Options: DENY (clickjacking protection)', async () => {
    const headersList = await (nextConfig.headers as () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>)()
    const allRoutes = headersList.find((h) => h.source === '/:path*')
    const header = allRoutes?.headers.find((h) => h.key === 'X-Frame-Options')
    expect(header?.value).toBe('DENY')
  })

  it('should include X-Content-Type-Options: nosniff', async () => {
    const headersList = await (nextConfig.headers as () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>)()
    const allRoutes = headersList.find((h) => h.source === '/:path*')
    const header = allRoutes?.headers.find((h) => h.key === 'X-Content-Type-Options')
    expect(header?.value).toBe('nosniff')
  })

  it('should include Strict-Transport-Security header', async () => {
    const headersList = await (nextConfig.headers as () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>)()
    const allRoutes = headersList.find((h) => h.source === '/:path*')
    const header = allRoutes?.headers.find((h) => h.key === 'Strict-Transport-Security')
    expect(header?.value).toMatch(/max-age=\d+/)
    expect(header?.value).toContain('includeSubDomains')
  })
})
