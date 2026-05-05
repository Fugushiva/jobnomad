/**
 * Tests for lib/toast toastError() helper.
 *
 * Core security guarantee: Error objects (and unknown values) MUST NOT expose
 * their raw .message / .stack to the user. Only developer-supplied plain
 * strings and the explicit fallback message are ever displayed.
 *
 * Test matrix:
 *   Input type     | Expected toast message
 *   ──────────────────────────────────────────────────────────
 *   string         | the string itself
 *   Error          | fallback (never error.message)
 *   Error + custom | custom fallback (never error.message)
 *   number         | fallback
 *   object         | fallback
 *   null           | fallback
 *   undefined      | fallback
 *   omit fallback  | default "Something went wrong"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockToastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

// Suppress console.error noise from the debug logging branch.
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * toastError uses a dynamic import('sonner') internally, which is async.
 * We flush all microtasks after calling it so mock assertions are synchronous.
 */
async function callToastError(input: unknown, fallback?: string) {
  const { toastError } = await import('../index')
  if (fallback !== undefined) {
    toastError(input, fallback)
  } else {
    toastError(input)
  }
  // Flush the dynamic import promise chain
  await new Promise(resolve => setTimeout(resolve, 0))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('toastError — safe error toast helper', () => {
  beforeEach(() => {
    mockToastError.mockClear()
    consoleErrorSpy.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('string input', () => {
    it('displays the string directly', async () => {
      await callToastError('Job could not be saved')
      expect(mockToastError).toHaveBeenCalledWith('Job could not be saved')
    })

    it('displays an empty string as-is (edge case)', async () => {
      await callToastError('')
      expect(mockToastError).toHaveBeenCalledWith('')
    })
  })

  describe('Error input — security boundary', () => {
    it('shows fallback, NOT error.message, for a generic Error', async () => {
      const err = new Error('DB connection failed at /var/lib/postgresql/data')
      await callToastError(err)
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
      // Critical: the raw error message must NEVER reach the toast
      expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('DB connection'))
      expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('/var/lib'))
    })

    it('uses the custom fallback when provided', async () => {
      const err = new Error('supabase: relation "users" does not exist')
      await callToastError(err, 'Could not save your job')
      expect(mockToastError).toHaveBeenCalledWith('Could not save your job')
      expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('supabase'))
    })

    it('does not leak error.stack', async () => {
      const err = new Error('SyntaxError at line 42')
      err.stack = 'Error: SyntaxError at line 42\n    at /app/server/action.ts:42:3'
      await callToastError(err, 'Action failed')
      expect(mockToastError).toHaveBeenCalledWith('Action failed')
      expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('action.ts'))
    })

    it('works for subclasses of Error (TypeError, RangeError, etc.)', async () => {
      const err = new TypeError('Cannot read properties of undefined (reading "id")')
      await callToastError(err, 'Unexpected error')
      expect(mockToastError).toHaveBeenCalledWith('Unexpected error')
      expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('Cannot read'))
    })
  })

  describe('unknown / non-Error input — security boundary', () => {
    it('shows fallback for a number', async () => {
      await callToastError(500)
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })

    it('shows fallback for a plain object', async () => {
      await callToastError({ code: 403, message: 'Forbidden' })
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })

    it('shows fallback for null', async () => {
      await callToastError(null)
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })

    it('shows fallback for undefined', async () => {
      await callToastError(undefined)
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })

    it('shows fallback for a boolean', async () => {
      await callToastError(false)
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })
  })

  describe('default fallback message', () => {
    it('uses "Something went wrong" when no fallback is provided', async () => {
      await callToastError(new Error('internal'))
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })

    it('uses custom fallback over default when provided', async () => {
      await callToastError(new Error('internal'), 'Profile update failed')
      expect(mockToastError).toHaveBeenCalledWith('Profile update failed')
    })
  })

  describe('development logging', () => {
    it('calls console.error with the raw input in development (NODE_ENV=test acts as dev)', async () => {
      // In the test environment, NODE_ENV is "test" (not "production"),
      // so the dev logging branch runs.
      const err = new Error('raw error details')
      await callToastError(err)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[toastError]', err)
    })
  })
})
