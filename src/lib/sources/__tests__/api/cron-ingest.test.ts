/**
 * Integration tests for /api/cron/ingest route handler.
 *
 * Tests the security boundary (auth), the cron_runs writes,
 * and the happy-path response shape.
 *
 * The route handler is tested in isolation with mocked service client
 * and mocked runIngestion — we don't re-test the orchestrator here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports that reference them
// ---------------------------------------------------------------------------

const mockIngestResult = {
  runId: 'mocked-run-id',
  jobsFetched: 10,
  jobsNew: 5,
  jobsSkipped: 5,
  jobsFailed: 0,
  durationMs: 1500,
  perSource: { remoteok: { fetched: 10, new: 5, skipped: 5, failed: 0, notModified: false, durationMs: 1500 } },
  deadlineHit: false,
}

const mockRunIngestion = vi.fn().mockResolvedValue(mockIngestResult)
vi.mock('@/src/lib/sources/ingest', () => ({ runIngestion: mockRunIngestion }))

const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'cron-run-uuid' }, error: null })
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
const mockInsertSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

vi.mock('@/src/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'cron_runs') {
        return { insert: mockInsert, update: mockUpdate }
      }
      return {}
    },
  }),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { GET } = await import('@/app/api/cron/ingest/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = 'test-secret-that-is-long-enough-32'

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('https://jobnomad.app/api/cron/ingest', {
    method: 'GET',
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/ingest', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET
    vi.clearAllMocks()
    mockRunIngestion.mockResolvedValue(mockIngestResult)
    mockSingle.mockResolvedValue({ data: { id: 'cron-run-uuid' }, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Authorization
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

  it('returns 200 with correct secret', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200)
  })

  // -------------------------------------------------------------------------
  // Response shape
  // -------------------------------------------------------------------------

  it('returns ok:true and IngestResult fields on success', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.runId).toBeDefined()
    expect(body.jobsNew).toBe(5)
    expect(body.jobsSkipped).toBe(5)
    expect(body.jobsFetched).toBe(10)
    expect(body.status).toBe('completed')
  })

  // -------------------------------------------------------------------------
  // cron_runs write
  // -------------------------------------------------------------------------

  it('writes a cron_runs start record', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cron_name: 'ingest', status: 'running' })
    )
  })

  it('updates cron_runs to completed status', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    )
  })

  it('updates cron_runs with job counts', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs_new: 5,
        jobs_skipped: 5,
        jobs_fetched: 10,
        jobs_failed: 0,
      })
    )
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns 500 and status=failed when runIngestion throws', async () => {
    mockRunIngestion.mockRejectedValueOnce(new Error('DB exploded'))

    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Ingestion failed')
    expect(body.details).toContain('DB exploded')
  })

  it('returns status=timeout when deadlineHit=true', async () => {
    mockRunIngestion.mockResolvedValueOnce({ ...mockIngestResult, deadlineHit: true })

    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('timeout')
  })

  // -------------------------------------------------------------------------
  // Timing-safe comparison — sanity check (not a full timing attack test)
  // -------------------------------------------------------------------------

  it('rejects a secret that is correct but with extra characters appended', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET}extra`))
    expect(response.status).toBe(401)
  })

  it('rejects a secret that is correct but with characters removed', async () => {
    const response = await GET(makeRequest(`Bearer ${CRON_SECRET.slice(0, -3)}`))
    expect(response.status).toBe(401)
  })
})
