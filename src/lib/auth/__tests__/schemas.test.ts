/**
 * Unit tests for auth schemas (email validation, return-to safety).
 *
 * These are pure functions with no I/O — fast, deterministic.
 */
import { describe, it, expect } from 'vitest'
import { loginFormSchema, isValidReturnTo, safeReturnTo } from '../schemas'

// ---------------------------------------------------------------------------
// Email schema (via loginFormSchema)
// ---------------------------------------------------------------------------

describe('loginFormSchema', () => {
  it('accepts a valid email', () => {
    const result = loginFormSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  it('trims whitespace', () => {
    const result = loginFormSchema.safeParse({ email: '  User@Example.COM  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  it('lowercases the email', () => {
    const result = loginFormSchema.safeParse({ email: 'Alice@GMAIL.com' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('alice@gmail.com')
    }
  })

  it('rejects empty string', () => {
    const result = loginFormSchema.safeParse({ email: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing @', () => {
    const result = loginFormSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects email longer than 254 chars', () => {
    const long = 'a'.repeat(245) + '@test.com' // 254 total
    const tooLong = 'a'.repeat(246) + '@test.com' // 255 total
    expect(loginFormSchema.safeParse({ email: long }).success).toBe(true)
    expect(loginFormSchema.safeParse({ email: tooLong }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isValidReturnTo (open-redirect protection)
// ---------------------------------------------------------------------------

describe('isValidReturnTo', () => {
  // Valid paths
  it.each([
    '/',
    '/feed',
    '/onboarding',
    '/jobs/123',
    '/feed?page=2',
    '/feed#section',
  ])('accepts valid path: %s', (path) => {
    expect(isValidReturnTo(path)).toBe(true)
  })

  // Protocol-relative (open redirect)
  it.each([
    '//evil.com',
    '//evil.com/path',
  ])('blocks protocol-relative: %s', (path) => {
    expect(isValidReturnTo(path)).toBe(false)
  })

  // Backslash tricks
  it.each([
    '/\\evil.com',
    '/\\\\evil.com',
  ])('blocks backslash trick: %s', (path) => {
    expect(isValidReturnTo(path)).toBe(false)
  })

  // Dangerous schemes
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'blob:https://evil.com',
    'file:///etc/passwd',
  ])('blocks dangerous scheme: %s', (path) => {
    expect(isValidReturnTo(path)).toBe(false)
  })

  // Schemes embedded in path
  it.each([
    '/redirect?url=javascript:alert(1)',
    '/foo/data:text/html',
  ])('blocks scheme embedded in path: %s', (path) => {
    expect(isValidReturnTo(path)).toBe(false)
  })

  // URL-encoded bypass attempts
  it.each([
    '/%2f/evil.com',
    '/%2F/evil.com',
    '/%5c/evil.com',
    '/%5C/evil.com',
  ])('blocks encoded bypass: %s', (path) => {
    expect(isValidReturnTo(path)).toBe(false)
  })

  // Null byte injection
  it('blocks null bytes', () => {
    expect(isValidReturnTo('/feed%00.html')).toBe(false)
    expect(isValidReturnTo('/feed\0.html')).toBe(false)
  })

  // Edge cases
  it('blocks absolute URLs', () => {
    expect(isValidReturnTo('https://evil.com')).toBe(false)
  })

  it('blocks empty string', () => {
    expect(isValidReturnTo('')).toBe(false)
  })

  it('blocks very long URLs (>2048)', () => {
    const long = '/' + 'a'.repeat(2048)
    expect(isValidReturnTo(long)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// safeReturnTo (convenience wrapper)
// ---------------------------------------------------------------------------

describe('safeReturnTo', () => {
  it('returns the path when valid', () => {
    expect(safeReturnTo('/onboarding')).toBe('/onboarding')
  })

  it('returns fallback when null', () => {
    expect(safeReturnTo(null)).toBe('/feed')
  })

  it('returns fallback when undefined', () => {
    expect(safeReturnTo(undefined)).toBe('/feed')
  })

  it('returns fallback when invalid', () => {
    expect(safeReturnTo('//evil.com')).toBe('/feed')
  })

  it('supports custom fallback', () => {
    expect(safeReturnTo(null, '/dashboard')).toBe('/dashboard')
  })

  it('trims whitespace before validation', () => {
    expect(safeReturnTo('  /feed  ')).toBe('/feed')
  })
})
