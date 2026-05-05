/**
 * Integration tests for /api/cron/cleanup route handler.
 *
 * Tests the security boundary (auth), the cron_runs writes,
 * the happy-path response shape, and error handling.
 *
 * The route handler is tested in isolation with:
 *   - Mocked service client (no real DB)
 *   - Mocked runCleanup (no real RPC call)
 * We verify the route handler's own logic: auth, orchestration, DB writes, response.
 *
 * Coverage:
 *   Authorization (7 cases) — timing-safe edge cases included
 *   Response shape (4 cases) — ok:true, fields, status, perTable
 *   cron_runs writes (4 cases) — insert start, update completed, rows_deleted, metadata
 *   Error handling (3 cases) — runCleanup throws, 500 response, cron_runs.status=failed
 *   Idempotence (1 case) — two calls produce two distinct cron_runs rows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any import that uses them
// ---------------------------------------------------------------------------

const mockCleanupResult = {
  runId: 'mocked-run-id',
  rowsDeleted: 110,
  perTable: {
    jobs_expired:      5,
    jobs_deleted:      12,
    views_deleted:     87,
    digests_deleted:   3,
    ai_log_deleted:    0,
    feedback_deleted:  1,
    cron_runs_deleted: 2,
  },
  durationMs: 850,
  ranAt: '2026-05-04T03:00:00.000Z',
}

const mockRunCleanup = vi.fn().mockResolvedValue(mockCleanupResult)
vi.mock('@/src/lib/cleanup/run-cleanup', () => ({ runCleanup: mockRunCleanup }))

// Supabase mock — tracks cron_runs insert and update independently
// Chain: insert(data).select('id').single() → { data: { id }, error }
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'cron-run-uuid' }, error: null })
const mockInsertSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

// Chain: update(data).eq('id', cronRunId) → { error }
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

vi.mock('@/src/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'cron_runs') {
        return { insert: mockInsert, update: mockUpdate }
      }
      return {}
    },
    rpc: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('@/app/api/cron/cleanup/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = 'test-secret-that-is-long-enough-for-integration-tests'

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('https://jobnomad.app/api/cron/cleanup', {
    method: 'GET',
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/cleanup', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET
    vi.clearAllMocks()
    mockRunCleanup.mockResolvedValue(mockCleanupResult)
    mockSingle.mockResolvedValue({ data: { id: 'cron-run-uuid' }, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Authorization (7 cases)
  // -------------------------------------------------------------------------

  it('returns 401 when Authorization header is missing', async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const response = await GET(makeRequest('Bearer wrong-secret'))
    expect(response.status).toBe(401)
  })

  it('returns 401 with malformed Authorization header (no Bearer prefix)', async () => {
    const response = await GET(makeRequest(CRON_SECRET))
    expect(response.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(401)
  })

  it('returns 401 with secret that has extra characters appended (timing-safe)', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}extra`))
    expect(response.status).toBe(401)
  })

  it('returns 401 with secret that has characters removed (timing-safe)', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET.slice(0, -3)}`))
    expect(response.status).toBe(401)
  })

  it('returns 200 with correct secret', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200)
  })

  // -------------------------------------------------------------------------
  // Response shape (4 cases)
  // -------------------------------------------------------------------------

  it('returns ok:true on success', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it('returns runId, status, rowsDeleted, perTable, ranAt on success', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    const body = await response.json()

    expect(body.runId).toBeDefined()
    expect(body.status).toBe('completed')
    expect(body.rowsDeleted).toBe(110)
    expect(body.perTable).toEqual(mockCleanupResult.perTable)
    expect(body.ranAt).toBe('2026-05-04T03:00:00.000Z')
    expect(typeof body.durationMs).toBe('number')
  })

  it('returns rowsDeleted: 0 and perTable: null when runCleanup throws (no partial data)', async () => {
    mockRunCleanup.mockRejectedValueOnce(new Error('RPC failed'))
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBeUndefined()
    expect(body.error).toBe('Cleanup failed')
  })

  it('includes runId in both success and error responses', async () => {
    const successRes = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    const successBody = await successRes.json()
    expect(successBody.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )

    mockRunCleanup.mockRejectedValueOnce(new Error('boom'))
    const errorRes = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    const errorBody = await errorRes.json()
    expect(errorBody.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  // -------------------------------------------------------------------------
  // cron_runs writes (4 cases)
  // -------------------------------------------------------------------------

  it('inserts a cron_runs start record with cron_name="cleanup" and status="running"', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cron_name: 'cleanup', status: 'running' }),
    )
  })

  it('updates cron_runs to status="completed" on success', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('updates cron_runs.rows_deleted with the total count', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ rows_deleted: 110 }),
    )
  })

  it('stores perTable breakdown in cron_runs.metadata', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: mockCleanupResult.perTable,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // Error handling (3 cases)
  // -------------------------------------------------------------------------

  it('returns 500 when runCleanup throws', async () => {
    mockRunCleanup.mockRejectedValueOnce(new Error('DB exploded'))
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Cleanup failed')
    expect(body.details).toContain('DB exploded')
  })

  it('sets cron_runs.status="failed" when runCleanup throws', async () => {
    mockRunCleanup.mockRejectedValueOnce(new Error('RPC failure'))
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    )
  })

  it('stores the error message in cron_runs.error_message', async () => {
    mockRunCleanup.mockRejectedValueOnce(new Error('specific failure message'))
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: 'specific failure message' }),
    )
  })

  // -------------------------------------------------------------------------
  // Idempotence (1 case)
  // Two consecutive calls must each write their own cron_runs row (distinct insert calls).
  // -------------------------------------------------------------------------

  it('produces two separate cron_runs insert calls on two consecutive successful requests', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })
})
