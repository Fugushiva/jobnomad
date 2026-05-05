/**
 * Unit tests for runCleanup orchestrator.
 *
 * The Supabase client is fully mocked — we test:
 *   - Happy path: correct data flow, return types, rowsDeleted sum
 *   - RPC error: error propagation, no silent swallow
 *   - Schema mismatch: Zod validation catches unexpected JSONB
 *   - Edge cases: all-zero counts, maximum counts
 */

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/database.types'
import { runCleanup } from '../run-cleanup'
import type { RunCleanupOptions } from '../run-cleanup'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_RPC_RESPONSE = {
  jobs_expired:      5,
  jobs_deleted:      12,
  views_deleted:     87,
  digests_deleted:   3,
  ai_log_deleted:    0,
  feedback_deleted:  1,
  cron_runs_deleted: 2,
  ran_at:            '2026-05-04T03:00:00.000Z',
}

// Sum of all numeric fields (excluding ran_at)
const EXPECTED_ROWS_DELETED =
  VALID_RPC_RESPONSE.jobs_expired +
  VALID_RPC_RESPONSE.jobs_deleted +
  VALID_RPC_RESPONSE.views_deleted +
  VALID_RPC_RESPONSE.digests_deleted +
  VALID_RPC_RESPONSE.ai_log_deleted +
  VALID_RPC_RESPONSE.feedback_deleted +
  VALID_RPC_RESPONSE.cron_runs_deleted

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

type RpcResult = { data: unknown; error: null | { code: string; message: string } }

function makeSupabaseMock(rpcResult: RpcResult): SupabaseClient<Database> {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as SupabaseClient<Database>
}

type MockFn = ReturnType<typeof vi.fn>

function makeLogger(): MockFn {
  return vi.fn()
}

function makeOpts(overrides?: Partial<RunCleanupOptions>): RunCleanupOptions {
  return {
    supabase: makeSupabaseMock({ data: VALID_RPC_RESPONSE, error: null }),
    runId: 'test-run-id',
    log: makeLogger() as RunCleanupOptions['log'],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('runCleanup — happy path', () => {
  it('calls supabase.rpc("cleanup_expired_data") with no extra args', async () => {
    const supabase = makeSupabaseMock({ data: VALID_RPC_RESPONSE, error: null })
    await runCleanup({ supabase, runId: 'r1', log: makeLogger() as RunCleanupOptions['log'] })
    expect(supabase.rpc).toHaveBeenCalledWith('cleanup_expired_data')
  })

  it('returns a RunCleanupResult with correct runId', async () => {
    const result = await runCleanup(makeOpts())
    expect(result.runId).toBe('test-run-id')
  })

  it('computes rowsDeleted as the sum of all per-table counts', async () => {
    const result = await runCleanup(makeOpts())
    expect(result.rowsDeleted).toBe(EXPECTED_ROWS_DELETED)
  })

  it('maps perTable fields exactly from the RPC response', async () => {
    const result = await runCleanup(makeOpts())
    expect(result.perTable).toEqual({
      jobs_expired:      5,
      jobs_deleted:      12,
      views_deleted:     87,
      digests_deleted:   3,
      ai_log_deleted:    0,
      feedback_deleted:  1,
      cron_runs_deleted: 2,
    })
  })

  it('sets ranAt from the RPC ran_at field', async () => {
    const result = await runCleanup(makeOpts())
    expect(result.ranAt).toBe('2026-05-04T03:00:00.000Z')
  })

  it('sets durationMs to a non-negative number', async () => {
    const result = await runCleanup(makeOpts())
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('logs info at start and completion', async () => {
    const log = makeLogger()
    await runCleanup(makeOpts({ log: log as RunCleanupOptions['log'] }))
    const levels = (log.mock.calls as unknown[][]).map(c => c[0])
    expect(levels).toContain('info')
    expect(levels.filter(l => l === 'info').length).toBeGreaterThanOrEqual(2)
  })

  it('handles all-zero counts without throwing', async () => {
    const zeroResponse = {
      jobs_expired: 0, jobs_deleted: 0, views_deleted: 0,
      digests_deleted: 0, ai_log_deleted: 0, feedback_deleted: 0,
      cron_runs_deleted: 0, ran_at: '2026-05-04T03:00:00.000Z',
    }
    const opts = makeOpts({ supabase: makeSupabaseMock({ data: zeroResponse, error: null }) })
    const result = await runCleanup(opts)
    expect(result.rowsDeleted).toBe(0)
  })

  it('handles large counts without overflow (JS number safety)', async () => {
    const bigResponse = { ...VALID_RPC_RESPONSE, jobs_deleted: 100_000, views_deleted: 500_000 }
    const opts = makeOpts({ supabase: makeSupabaseMock({ data: bigResponse, error: null }) })
    const result = await runCleanup(opts)
    expect(result.rowsDeleted).toBe(
      VALID_RPC_RESPONSE.jobs_expired + 100_000 + 500_000 +
      VALID_RPC_RESPONSE.digests_deleted + VALID_RPC_RESPONSE.ai_log_deleted +
      VALID_RPC_RESPONSE.feedback_deleted + VALID_RPC_RESPONSE.cron_runs_deleted,
    )
  })
})

// ---------------------------------------------------------------------------
// RPC error handling
// ---------------------------------------------------------------------------

describe('runCleanup — RPC errors', () => {
  it('throws when Supabase returns an error object', async () => {
    const opts = makeOpts({
      supabase: makeSupabaseMock({
        data: null,
        error: { code: 'PGRST301', message: 'permission denied for function cleanup_expired_data' },
      }),
    })
    await expect(runCleanup(opts)).rejects.toThrow('cleanup_expired_data RPC failed')
  })

  it('includes the Supabase error message in the thrown error', async () => {
    const opts = makeOpts({
      supabase: makeSupabaseMock({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      }),
    })
    await expect(runCleanup(opts)).rejects.toThrow('permission denied')
  })

  it('logs error level before throwing on RPC failure', async () => {
    const log = makeLogger()
    const opts = makeOpts({
      supabase: makeSupabaseMock({ data: null, error: { code: '42501', message: 'boom' } }),
      log: log as RunCleanupOptions['log'],
    })
    await expect(runCleanup(opts)).rejects.toThrow()
    const levels = (log.mock.calls as unknown[][]).map(c => c[0])
    expect(levels).toContain('error')
  })

  it('throws when RPC returns null data with no error', async () => {
    const opts = makeOpts({ supabase: makeSupabaseMock({ data: null, error: null }) })
    await expect(runCleanup(opts)).rejects.toThrow('returned null')
  })

  it('throws when RPC returns undefined data with no error', async () => {
    const opts = makeOpts({ supabase: makeSupabaseMock({ data: undefined, error: null }) })
    await expect(runCleanup(opts)).rejects.toThrow('returned null')
  })
})

// ---------------------------------------------------------------------------
// Zod schema validation (A08 — defence in depth)
// ---------------------------------------------------------------------------

describe('runCleanup — schema validation', () => {
  it('throws when a required field is missing from the response', async () => {
    const bad = { ...VALID_RPC_RESPONSE } as Record<string, unknown>
    delete bad['jobs_expired']
    const opts = makeOpts({ supabase: makeSupabaseMock({ data: bad, error: null }) })
    await expect(runCleanup(opts)).rejects.toThrow()
  })

  it('throws when a numeric field is a string', async () => {
    const opts = makeOpts({
      supabase: makeSupabaseMock({
        data: { ...VALID_RPC_RESPONSE, jobs_deleted: 'twelve' },
        error: null,
      }),
    })
    await expect(runCleanup(opts)).rejects.toThrow()
  })

  it('throws when a count is negative (integrity violation)', async () => {
    const opts = makeOpts({
      supabase: makeSupabaseMock({
        data: { ...VALID_RPC_RESPONSE, views_deleted: -1 },
        error: null,
      }),
    })
    await expect(runCleanup(opts)).rejects.toThrow()
  })

  it('throws when ran_at is missing', async () => {
    const bad = { ...VALID_RPC_RESPONSE } as Record<string, unknown>
    delete bad['ran_at']
    const opts = makeOpts({ supabase: makeSupabaseMock({ data: bad, error: null }) })
    await expect(runCleanup(opts)).rejects.toThrow()
  })

  it('logs error level before throwing on schema mismatch', async () => {
    const log = makeLogger()
    const opts = makeOpts({
      supabase: makeSupabaseMock({
        data: { ...VALID_RPC_RESPONSE, jobs_expired: 'bad' },
        error: null,
      }),
      log: log as RunCleanupOptions['log'],
    })
    await expect(runCleanup(opts)).rejects.toThrow()
    const levels = (log.mock.calls as unknown[][]).map(c => c[0])
    expect(levels).toContain('error')
  })

  it('accepts additional unknown fields in the JSONB (forward compat)', async () => {
    const opts = makeOpts({
      supabase: makeSupabaseMock({
        data: { ...VALID_RPC_RESPONSE, future_field: 99 },
        error: null,
      }),
    })
    // Zod strips extra fields by default — should not throw
    await expect(runCleanup(opts)).resolves.toBeDefined()
  })
})
