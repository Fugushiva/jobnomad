/**
 * Unit tests for rate-limit helpers (pure functions only).
 *
 * checkRateLimit is tested in integration tests (requires Supabase RPC).
 * Here we test hashIp and extractClientIp which are pure.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hashIp, extractClientIp } from '../rate-limit'

// ---------------------------------------------------------------------------
// hashIp
// ---------------------------------------------------------------------------

describe('hashIp', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashIp('127.0.0.1', 'test-pepper')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic', () => {
    const a = hashIp('10.0.0.1', 'pepper')
    const b = hashIp('10.0.0.1', 'pepper')
    expect(a).toBe(b)
  })

  it('different IPs produce different hashes', () => {
    const a = hashIp('10.0.0.1', 'pepper')
    const b = hashIp('10.0.0.2', 'pepper')
    expect(a).not.toBe(b)
  })

  it('different peppers produce different hashes', () => {
    const a = hashIp('10.0.0.1', 'pepper-a')
    const b = hashIp('10.0.0.1', 'pepper-b')
    expect(a).not.toBe(b)
  })

  it('uses default pepper when none provided', () => {
    // Should not throw even without explicit pepper
    const hash = hashIp('192.168.1.1')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  // -------------------------------------------------------------------------
  // Production safety: must reject default/missing peppers in NODE_ENV=production
  // (Audit fix — prevents predictable IP-hash rainbow tables.)
  // -------------------------------------------------------------------------

  describe('production guard', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('throws when RATE_LIMIT_PEPPER is unset in production', () => {
      vi.stubEnv('RATE_LIMIT_PEPPER', '')
      expect(() => hashIp('1.2.3.4')).toThrow(/RATE_LIMIT_PEPPER/)
    })

    it('throws when RATE_LIMIT_PEPPER equals the dev default', () => {
      vi.stubEnv('RATE_LIMIT_PEPPER', 'jobnomad-dev-pepper-change-me')
      expect(() => hashIp('1.2.3.4')).toThrow(/RATE_LIMIT_PEPPER/)
    })

    it('throws when RATE_LIMIT_PEPPER equals the legacy short dev default', () => {
      vi.stubEnv('RATE_LIMIT_PEPPER', 'jobnomad-dev-pepper')
      expect(() => hashIp('1.2.3.4')).toThrow(/RATE_LIMIT_PEPPER/)
    })

    it('accepts a real pepper in production', () => {
      vi.stubEnv('RATE_LIMIT_PEPPER', 'a'.repeat(64))
      const hash = hashIp('1.2.3.4')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })
})

// ---------------------------------------------------------------------------
// extractClientIp
// ---------------------------------------------------------------------------

describe('extractClientIp', () => {
  it('extracts IP from x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' })
    expect(extractClientIp(headers)).toBe('1.2.3.4')
  })

  it('takes first IP from x-forwarded-for chain', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' })
    expect(extractClientIp(headers)).toBe('1.2.3.4')
  })

  it('trims whitespace from x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' })
    expect(extractClientIp(headers)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '10.0.0.1' })
    expect(extractClientIp(headers)).toBe('10.0.0.1')
  })

  it('trims x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '  10.0.0.1  ' })
    expect(extractClientIp(headers)).toBe('10.0.0.1')
  })

  it('prefers x-forwarded-for over x-real-ip', () => {
    const headers = new Headers({
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '10.0.0.1',
    })
    expect(extractClientIp(headers)).toBe('1.2.3.4')
  })

  it('returns "unknown" when no IP headers present', () => {
    const headers = new Headers()
    expect(extractClientIp(headers)).toBe('unknown')
  })

  it('returns "unknown" when x-forwarded-for is empty', () => {
    const headers = new Headers({ 'x-forwarded-for': '' })
    expect(extractClientIp(headers)).toBe('unknown')
  })
})
