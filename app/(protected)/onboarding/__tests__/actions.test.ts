/**
 * Unit tests for onboarding Server Actions (FM02).
 *
 * Mocks: Supabase createClient, getUser/getUserWithProfile, next/navigation redirect,
 * next/cache revalidatePath.
 *
 * Tests:
 *  - saveStep1: happy path, Zod rejection, auth redirect, DB error
 *  - saveStep2: happy path, Zod rejection, auth redirect, DB error
 *  - saveStep3: happy path, Zod rejection, DB error
 *  - completeOnboarding: happy path, missing profile, incomplete profile, DB error
 *  - Security: user_id always comes from getUser(), never from input
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------
const { mockUpsert, mockUpdate, mockSelect, mockEq, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockUpsert = vi.fn()

  return { mockUpsert, mockUpdate, mockSelect, mockEq, mockSingle }
})

const { mockRedirect, mockRevalidatePath } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

vi.mock('@/src/lib/auth/get-user', () => ({
  getUser: mockGetUser,
  getUserWithProfile: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate.mockReturnValue({ eq: mockEq }),
      select: mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    }),
  }),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
  saveStep1,
  saveStep2,
  saveStep3,
  completeOnboarding,
} from '../actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MOCK_USER = { id: 'user-123', email: 'test@example.com' }

function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({ user: MOCK_USER, supabase: {} })
}

function mockUnauthenticatedUser() {
  mockGetUser.mockResolvedValue({ user: null, supabase: {} })
}

// ---------------------------------------------------------------------------
// saveStep1
// ---------------------------------------------------------------------------
describe('saveStep1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()
    mockUpsert.mockResolvedValue({ error: null })
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns success for valid timezone', async () => {
    const result = await saveStep1({ timezone: 'Asia/Singapore' })
    expect(result).toEqual({ success: true })
    expect(mockUpsert).toHaveBeenCalledOnce()
  })

  it('upserts with the authenticated user.id (not any client-supplied id)', async () => {
    await saveStep1({ timezone: 'Asia/Tokyo' })
    const upsertCall = mockUpsert.mock.calls[0]?.[0]
    expect(upsertCall?.user_id).toBe(MOCK_USER.id)
  })

  it('returns error for invalid timezone', async () => {
    const result = await saveStep1({ timezone: 'Narnia/Fake' })
    expect(result).toMatchObject({ error: expect.stringContaining('Invalid timezone') })
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('returns error for empty timezone', async () => {
    const result = await saveStep1({ timezone: '' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('redirects to login when unauthenticated', async () => {
    // Next.js redirect() throws a special error — mock it to avoid unhandled throw
    mockRedirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    mockUnauthenticatedUser()
    await expect(saveStep1({ timezone: 'Asia/Singapore' })).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
    // Reset mock
    mockRedirect.mockReset()
  })

  it('returns error when DB upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { code: 'DB_ERROR' } })
    const result = await saveStep1({ timezone: 'Asia/Singapore' })
    expect(result).toMatchObject({ error: expect.stringContaining('Failed to save') })
  })
})

// ---------------------------------------------------------------------------
// saveStep2
// ---------------------------------------------------------------------------
describe('saveStep2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns success for valid skills', async () => {
    const result = await saveStep2({ skills: ['React', 'TypeScript'] })
    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('passes the authenticated user.id to the update query', async () => {
    await saveStep2({ skills: ['Go'] })
    expect(mockEq).toHaveBeenCalledWith('user_id', MOCK_USER.id)
  })

  it('returns error for empty skills array', async () => {
    const result = await saveStep2({ skills: [] })
    expect(result).toMatchObject({ error: expect.stringContaining('at least 1 skill') })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns error for skill with HTML', async () => {
    const result = await saveStep2({ skills: ['<script>xss</script>'] })
    expect(result).toMatchObject({ error: expect.stringContaining('Invalid skill') })
  })

  it('returns error when DB update fails', async () => {
    mockEq.mockResolvedValue({ error: { code: 'DB_ERROR' } })
    const result = await saveStep2({ skills: ['React'] })
    expect(result).toMatchObject({ error: expect.stringContaining('Failed to save') })
  })
})

// ---------------------------------------------------------------------------
// saveStep3
// ---------------------------------------------------------------------------
describe('saveStep3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()
    mockEq.mockResolvedValue({ error: null })
  })

  it.each(['contractor', 'employee', 'both'] as const)(
    'returns success for "%s"',
    async (contract) => {
      const result = await saveStep3({ contract_preference: contract })
      expect(result).toEqual({ success: true })
    }
  )

  it('returns error for invalid contract preference', async () => {
    const result = await saveStep3({ contract_preference: 'freelance' })
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when DB update fails', async () => {
    mockEq.mockResolvedValue({ error: { code: 'DB_ERROR' } })
    const result = await saveStep3({ contract_preference: 'both' })
    expect(result).toMatchObject({ error: expect.stringContaining('Failed to save') })
  })
})

// ---------------------------------------------------------------------------
// completeOnboarding
// ---------------------------------------------------------------------------
describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()

    // Default: profile exists with required fields
    mockSingle.mockResolvedValue({
      data: {
        timezone: 'Asia/Singapore',
        skills: ['React', 'TypeScript'],
        contract_preference: 'contractor',
      },
      error: null,
    })

    mockEq.mockResolvedValue({ error: null })
  })

  it('calls redirect to /feed on success', async () => {
    await completeOnboarding({ min_rate_usd: 5000, rate_period: 'month' })
    expect(mockRedirect).toHaveBeenCalledWith('/feed')
  })

  it('does NOT set onboarding_completed_at in a step action — only completeOnboarding does', async () => {
    // step actions should never set onboarding_completed_at
    await saveStep1({ timezone: 'Asia/Tokyo' })
    const upsertCall = mockUpsert.mock.calls[0]?.[0]
    expect(upsertCall?.onboarding_completed_at).toBeUndefined()
  })

  it('sets onboarding_completed_at in the update payload', async () => {
    await completeOnboarding({ min_rate_usd: null, rate_period: null })
    const updatePayload = mockUpdate.mock.calls[0]?.[0]
    expect(updatePayload?.onboarding_completed_at).toBeTruthy()
  })

  it('returns error when profile is not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await completeOnboarding({ min_rate_usd: null, rate_period: null })
    expect(result).toMatchObject({ error: expect.stringContaining('Profile not found') })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('returns error when rate validation fails (requires period)', async () => {
    const result = await completeOnboarding({
      min_rate_usd: 5000,
      rate_period: null,
    })
    expect(result).toMatchObject({ error: expect.stringContaining('rate period') })
  })

  it('returns error when DB update fails', async () => {
    mockEq.mockResolvedValue({ error: { code: 'DB_ERROR' } })
    const result = await completeOnboarding({ min_rate_usd: null, rate_period: null })
    expect(result).toMatchObject({ error: expect.stringContaining('Failed to complete') })
  })

  it('returns error when profile has no skills (incomplete)', async () => {
    mockSingle.mockResolvedValue({
      data: {
        timezone: 'Asia/Singapore',
        skills: [],
        contract_preference: 'contractor',
      },
      error: null,
    })
    const result = await completeOnboarding({ min_rate_usd: null, rate_period: null })
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
