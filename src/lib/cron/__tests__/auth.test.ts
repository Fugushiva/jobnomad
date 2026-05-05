/**
 * Unit tests for shared cron auth helpers.
 *
 * Tests cover:
 *   - isAuthorizedCronRequest: all rejection paths + happy path + timing-safe edge cases
 *   - makeCronLogger: structured output format + level routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { isAuthorizedCronRequest, makeCronLogger } from '../auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-secret-that-is-long-enough-for-a-real-secret-32x'

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('https://jobnomad.app/api/cron/test', {
    method: 'GET',
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

// ---------------------------------------------------------------------------
// isAuthorizedCronRequest
// ---------------------------------------------------------------------------

describe('isAuthorizedCronRequest', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = VALID_SECRET
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  // -------------------------------------------------------------------------
  // Rejection paths
  // -------------------------------------------------------------------------

  it('returns false when CRON_SECRET is not set', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCronRequest(makeRequest(`Bearer ${VALID_SECRET}`))).toBe(false)
  })

  it('returns false when CRON_SECRET is an empty string', () => {
    process.env.CRON_SECRET = ''
    expect(isAuthorizedCronRequest(makeRequest('Bearer anything'))).toBe(false)
  })

  it('returns false when Authorization header is missing', () => {
    expect(isAuthorizedCronRequest(makeRequest())).toBe(false)
  })

  it('returns false when Authorization header has no Bearer prefix', () => {
    expect(isAuthorizedCronRequest(makeRequest(VALID_SECRET))).toBe(false)
  })

  it('returns false when Authorization header is "Bearer " with empty secret', () => {
    expect(isAuthorizedCronRequest(makeRequest('Bearer '))).toBe(false)
  })

  it('returns false with wrong secret', () => {
    expect(isAuthorizedCronRequest(makeRequest('Bearer wrong-secret'))).toBe(false)
  })

  it('returns false with correct secret but extra characters appended (timing-safe)', () => {
    expect(isAuthorizedCronRequest(makeRequest(`Bearer ${VALID_SECRET}extra`))).toBe(false)
  })

  it('returns false with correct secret but characters removed (timing-safe)', () => {
    expect(isAuthorizedCronRequest(makeRequest(`Bearer ${VALID_SECRET.slice(0, -4)}`))).toBe(false)
  })

  it('returns false with correct secret but different case', () => {
    expect(isAuthorizedCronRequest(makeRequest(`Bearer ${VALID_SECRET.toUpperCase()}`))).toBe(false)
  })

  it('returns false when Authorization value is "Basic <secret>" instead of Bearer', () => {
    expect(isAuthorizedCronRequest(makeRequest(`Basic ${VALID_SECRET}`))).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns true with correct Bearer secret', () => {
    expect(isAuthorizedCronRequest(makeRequest(`Bearer ${VALID_SECRET}`))).toBe(true)
  })

  it('returns true even with a minimal 1-character secret (edge case)', () => {
    process.env.CRON_SECRET = 'x'
    expect(isAuthorizedCronRequest(makeRequest('Bearer x'))).toBe(true)
  })

  it('returns true with a secret containing special characters', () => {
    const special = 'abc!@#$%^&*()_+-=[]{}|;\':",./<>?'
    process.env.CRON_SECRET = special
    expect(isAuthorizedCronRequest(makeRequest(`Bearer ${special}`))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// makeCronLogger
// ---------------------------------------------------------------------------

describe('makeCronLogger', () => {
  const runId = 'test-run-id-abc123'

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes info level to console.log', () => {
    const log = makeCronLogger(runId)
    log('info', 'test message')
    expect(console.log).toHaveBeenCalledOnce()
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('routes warn level to console.warn', () => {
    const log = makeCronLogger(runId)
    log('warn', 'test warning')
    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.log).not.toHaveBeenCalled()
  })

  it('routes error level to console.error', () => {
    const log = makeCronLogger(runId)
    log('error', 'test error')
    expect(console.error).toHaveBeenCalledOnce()
    expect(console.log).not.toHaveBeenCalled()
  })

  it('emits a valid JSON string', () => {
    const log = makeCronLogger(runId)
    log('info', 'hello', { count: 42 })

    const raw = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0]
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('includes level, message, runId and ts fields', () => {
    const log = makeCronLogger(runId)
    log('info', 'hello world')

    const raw = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)

    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('hello world')
    expect(parsed.runId).toBe(runId)
    expect(typeof parsed.ts).toBe('string')
    expect(new Date(parsed.ts).toISOString()).toBe(parsed.ts)
  })

  it('spreads meta fields into the log entry', () => {
    const log = makeCronLogger(runId)
    log('info', 'with meta', { rowsDeleted: 100, source: 'cleanup' })

    const raw = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0]
    const parsed = JSON.parse(raw)

    expect(parsed.rowsDeleted).toBe(100)
    expect(parsed.source).toBe('cleanup')
  })

  it('works without meta argument', () => {
    const log = makeCronLogger(runId)
    expect(() => log('info', 'no meta')).not.toThrow()
  })
})
