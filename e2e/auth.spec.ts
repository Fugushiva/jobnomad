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
    // "Try again" was renamed to "Use a different email" for clearer UX (#51)
    await expect(page.getByRole('link', { name: /use a different email/i })).toHaveAttribute('href', '/auth/login')
  })

  test('renders "Back to home" link pointing to "/"', async ({ page }) => {
    await page.goto('/auth/verify')
    // Multiple links on the page — find the one explicitly labelled "Back to home"
    const backLink = page.getByRole('link', { name: /back to home/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')
  })

  test('mail icon has aria-hidden (decorative only)', async ({ page }) => {
    await page.goto('/auth/verify')
    // The icon circle wrapper is aria-hidden — it must not be in the accessibility tree
    const iconCircle = page.locator('[aria-hidden="true"].motion-safe\\:animate-pulse')
    // Playwright can find aria-hidden elements via locator (they're in the DOM)
    await expect(iconCircle).toBeAttached()
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

test.describe('Logout flow', () => {
  /**
   * These E2E tests verify the logout UI and its security properties without
   * requiring a real authenticated session (which would need Supabase admin
   * API access). For the full login → logout → redirect flow, see
   * docs/auth-setup.md (manual testing runbook).
   *
   * What we CAN verify without a session:
   *  1. The public landing page does NOT expose a logout button (auth-conditional rendering).
   *  2. The /feed route (protected) redirects unauthenticated users to /auth/login.
   *  3. The old /auth/signout GET route no longer exists (replaced by Server Action).
   *  4. The landing page is accessible with no ?signed_out flag (no ghost toast).
   */

  test('landing page does not show Sign out button for unauthenticated visitors', async ({ page }) => {
    await page.goto('/')
    // The header must be in public variant — no UserMenu, no Sign out
    const signOutButtons = page.getByRole('button', { name: /sign out/i })
    await expect(signOutButtons).toHaveCount(0)
  })

  test('/feed still redirects unauthenticated users after signout route removal', async ({ page }) => {
    // Regression guard: removing the old route handler must not break the
    // auth guard. Protected routes must still redirect to /auth/login.
    await page.goto('/feed')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('old GET /auth/signout route returns 404 (replaced by Server Action)', async ({ page }) => {
    // A GET-based sign-out URL is a security vulnerability (CSRF via link
    // prefetch). The route was removed and replaced with a Server Action.
    // Verifying it no longer responds prevents accidental re-introduction.
    const response = await page.goto('/auth/signout')
    expect(response?.status()).toBe(404)
  })

  test('landing page with ?signed_out=1 renders without error', async ({ page }) => {
    // The toast component reads this query param. Verify the page doesn't crash.
    await page.goto('/?signed_out=1')
    await expect(page).toHaveURL('/?signed_out=1')
    // The page body should render normally (no error page, no 500)
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('Sign in link still works from landing after logout param is present', async ({ page }) => {
    await page.goto('/?signed_out=1')
    const signInLinks = page.getByRole('link', { name: 'Sign in' })
    await expect(signInLinks.first()).toBeVisible()
    await expect(signInLinks.first()).toHaveAttribute('href', '/auth/login')
  })
})

/**
 * Visual coherence tests — issue #51
 *
 * Verify that all three auth pages share the same structural design:
 *  - Logo (JobNomad brand) visible on every page.
 *  - A single <h1> per page.
 *  - <main id="main"> is present (skip-link accessibility target).
 *  - No inline CSS `style` attributes on the page card (all styling via Tailwind).
 *  - Back-navigation links are present and correct.
 *
 * These tests run against the real dev server and therefore catch regressions
 * that unit tests might miss (e.g. CSS token not resolving, layout broken).
 */
test.describe('Auth pages visual coherence (#51)', () => {
  const AUTH_PAGES = [
    { path: '/auth/login',                  label: 'login' },
    { path: '/auth/verify',                 label: 'verify' },
    { path: '/auth/error?reason=link_expired', label: 'error' },
  ] as const

  for (const { path, label } of AUTH_PAGES) {
    test(`[${label}] renders the JobNomad logo`, async ({ page }) => {
      await page.goto(path)
      // Logo always renders the brand name in a link
      await expect(page.getByText('JobNomad').first()).toBeVisible()
    })

    test(`[${label}] has exactly one <h1>`, async ({ page }) => {
      await page.goto(path)
      const headings = page.getByRole('heading', { level: 1 })
      await expect(headings).toHaveCount(1)
    })

    test(`[${label}] has <main id="main"> (skip-link target)`, async ({ page }) => {
      await page.goto(path)
      const main = page.locator('main#main')
      await expect(main).toBeAttached()
    })

    test(`[${label}] has no inline style attributes on the Card container`, async ({ page }) => {
      await page.goto(path)
      /**
       * The old verify/error pages used inline `style={{ backgroundColor: 'var(--bg)' }}`
       * After the polish they use Tailwind classes exclusively.
       * This test catches any regression where a style attribute is re-introduced
       * on the card/container elements.
       *
       * We specifically check the card-level containers (not SVG attributes).
       * SVG presentation attributes (stroke, fill) are NOT `style` attributes.
       */
      const elementsWithStyle = await page.locator('main > *[style], main > * > *[style]').count()
      expect(elementsWithStyle).toBe(0)
    })
  }

  test('[login] has "Back to home" link pointing to "/"', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })

  test('[verify] has "Use a different email" link pointing to /auth/login', async ({ page }) => {
    await page.goto('/auth/verify')
    await expect(
      page.getByRole('link', { name: /use a different email/i })
    ).toHaveAttribute('href', '/auth/login')
  })

  test('[error] has "Try again" primary CTA pointing to /auth/login', async ({ page }) => {
    await page.goto('/auth/error?reason=link_expired')
    await expect(page.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/auth/login')
  })

  test('[error] has "Back to home" link pointing to "/"', async ({ page }) => {
    await page.goto('/auth/error?reason=link_expired')
    const links = page.getByRole('link', { name: /back to home/i })
    await expect(links.first()).toHaveAttribute('href', '/')
  })

  test('[error] raw reason param is NOT reflected in page text (XSS guard)', async ({ page }) => {
    const maliciousReason = 'INJECTED_VALUE_XYZ_12345'
    await page.goto(`/auth/error?reason=${maliciousReason}`)
    // The page should fall back to default error and not reflect the raw value
    await expect(page.getByText(maliciousReason)).toHaveCount(0)
    // Should show the default error heading instead
    await expect(
      page.getByRole('heading', { name: /something went wrong/i })
    ).toBeVisible()
  })
})
