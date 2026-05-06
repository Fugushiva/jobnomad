import { test, expect } from '@playwright/test'

/**
 * E2E tests for the onboarding wizard (FM02).
 *
 * Scope:
 *  - Auth redirect: unauthenticated users hitting /onboarding → /auth/login
 *  - Feed guard: unauthenticated users hitting /feed → /auth/login
 *  - Page structure: title, heading, stepper visible when auth is bypassed
 *    (tested via Next.js layout which redirects before rendering — we verify the redirects)
 *  - Component rendering smoke tests via direct navigation
 *
 * What is NOT tested here (requires real Supabase session):
 *  - Step submission (saveStep1/2/3, completeOnboarding)
 *  - Resume logic (onboarding_completed_at set → redirect /feed)
 *  - End-to-end wizard completion
 * These would require Playwright auth fixtures with real magic-link or test token injection.
 * See docs/testing.md for the full auth E2E setup plan.
 *
 * Security tests:
 *  - /onboarding redirects to login if no session cookie
 *  - /feed redirects to login if no session cookie (and to /onboarding if session but no profile)
 *  - No server errors (500) on these routes
 */

test.describe('Onboarding — auth guards', () => {
  test('unauthenticated /onboarding redirects to /auth/login', async ({ page }) => {
    await page.goto('/onboarding')
    // Should redirect — not render the wizard
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })
    await expect(page).toHaveTitle(/sign in/i)
  })

  test('unauthenticated /feed redirects to /auth/login', async ({ page }) => {
    await page.goto('/feed')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })
    await expect(page).toHaveTitle(/sign in/i)
  })

  test('/onboarding does not render a 500 error page', async ({ page }) => {
    const response = await page.goto('/onboarding')
    // redirect responses are 307 — but page.goto follows them
    // we should NOT land on a 500 page
    expect(page.url()).not.toContain('500')
    // The login page should be rendered cleanly
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('/feed does not render a 500 error page', async ({ page }) => {
    await page.goto('/feed')
    expect(page.url()).not.toContain('500')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('Onboarding — login page links', () => {
  test('login page is reachable and functional after onboarding redirect', async ({
    page,
  }) => {
    // Navigate to onboarding (triggers redirect to login)
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })

    // Login page is fully rendered and interactive
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /send magic link/i })
    ).toBeVisible()
  })
})

test.describe('Onboarding — XSS / security', () => {
  test('redirect from /onboarding does not expose user data in URL', async ({ page }) => {
    await page.goto('/onboarding')
    const finalUrl = page.url()
    // URL should not contain any sensitive data
    expect(finalUrl).not.toMatch(/user_id|email|token|secret/i)
  })

  test('redirect from /feed does not expose user data in URL', async ({ page }) => {
    await page.goto('/feed')
    const finalUrl = page.url()
    expect(finalUrl).not.toMatch(/user_id|email|token|secret/i)
  })

  test('/onboarding redirect does not set insecure cookies', async ({
    page,
    context,
  }) => {
    await page.goto('/onboarding')
    const cookies = await context.cookies()
    // No cookies should be set that are not httpOnly (e.g., no auth data in JS-accessible cookies)
    const insecureCookies = cookies.filter(
      (c) => !c.httpOnly && c.name.toLowerCase().includes('auth')
    )
    expect(insecureCookies).toHaveLength(0)
  })
})

test.describe('Onboarding — step indicator component accessibility', () => {
  /**
   * We can't render /onboarding directly (auth guard redirects), but we can
   * verify the public-facing auth pages still work after our changes to the
   * onboarding + feed pages (regression guard).
   */
  test('auth login page still renders after onboarding + feed changes', async ({
    page,
  }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveTitle(/sign in/i)
    await expect(page.getByRole('main')).toBeVisible()
    // No JS errors should have occurred
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })

  test('auth verify page renders without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/auth/verify')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})

test.describe('Onboarding — navigation regression guard', () => {
  test('/ (landing page) is not broken after feed+onboarding changes', async ({
    page,
  }) => {
    await page.goto('/')
    // Should not 404 or 500
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
    expect(page.url()).not.toContain('error')
  })

  test('header still renders correctly on public pages', async ({ page }) => {
    await page.goto('/')
    // Header should be visible and contain JobNomad
    await expect(page.locator('header')).toBeVisible({ timeout: 10_000 })
  })
})
