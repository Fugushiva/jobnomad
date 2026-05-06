/**
 * Tests for POST /api/jobs/[id]/track-apply route handler.
 *
 * Mocks Supabase user-context client and getUser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

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
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { POST } = await import('../route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-uuid-abc' }
const VALID_JOB_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/jobs/' + VALID_JOB_ID + '/track-apply', {
    method: 'POST',
  })
}

async function makeParams(id: string) {
  return Promise.resolve({ id })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/jobs/[id]/track-apply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ user: null })
    const res = await POST(makeRequest(), { params: makeParams(VALID_JOB_ID) })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 400 for invalid UUID', async () => {
    mockGetUser.mockResolvedValue({ user: FAKE_USER })
    const res = await POST(makeRequest(), { params: makeParams('not-a-uuid') })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'Invalid job id.' })
  })

  it('returns 204 on success', async () => {
    mockGetUser.mockResolvedValue({ user: FAKE_USER })
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    const res = await POST(makeRequest(), { params: makeParams(VALID_JOB_ID) })
    expect(res.status).toBe(204)
  })

  it('inserts correct record in job_views', async () => {
    mockGetUser.mockResolvedValue({ user: FAKE_USER })
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    await POST(makeRequest(), { params: makeParams(VALID_JOB_ID) })
    expect(mockFrom).toHaveBeenCalledWith('job_views')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: FAKE_USER.id,
      job_id: VALID_JOB_ID,
      action: 'click_apply',
    })
  })

  it('returns 500 on DB error', async () => {
    mockGetUser.mockResolvedValue({ user: FAKE_USER })
    mockInsert.mockResolvedValue({ error: { code: '23503', message: 'fk violation' } })
    mockFrom.mockReturnValue({ insert: mockInsert })
    const res = await POST(makeRequest(), { params: makeParams(VALID_JOB_ID) })
    expect(res.status).toBe(500)
  })
})
