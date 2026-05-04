/**
 * Integration tests for sendMagicLink server action.
 *
 * Mocks Supabase client and Next.js server imports (headers, cookies).
 * Tests the full action flow: validation -> rate-limit -> OTP call -> response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories are hoisted above imports)
// ---------------------------------------------------------------------------

const { mockSignInWithOtp, mockCheckRateLimit } = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock Next.js server modules
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' })),
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Mock Supabase server client
// ---------------------------------------------------------------------------

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signInWithOtp: mockSignInWithOtp },
  }),
}))

// ---------------------------------------------------------------------------
// Mock rate-limit
// ---------------------------------------------------------------------------

vi.mock('@/src/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  extractClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}))

// ---------------------------------------------------------------------------
// Mock env module
// ---------------------------------------------------------------------------

vi.mock('@/src/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}))

// ---------------------------------------------------------------------------
// Import the action under test (after mocks are set up)
// ---------------------------------------------------------------------------

import { sendMagicLink } from '../../../../app/auth/login/actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(email: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  return fd
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, reason: 'within_limit' })
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
  })

  it('returns success for a valid email', async () => {
    const result = await sendMagicLink(null, makeFormData('user@example.com'))
    expect(result).toEqual({ success: true })
  })

  it('calls signInWithOtp with correct parameters', async () => {
    await sendMagicLink(null, makeFormData('Test@Example.COM'))
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
        shouldCreateUser: true,
      },
    })
  })

  it('returns validation error for invalid email', async () => {
    const result = await sendMagicLink(null, makeFormData('not-an-email'))
    expect(result).toEqual({
      success: false,
      error: 'validation',
      message: expect.any(String),
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('returns validation error for empty email', async () => {
    const result = await sendMagicLink(null, makeFormData(''))
    expect(result).toEqual({
      success: false,
      error: 'validation',
      message: expect.any(String),
    })
  })

  it('returns rate_limited when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, reason: 'rate_limited' })
    const result = await sendMagicLink(null, makeFormData('user@example.com'))
    expect(result).toEqual({
      success: false,
      error: 'rate_limited',
      message: 'Too many attempts. Please try again in an hour.',
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('returns success even when Supabase returns an error (email enumeration prevention)', async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: null,
      error: { message: 'User not found', status: 400 },
    })
    const result = await sendMagicLink(null, makeFormData('nonexistent@example.com'))
    expect(result).toEqual({ success: true })
  })

  it('returns success even when Supabase throws (email enumeration prevention)', async () => {
    mockSignInWithOtp.mockRejectedValue(new Error('Network error'))
    const result = await sendMagicLink(null, makeFormData('user@example.com'))
    expect(result).toEqual({ success: true })
  })

  it('normalizes email before sending to Supabase', async () => {
    await sendMagicLink(null, makeFormData('  Alice@GMAIL.COM  '))
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@gmail.com' }),
    )
  })
})
