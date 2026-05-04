/**
 * Integration tests for checkRateLimit (mocking the Supabase RPC call).
 *
 * Tests the full checkRateLimit function including:
 * - Normal allow/deny based on RPC response
 * - Fail-open behavior on RPC errors
 * - Fail-open on unexpected exceptions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}))

vi.mock('@/src/lib/supabase/service', () => ({
  createServiceClient: vi.fn().mockReturnValue({ rpc: mockRpc }),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { checkRateLimit } from '../rate-limit'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns allowed:true when RPC returns true', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const result = await checkRateLimit('1.2.3.4')
    expect(result).toEqual({ allowed: true, reason: 'within_limit' })
  })

  it('returns allowed:false when RPC returns false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await checkRateLimit('1.2.3.4')
    expect(result).toEqual({ allowed: false, reason: 'rate_limited' })
  })

  it('passes correct parameters to RPC', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await checkRateLimit('1.2.3.4', 10, 30)
    expect(mockRpc).toHaveBeenCalledWith('check_auth_rate_limit', {
      p_ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_max_attempts: 10,
      p_window_minutes: 30,
    })
  })

  it('uses default parameters (5 attempts, 60 minutes)', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await checkRateLimit('1.2.3.4')
    expect(mockRpc).toHaveBeenCalledWith('check_auth_rate_limit', {
      p_ip_hash: expect.any(String),
      p_max_attempts: 5,
      p_window_minutes: 60,
    })
  })

  it('fails OPEN on RPC error (allows request)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'database connection lost' },
    })
    const result = await checkRateLimit('1.2.3.4')
    expect(result).toEqual({ allowed: true, reason: 'rpc_error_fail_open' })
  })

  it('fails OPEN on unexpected exception', async () => {
    mockRpc.mockRejectedValue(new Error('Network timeout'))
    const result = await checkRateLimit('1.2.3.4')
    expect(result).toEqual({ allowed: true, reason: 'unexpected_error_fail_open' })
  })

  it('hashes IP before sending to RPC (not plain IP)', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await checkRateLimit('192.168.1.1')
    const callArgs = mockRpc.mock.calls[0]?.[1]
    expect(callArgs.p_ip_hash).not.toBe('192.168.1.1')
    expect(callArgs.p_ip_hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
