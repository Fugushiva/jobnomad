/**
 * Integration tests for /auth/callback route handler.
 *
 * Mocks Supabase exchangeCodeForSession to verify:
 * - Successful code exchange -> redirect to /feed (or ?next=)
 * - Missing code -> redirect to /auth/error?reason=missing_code
 * - Expired code -> redirect to /auth/error?reason=link_expired
 * - Other errors -> redirect to /auth/error?reason=exchange_failed
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockExchangeCodeForSession } = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}))

// ---------------------------------------------------------------------------
// Import the handler (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '../../../../app/auth/callback/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(searchParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/auth/callback')
  for (const [key, val] of Object.entries(searchParams)) {
    url.searchParams.set(key, val)
  }
  return new NextRequest(url)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /feed on successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    const response = await GET(makeRequest({ code: 'valid-code' }))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/feed')
  })

  it('redirects to ?next= path on success when provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    const response = await GET(makeRequest({ code: 'valid-code', next: '/onboarding' }))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/onboarding')
  })

  it('ignores invalid next param (open-redirect protection)', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    const response = await GET(makeRequest({ code: 'valid-code', next: '//evil.com' }))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/feed')
  })

  it('redirects to /auth/error?reason=missing_code when no code', async () => {
    const response = await GET(makeRequest({}))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/auth/error')
    expect(location.searchParams.get('reason')).toBe('missing_code')
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects to /auth/error?reason=link_expired for expired code', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Auth code has expired' },
    })
    const response = await GET(makeRequest({ code: 'expired-code' }))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/auth/error')
    expect(location.searchParams.get('reason')).toBe('link_expired')
  })

  it('redirects to /auth/error?reason=exchange_failed for other errors', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid code' },
    })
    const response = await GET(makeRequest({ code: 'bad-code' }))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/auth/error')
    expect(location.searchParams.get('reason')).toBe('exchange_failed')
  })

  it('calls exchangeCodeForSession with the provided code', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    await GET(makeRequest({ code: 'test-code-123' }))
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code-123')
  })
})
