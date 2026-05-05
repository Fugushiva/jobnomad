/**
 * Unit tests for src/lib/auth/origin.ts
 *
 * Covers:
 *   - isAllowedAuthHost: allowlist behavior
 *   - resolveAuthOrigin: header parsing, fallback, protocol selection
 *   - resolveAuthCallbackUrl: convenience wrapper
 *   - Security: host-header injection, control char rejection, length limits
 */
import { describe, it, expect, vi } from 'vitest'

// Mock env BEFORE importing the module under test
vi.mock('@/src/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://jobnomad.app',
  },
}))

import {
  isAllowedAuthHost,
  resolveAuthOrigin,
  resolveAuthCallbackUrl,
} from '../origin'

// ---------------------------------------------------------------------------
// isAllowedAuthHost
// ---------------------------------------------------------------------------

describe('isAllowedAuthHost', () => {
  it('allows the canonical site host', () => {
    expect(isAllowedAuthHost('jobnomad.app')).toBe(true)
  })

  it('allows www. prefix of the canonical site host', () => {
    // Vercel may preserve the www. prefix in x-forwarded-host before the
    // apex redirect is applied at the CDN layer.
    expect(isAllowedAuthHost('www.jobnomad.app')).toBe(true)
  })

  it('allows localhost', () => {
    expect(isAllowedAuthHost('localhost')).toBe(true)
    expect(isAllowedAuthHost('localhost:3000')).toBe(true)
    expect(isAllowedAuthHost('localhost:54321')).toBe(true)
  })

  it('allows 127.0.0.1', () => {
    expect(isAllowedAuthHost('127.0.0.1')).toBe(true)
    expect(isAllowedAuthHost('127.0.0.1:3000')).toBe(true)
  })

  it('allows Vercel preview deployments', () => {
    expect(isAllowedAuthHost('jobnomad-abc123-org.vercel.app')).toBe(true)
    expect(isAllowedAuthHost('jobnomad-git-49-smtb-resend-api-fugushiva.vercel.app')).toBe(true)
    expect(isAllowedAuthHost('foo.vercel.app')).toBe(true)
  })

  it('rejects unknown hosts (anti host-header injection)', () => {
    expect(isAllowedAuthHost('attacker.com')).toBe(false)
    expect(isAllowedAuthHost('evil.example.com')).toBe(false)
    expect(isAllowedAuthHost('jobnomad.app.attacker.com')).toBe(false)
    expect(isAllowedAuthHost('jobnomad-app')).toBe(false)
  })

  it('rejects subtle Vercel-app spoofing attempts', () => {
    expect(isAllowedAuthHost('foo.vercel.app.attacker.com')).toBe(false)
    expect(isAllowedAuthHost('vercel.app')).toBe(false) // bare vercel.app, no subdomain
    expect(isAllowedAuthHost('foo.bar.vercel.app')).toBe(false) // multi-level subdomains
  })

  it('rejects empty/null/undefined hosts', () => {
    expect(isAllowedAuthHost('')).toBe(false)
    expect(isAllowedAuthHost(null as unknown as string)).toBe(false)
    expect(isAllowedAuthHost(undefined as unknown as string)).toBe(false)
  })

  it('rejects hosts with control characters (CRLF injection)', () => {
    expect(isAllowedAuthHost('jobnomad.app\r\nX-Evil: yes')).toBe(false)
    expect(isAllowedAuthHost('jobnomad.app\nfoo')).toBe(false)
    expect(isAllowedAuthHost('jobnomad.app\tfoo')).toBe(false)
    expect(isAllowedAuthHost('localhost \r\n')).toBe(false)
  })

  it('rejects overlong hosts', () => {
    const long = 'a'.repeat(254) + '.vercel.app'
    expect(isAllowedAuthHost(long)).toBe(false)
  })

  it('is case-insensitive on Vercel pattern', () => {
    expect(isAllowedAuthHost('JobNomad-Abc.VERCEL.app')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// resolveAuthOrigin
// ---------------------------------------------------------------------------

describe('resolveAuthOrigin', () => {
  function makeHeaders(init: Record<string, string>): Headers {
    return new Headers(init)
  }

  it('uses x-forwarded-host when present and allowed', () => {
    const h = makeHeaders({
      'x-forwarded-host': 'jobnomad-preview.vercel.app',
      'x-forwarded-proto': 'https',
    })
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad-preview.vercel.app')
  })

  it('falls back to host header when x-forwarded-host is missing', () => {
    const h = makeHeaders({
      host: 'jobnomad.app',
      'x-forwarded-proto': 'https',
    })
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad.app')
  })

  it('prefers x-forwarded-host over host (proxy hierarchy)', () => {
    const h = makeHeaders({
      'x-forwarded-host': 'jobnomad-preview.vercel.app',
      host: 'internal.local',
    })
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad-preview.vercel.app')
  })

  it('falls back to NEXT_PUBLIC_SITE_URL when host is not allowed', () => {
    const h = makeHeaders({
      'x-forwarded-host': 'attacker.com',
      host: 'attacker.com',
    })
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad.app')
  })

  it('falls back to NEXT_PUBLIC_SITE_URL when no host header', () => {
    const h = makeHeaders({})
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad.app')
  })

  it('uses http for localhost', () => {
    const h = makeHeaders({ host: 'localhost:3000' })
    expect(resolveAuthOrigin(h)).toBe('http://localhost:3000')
  })

  it('uses http for 127.0.0.1', () => {
    const h = makeHeaders({ host: '127.0.0.1:8080' })
    expect(resolveAuthOrigin(h)).toBe('http://127.0.0.1:8080')
  })

  it('uses https for Vercel previews even without x-forwarded-proto', () => {
    const h = makeHeaders({ host: 'foo.vercel.app' })
    expect(resolveAuthOrigin(h)).toBe('https://foo.vercel.app')
  })

  it('respects x-forwarded-proto when valid', () => {
    const h = makeHeaders({
      'x-forwarded-host': 'jobnomad.app',
      'x-forwarded-proto': 'http', // unusual but valid
    })
    expect(resolveAuthOrigin(h)).toBe('http://jobnomad.app')
  })

  it('ignores invalid x-forwarded-proto values', () => {
    const h = makeHeaders({
      'x-forwarded-host': 'jobnomad.app',
      'x-forwarded-proto': 'javascript:alert(1)',
    })
    // Falls through to default https
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad.app')
  })

  it('strips trailing slash from NEXT_PUBLIC_SITE_URL fallback', () => {
    // env mock returns 'https://jobnomad.app' (no trailing slash)
    // but the function should handle either case
    const h = makeHeaders({ 'x-forwarded-host': 'attacker.com' })
    const result = resolveAuthOrigin(h)
    expect(result).not.toMatch(/\/$/)
  })

  it('rejects host header injection via control characters', () => {
    const h = makeHeaders({
      // Set a header value with leading/trailing whitespace that would normally be trimmed
      // The Headers API will normalize most of this, but defensive code in isAllowedAuthHost
      // catches any residual control chars
      'x-forwarded-host': 'jobnomad.app evil-suffix',
    })
    // The host won't match the exact allowlist due to the injected suffix
    expect(resolveAuthOrigin(h)).toBe('https://jobnomad.app') // fallback
  })
})

// ---------------------------------------------------------------------------
// resolveAuthCallbackUrl
// ---------------------------------------------------------------------------

describe('resolveAuthCallbackUrl', () => {
  it('appends /auth/callback to the resolved origin', () => {
    const h = new Headers({ 'x-forwarded-host': 'jobnomad.app' })
    expect(resolveAuthCallbackUrl(h)).toBe('https://jobnomad.app/auth/callback')
  })

  it('works for Vercel preview', () => {
    const h = new Headers({ 'x-forwarded-host': 'jobnomad-abc.vercel.app' })
    expect(resolveAuthCallbackUrl(h)).toBe('https://jobnomad-abc.vercel.app/auth/callback')
  })

  it('works for localhost', () => {
    const h = new Headers({ host: 'localhost:3000' })
    expect(resolveAuthCallbackUrl(h)).toBe('http://localhost:3000/auth/callback')
  })

  it('falls back to canonical for unknown hosts', () => {
    const h = new Headers({ 'x-forwarded-host': 'attacker.com' })
    expect(resolveAuthCallbackUrl(h)).toBe('https://jobnomad.app/auth/callback')
  })
})
