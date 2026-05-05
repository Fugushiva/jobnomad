/**
 * Unit tests for scripts/setup-supabase-smtp.ts
 *
 * Tests the SMTP config builder, payload structure, redaction, and API call logic.
 * Uses vi.stubGlobal('fetch', ...) to mock HTTP calls -- no real network traffic.
 *
 * Coverage:
 *   - buildSmtpConfig: correct payload with expected SMTP values
 *   - redactSmtpConfig: smtp_pass never fully visible in logs
 *   - callManagementApi: correct URL, method, Authorization header, body
 *   - dry-run: never calls fetch
 *   - applySmtpConfig: calls PATCH with correct path and payload
 *   - verifySmtpConfig: calls GET, validates config, exits 2 on drift
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildSmtpConfig,
  redactSmtpConfig,
  callManagementApi,
  MANAGEMENT_API_BASE,
  dryRun,
  applySmtpConfig,
  verifySmtpConfig,
  type SmtpConfig,
} from '../setup-supabase-smtp'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// SECURITY NOTE: All credentials below are FAKE TEST FIXTURES.
// They are NOT real secrets -- they are deliberately invalid literals used
// only in unit tests that mock fetch() and never reach any real API.
// Format includes 'FAKE_TEST_FIXTURE_NOT_REAL' so secret scanners
// (GitGuardian / gitleaks) can identify them as test placeholders.
//
// These tokens cannot authenticate against any real service:
//   - Wrong format (Supabase tokens are JWT-like; Resend keys have specific charset)
//   - Contain explicit "FAKE_TEST_FIXTURE_NOT_REAL" markers
const FAKE_SUPABASE_TOKEN = 'sbp_FAKE_TEST_FIXTURE_NOT_REAL_TOKEN_xxxx'
const FAKE_RESEND_KEY = 're_FAKE_TEST_FIXTURE_NOT_REAL_KEY_xxxx'
const FAKE_TOKEN_GENERIC = 'sbp_FAKE_GENERIC_TEST_TOKEN_xxxx'
const FAKE_TOKEN_WITH_LOG_MARKER = 'sbp_FAKE_LOG_LEAK_DETECTOR_TOKEN_xxxx'
const FAKE_REDACTED_PASS = 're_FAKE_REDACTED_xxxx'

const validVars = {
  SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  SUPABASE_ACCESS_TOKEN: FAKE_SUPABASE_TOKEN,
  RESEND_API_KEY: FAKE_RESEND_KEY,
  EMAIL_FROM_ADDRESS: 'auth@jobnomad.app',
  EMAIL_FROM_NAME: 'JobNomad',
}

// ---------------------------------------------------------------------------
// buildSmtpConfig
// ---------------------------------------------------------------------------

describe('buildSmtpConfig', () => {
  it('sets smtp_host to smtp.resend.com', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_host).toBe('smtp.resend.com')
  })

  it('sets smtp_port to "465" as string (Supabase API requires string)', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_port).toBe('465')
  })

  it('sets smtp_user to "resend"', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_user).toBe('resend')
  })

  it('sets smtp_pass to the RESEND_API_KEY', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_pass).toBe(validVars.RESEND_API_KEY)
  })

  it('sets smtp_admin_email from EMAIL_FROM_ADDRESS', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_admin_email).toBe('auth@jobnomad.app')
  })

  it('sets smtp_sender_name from EMAIL_FROM_NAME', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_sender_name).toBe('JobNomad')
  })

  it('enables external email', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.external_email_enabled).toBe(true)
  })

  it('enables secure email change', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.mailer_secure_email_change_enabled).toBe(true)
  })

  it('sets OTP expiry to 1 hour (3600 seconds)', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.mailer_otp_exp).toBe(3600)
  })

  it('sets smtp_max_frequency to 60 (anti-spam)', () => {
    const config = buildSmtpConfig(validVars)
    expect(config.smtp_max_frequency).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// redactSmtpConfig
// ---------------------------------------------------------------------------

describe('redactSmtpConfig', () => {
  it('does not expose the full smtp_pass', () => {
    const config = buildSmtpConfig(validVars)
    const redacted = redactSmtpConfig(config)
    expect(redacted.smtp_pass).not.toBe(validVars.RESEND_API_KEY)
  })

  it('includes ...REDACTED in smtp_pass', () => {
    const config = buildSmtpConfig(validVars)
    const redacted = redactSmtpConfig(config)
    expect(String(redacted.smtp_pass)).toContain('REDACTED')
  })

  it('only shows the prefix of smtp_pass', () => {
    const config = buildSmtpConfig(validVars)
    const redacted = redactSmtpConfig(config)
    const passStr = String(redacted.smtp_pass)
    // Should start with the first 5 chars of the key and end with REDACTED
    const expectedPrefix = FAKE_RESEND_KEY.slice(0, 5)
    expect(passStr.startsWith(expectedPrefix)).toBe(true)
    expect(passStr.endsWith('REDACTED')).toBe(true)
  })

  it('preserves all other fields unchanged', () => {
    const config = buildSmtpConfig(validVars)
    const redacted = redactSmtpConfig(config)
    expect(redacted.smtp_host).toBe(config.smtp_host)
    expect(redacted.smtp_port).toBe(config.smtp_port)
    expect(redacted.smtp_user).toBe(config.smtp_user)
    expect(redacted.smtp_admin_email).toBe(config.smtp_admin_email)
    expect(redacted.smtp_sender_name).toBe(config.smtp_sender_name)
  })

  it('never returns null or undefined for smtp_pass', () => {
    const config = buildSmtpConfig(validVars)
    const redacted = redactSmtpConfig(config)
    expect(redacted.smtp_pass).not.toBeNull()
    expect(redacted.smtp_pass).not.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// callManagementApi
// ---------------------------------------------------------------------------

describe('callManagementApi', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeMockResponse(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    }
  }

  it('calls the correct Management API URL', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(200, { ok: true }))

    await callManagementApi('GET', '/projects/testref/config/auth', FAKE_TOKEN_GENERIC)

    expect(mockFetch).toHaveBeenCalledWith(
      `${MANAGEMENT_API_BASE}/projects/testref/config/auth`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('includes Authorization Bearer token in headers', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(200, {}))

    await callManagementApi('GET', '/projects/testref/config/auth', FAKE_TOKEN_GENERIC)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe(`Bearer ${FAKE_TOKEN_GENERIC}`)
  })

  it('does NOT log the Bearer token (security check)', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(200, {}))
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await callManagementApi('GET', '/test', FAKE_TOKEN_WITH_LOG_MARKER)

    const allLogs = consoleSpy.mock.calls.flat().join(' ')
    expect(allLogs).not.toContain(FAKE_TOKEN_WITH_LOG_MARKER)

    consoleSpy.mockRestore()
  })

  it('sends PATCH with JSON body', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(200, {}))

    const body = { smtp_host: 'smtp.resend.com', smtp_port: 465 }
    await callManagementApi('PATCH', '/projects/ref/config/auth', FAKE_TOKEN_GENERIC, body)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify(body))
  })

  it('returns ok: true on 200 response', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(200, { result: 'ok' }))

    const result = await callManagementApi('GET', '/test', FAKE_TOKEN_GENERIC)

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })

  it('returns ok: false on 401 response', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(401, { message: 'Unauthorized' }))

    const result = await callManagementApi('GET', '/test', FAKE_TOKEN_GENERIC)

    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toContain('HTTP 401')
  })

  it('returns ok: false on 422 response', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(422, { message: 'Invalid project ref' }))

    const result = await callManagementApi('PATCH', '/test', FAKE_TOKEN_GENERIC, {})

    expect(result.ok).toBe(false)
    expect(result.error).toContain('HTTP 422')
  })

  it('handles non-JSON response body gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const result = await callManagementApi('GET', '/test', FAKE_TOKEN_GENERIC)

    expect(result.ok).toBe(false)
    expect(result.data).toBe('Internal Server Error')
  })

  it('GET request does not send a body', async () => {
    mockFetch.mockResolvedValue(makeMockResponse(200, {}))

    await callManagementApi('GET', '/test', FAKE_TOKEN_GENERIC)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// dryRun -- must NOT call fetch
// ---------------------------------------------------------------------------

describe('dryRun', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not call fetch in dry-run mode', () => {
    const mockFetch = vi.mocked(fetch)
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    dryRun(validVars)

    expect(mockFetch).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('logs DRY RUN message', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    dryRun(validVars)

    const logs = consoleSpy.mock.calls.flat().join(' ')
    expect(logs).toContain('DRY RUN')
    consoleSpy.mockRestore()
  })

  it('does NOT log the RESEND_API_KEY in dry-run output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    dryRun(validVars)

    const logs = consoleSpy.mock.calls.flat().join(' ')
    // The full API key should never appear in logs
    expect(logs).not.toContain(validVars.RESEND_API_KEY)
    consoleSpy.mockRestore()
  })

  it('logs the project ref in dry-run output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    dryRun(validVars)

    const logs = consoleSpy.mock.calls.flat().join(' ')
    expect(logs).toContain(validVars.SUPABASE_PROJECT_REF)
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// applySmtpConfig
// ---------------------------------------------------------------------------

describe('applySmtpConfig', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('calls PATCH on /projects/{ref}/config/auth', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{}'),
    })

    await applySmtpConfig(validVars)

    expect(mockFetch).toHaveBeenCalledWith(
      `${MANAGEMENT_API_BASE}/projects/${validVars.SUPABASE_PROJECT_REF}/config/auth`,
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('includes smtp_host in the payload', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{}'),
    })

    await applySmtpConfig(validVars)

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.smtp_host).toBe('smtp.resend.com')
  })

  it('does NOT log the full RESEND_API_KEY when applying', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{}'),
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await applySmtpConfig(validVars)

    const logs = consoleSpy.mock.calls.flat().join(' ')
    expect(logs).not.toContain(validVars.RESEND_API_KEY)
  })

  it('exits with code 1 on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    })

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as never)

    await expect(applySmtpConfig(validVars)).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

// ---------------------------------------------------------------------------
// verifySmtpConfig -- correct config, no drift
// ---------------------------------------------------------------------------

describe('verifySmtpConfig', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function mockCorrectConfig() {
    const config: SmtpConfig & Record<string, unknown> = {
      smtp_host: 'smtp.resend.com',
      smtp_port: '465',  // API returns string
      smtp_user: 'resend',
      smtp_admin_email: 'auth@jobnomad.app',
      smtp_sender_name: 'JobNomad',
      smtp_max_frequency: 60,
      smtp_pass: FAKE_REDACTED_PASS,
      mailer_secure_email_change_enabled: true,
      external_email_enabled: true,
      mailer_otp_exp: 3600,
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(config)),
    })
  }

  it('calls GET on /projects/{ref}/config/auth', async () => {
    mockCorrectConfig()

    await verifySmtpConfig(validVars)

    expect(mockFetch).toHaveBeenCalledWith(
      `${MANAGEMENT_API_BASE}/projects/${validVars.SUPABASE_PROJECT_REF}/config/auth`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('does NOT log smtp_pass in verify output', async () => {
    mockCorrectConfig()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await verifySmtpConfig(validVars)

    // The real key should never appear
    const logs = consoleSpy.mock.calls.flat().join(' ')
    expect(logs).not.toContain(FAKE_RESEND_KEY)
  })

  it('passes without exiting when config is correct', async () => {
    mockCorrectConfig()
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

    await verifySmtpConfig(validVars)

    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exits with code 2 when smtp_host has drifted', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        smtp_host: 'smtp.sendgrid.net', // wrong!
        smtp_port: '465',
        smtp_user: 'resend',
        smtp_admin_email: 'auth@jobnomad.app',
        external_email_enabled: true,
      })),
    })

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called with 2')
    }) as never)

    await expect(verifySmtpConfig(validVars)).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('exits with code 2 when external_email_enabled is false (drift)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        smtp_host: 'smtp.resend.com',
        smtp_port: '465',
        smtp_user: 'resend',
        smtp_admin_email: 'auth@jobnomad.app',
        external_email_enabled: false, // disabled!
      })),
    })

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called with 2')
    }) as never)

    await expect(verifySmtpConfig(validVars)).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('exits with code 1 on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    })

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called with 1')
    }) as never)

    await expect(verifySmtpConfig(validVars)).rejects.toThrow()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
