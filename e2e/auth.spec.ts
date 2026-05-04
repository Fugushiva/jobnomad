import { test, expect } from '@playwright/test'

/**
 * E2E tests for the auth flow.
 *
 * These tests run against a real Next.js dev server.
 * They verify UI rendering, form validation, navigation, and security.
 *
 * Note: actual magic link sending/receiving is NOT tested here
 * (requires Supabase admin API — see docs/auth-setup.md for manual testing).
 * Instead we test the user-facing pages and error handling.
 */

test.describe('Login page', () => {
  test('renders the login form with correct elements', async ({ page }) => {
    await page.goto('/auth/login')

    // Page title
    await expect(page).toHaveTitle(/sign in/i)

    // Logo
    await expect(page.locator('text=JobNomad')).toBeVisible()

    // Heading
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    // Email input — react-hook-form validates via JS, not HTML required attr
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('autocomplete', 'email')

    // Submit button
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible()

    // Back link
    await expect(page.getByText('Back to home')).toBeVisible()
  })

  test('shows client validation error for invalid email', async ({ page }) => {
    await page.goto('/auth/login')

    // react-hook-form validates on submit — type an invalid email then submit
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('not-an-email')
    await page.getByRole('button', { name: /send magic link/i }).click()

    // RHF shows inline error via <FormMessage role="alert">
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 })
  })

  test('shows "check your email" confirmation after valid submit', async ({ page }) => {
    await page.goto('/auth/login')

    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill('test@example.com')
    await page.getByRole('button', { name: /send magic link/i }).click()

    // Should show confirmation (action always returns success to prevent enumeration)
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('We sent a magic link to your inbox')).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('landing page Sign in link navigates to /auth/login', async ({ page }) => {
    await page.goto('/')
    // Header renders Sign in in both desktop and mobile nav — use first (desktop)
    await page.getByRole('link', { name: 'Sign in' }).first().click()
    await expect(page).toHaveURL('/auth/login')
  })
})

test.describe('Protected routes', () => {
  test('/feed redirects unauthenticated user to /auth/login', async ({ page }) => {
    await page.goto('/feed')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('/onboarding redirects unauthenticated user to /auth/login', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('Error page', () => {
  test('shows "Link expired" for ?reason=link_expired', async ({ page }) => {
    await page.goto('/auth/error?reason=link_expired')
    await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible()
    await expect(page.getByText('This magic link has expired')).toBeVisible()
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible()
  })

  test('shows "Invalid link" for ?reason=missing_code', async ({ page }) => {
    await page.goto('/auth/error?reason=missing_code')
    await expect(page.getByRole('heading', { name: 'Invalid link' })).toBeVisible()
  })

  test('shows generic error for unknown reason', async ({ page }) => {
    await page.goto('/auth/error?reason=unknown_thing')
    await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible()
  })

  test('shows generic error when no reason provided', async ({ page }) => {
    await page.goto('/auth/error')
    await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible()
  })
})

test.describe('Verify page', () => {
  test('renders check your email message', async ({ page }) => {
    await page.goto('/auth/verify')
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/auth/login')
  })
})

test.describe('Security headers', () => {
  test('responses include OWASP security headers', async ({ page }) => {
    const response = await page.goto('/')

    expect(response).not.toBeNull()
    const headers = response!.headers()

    // Check key security headers
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['x-xss-protection']).toBe('1; mode=block')
    expect(headers['permissions-policy']).toBeDefined()
    // Phase 1 additions (C12)
    expect(headers['cross-origin-resource-policy']).toBe('same-origin')
    expect(headers['cross-origin-opener-policy']).toBe('same-origin')
  })
})

test.describe('Auth callback without code', () => {
  test('redirects to error page when no code param', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page).toHaveURL(/\/auth\/error\?reason=missing_code/)
  })
})
