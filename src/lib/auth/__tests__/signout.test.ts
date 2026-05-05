/**
 * Unit tests for signOut server action.
 *
 * Strategy:
 *  - Mock the Supabase server client and Next.js navigation.
 *  - redirect() is mocked to throw a special sentinel so we can assert it
 *    was called with the right URL without crashing the test.
 *  - Every test verifies the security contract: errors are absorbed, the
 *    redirect always fires, nothing leaks to the caller.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Sentinel used to detect redirect() calls
// ---------------------------------------------------------------------------

class RedirectSentinel extends Error {
  constructor(public readonly destination: string) {
    super(`REDIRECT:${destination}`)
    this.name = 'RedirectSentinel'
  }
}

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock Next.js navigation — redirect() throws our sentinel
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSentinel(url)
  }),
}))

// ---------------------------------------------------------------------------
// Mock Supabase server client
// ---------------------------------------------------------------------------

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signOut: mockSignOut },
  }),
}))

// ---------------------------------------------------------------------------
// Mock next/headers (pulled in transitively by server.ts)
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Helper — call signOut and capture the redirect sentinel
// ---------------------------------------------------------------------------

async function callSignOut(): Promise<RedirectSentinel> {
  const { signOut } = await import('../actions')
  try {
    await signOut()
    throw new Error('signOut should always redirect — it should never return')
  } catch (err) {
    if (err instanceof RedirectSentinel) return err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('signOut server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ data: {}, error: null })
  })

  afterEach(() => {
    vi.resetModules()
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('calls supabase.auth.signOut with scope "local"', async () => {
    await callSignOut()
    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('redirects to /?signed_out=1 on success', async () => {
    const sentinel = await callSignOut()
    expect(sentinel.destination).toBe('/?signed_out=1')
  })

  it('always redirects — never returns normally', async () => {
    // Verify the return type contract: the function is typed Promise<never>
    // and must always redirect. Our helper already asserts this by checking
    // that callSignOut() throws a RedirectSentinel.
    const sentinel = await callSignOut()
    expect(sentinel).toBeInstanceOf(RedirectSentinel)
  })

  // -------------------------------------------------------------------------
  // Error resilience — the user is ALWAYS logged out, even on API failure
  // -------------------------------------------------------------------------

  it('redirects even when Supabase returns an error', async () => {
    mockSignOut.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', status: 401 },
    })
    const sentinel = await callSignOut()
    expect(sentinel.destination).toBe('/?signed_out=1')
  })

  it('redirects even when Supabase throws unexpectedly', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'))
    const sentinel = await callSignOut()
    expect(sentinel.destination).toBe('/?signed_out=1')
  })

  it('redirects even when createClient() throws', async () => {
    const { createClient } = await import('@/src/lib/supabase/server')
    vi.mocked(createClient).mockRejectedValueOnce(new Error('Cookie store unavailable'))

    const sentinel = await callSignOut()
    expect(sentinel.destination).toBe('/?signed_out=1')
  })

  // -------------------------------------------------------------------------
  // Security — errors must never reach the client
  // -------------------------------------------------------------------------

  it('logs Supabase error server-side but does not throw it to the caller', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSignOut.mockResolvedValue({
      data: null,
      error: { message: 'Internal Supabase error with PII', status: 500 },
    })

    const sentinel = await callSignOut()

    // Redirect still fires
    expect(sentinel.destination).toBe('/?signed_out=1')

    // Error was logged server-side
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[auth/signOut]'),
      expect.any(String),
    )

    consoleSpy.mockRestore()
  })

  it('logs unexpected errors server-side but does not throw them to the caller', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSignOut.mockRejectedValue(new Error('Sensitive stack trace'))

    await callSignOut()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[auth/signOut]'),
      expect.any(String),
    )

    // The raw error message must NEVER propagate beyond the console.error call.
    // The sentinel proves redirect fired — caller never saw the error.
    consoleSpy.mockRestore()
  })

  it('uses scope "local" — does not sign out all sessions globally', async () => {
    await callSignOut()
    const call = mockSignOut.mock.calls[0][0]
    expect(call.scope).toBe('local')
    expect(call.scope).not.toBe('global')
    expect(call.scope).not.toBe('others')
  })
})
