/**
 * Unit tests for saved-jobs Server Actions (saveJob, unsaveJob, updateSavedJobStatus).
 *
 * Uses vi.hoisted mocks for Next.js (next/headers, next/navigation) and
 * the Supabase server client — same pattern as onboarding/actions.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockFrom,
  mockUpsert,
  mockDelete,
  mockUpdate,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => {
  const mockUpsert = vi.fn()
  const mockDelete = vi.fn()
  const mockUpdate = vi.fn()
  const mockFrom = vi.fn()
  const mockGetUser = vi.fn()
  const mockRedirect = vi.fn()
  const mockRevalidatePath = vi.fn()
  return {
    mockGetUser,
    mockFrom,
    mockUpsert,
    mockDelete,
    mockUpdate,
    mockRedirect,
    mockRevalidatePath,
  }
})

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}))

vi.mock('@/src/lib/auth/get-user', () => ({
  getUser: mockGetUser,
}))

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}))

// ---------------------------------------------------------------------------
// Import actions AFTER mocks are set up
// ---------------------------------------------------------------------------

import { saveJob, unsaveJob, updateSavedJobStatus } from '../actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-uuid-123' }
const FAKE_JOB_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function setupAuthOk() {
  mockGetUser.mockResolvedValue({ user: FAKE_USER })
}

function setupDeleteChain(error: null | { code: string; message: string }) {
  const chainEq2 = vi.fn().mockResolvedValue({ error })
  const chainEq1 = vi.fn().mockReturnValue({ eq: chainEq2 })
  mockDelete.mockReturnValue({ eq: chainEq1 })
  mockFrom.mockReturnValue({ delete: mockDelete })
}

function setupUpdateChain(error: null | { code: string; message: string }) {
  const chainEq2 = vi.fn().mockResolvedValue({ error })
  const chainEq1 = vi.fn().mockReturnValue({ eq: chainEq2 })
  mockUpdate.mockReturnValue({ eq: chainEq1 })
  mockFrom.mockReturnValue({ update: mockUpdate })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('saveJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ user: null })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })
    await expect(saveJob(FAKE_JOB_ID)).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })

  it('returns error for invalid UUID', async () => {
    setupAuthOk()
    const result = await saveJob('not-a-uuid')
    expect(result).toMatchObject({ error: expect.stringContaining('Invalid') })
  })

  it('returns error for non-string input', async () => {
    setupAuthOk()
    const result = await saveJob(12345)
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns success on valid job id with upsert ok', async () => {
    setupAuthOk()
    mockUpsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    const result = await saveJob(FAKE_JOB_ID)
    expect(result).toEqual({ success: true })
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: FAKE_USER.id, job_id: FAKE_JOB_ID, status: 'saved' }),
      expect.objectContaining({ onConflict: 'user_id,job_id', ignoreDuplicates: true }),
    )
  })

  it('returns error when DB upsert fails', async () => {
    setupAuthOk()
    mockUpsert.mockResolvedValue({ error: { code: '23505', message: 'dup' } })
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    const result = await saveJob(FAKE_JOB_ID)
    expect(result).toMatchObject({ error: expect.stringContaining('Failed to save') })
  })

  it('revalidates /feed and /saved on success', async () => {
    setupAuthOk()
    mockUpsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    await saveJob(FAKE_JOB_ID)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/feed')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/saved')
  })
})

// ---------------------------------------------------------------------------

describe('unsaveJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ user: null })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })
    await expect(unsaveJob(FAKE_JOB_ID)).rejects.toThrow('REDIRECT')
  })

  it('returns error for invalid UUID', async () => {
    setupAuthOk()
    const result = await unsaveJob('bad-id')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns success on valid delete', async () => {
    setupAuthOk()
    setupDeleteChain(null)
    const result = await unsaveJob(FAKE_JOB_ID)
    expect(result).toEqual({ success: true })
  })

  it('returns error when DB delete fails', async () => {
    setupAuthOk()
    setupDeleteChain({ code: '23503', message: 'fk' })
    const result = await unsaveJob(FAKE_JOB_ID)
    expect(result).toMatchObject({ error: expect.stringContaining('remove') })
  })

  it('revalidates /feed and /saved on success', async () => {
    setupAuthOk()
    setupDeleteChain(null)
    await unsaveJob(FAKE_JOB_ID)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/feed')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/saved')
  })
})

// ---------------------------------------------------------------------------

describe('updateSavedJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ user: null })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })
    await expect(updateSavedJobStatus(FAKE_JOB_ID, 'applied')).rejects.toThrow('REDIRECT')
  })

  it('returns error for invalid UUID', async () => {
    setupAuthOk()
    const result = await updateSavedJobStatus('bad-uuid', 'applied')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error for invalid status', async () => {
    setupAuthOk()
    const result = await updateSavedJobStatus(FAKE_JOB_ID, 'unknown_status')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('accepts all valid statuses', async () => {
    setupAuthOk()
    setupUpdateChain(null)
    for (const status of ['saved', 'applied', 'rejected', 'interviewing', 'offered']) {
      vi.clearAllMocks()
      setupAuthOk()
      setupUpdateChain(null)
      const result = await updateSavedJobStatus(FAKE_JOB_ID, status)
      expect(result).toEqual({ success: true })
    }
  })

  it('returns error when DB update fails', async () => {
    setupAuthOk()
    setupUpdateChain({ code: '42000', message: 'err' })
    const result = await updateSavedJobStatus(FAKE_JOB_ID, 'applied')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('revalidates /saved on success', async () => {
    setupAuthOk()
    setupUpdateChain(null)
    await updateSavedJobStatus(FAKE_JOB_ID, 'applied')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/saved')
  })
})
