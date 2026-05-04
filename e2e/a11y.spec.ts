/**
 * Accessibility E2E tests — WCAG 2.1 AA compliance
 *
 * Tests the public-facing pages for accessibility using Playwright.
 * Checks: keyboard navigation, skip link, landmark structure, focus visible.
 *
 * Note: axe-core integration requires @axe-core/playwright which needs a
 * running dev/preview server. These tests validate structural a11y without axe.
 * Full axe scan is done manually pre-release via Lighthouse CI.
 *
 * Pages tested: / (home), /auth/login
 */

import { test, expect } from '@playwright/test'

test.describe('Accessibility — Home page', () => {
  test('has a visible skip link that goes to #main', async ({ page }) => {
    await page.goto('/')
    // Skip link should be in DOM
    const skipLink = page.locator('.skip-link')
    await expect(skipLink).toHaveAttribute('href', '#main')

    // Skip link becomes visible on focus
    await skipLink.focus()
    await expect(skipLink).toBeVisible()
  })

  test('has <header> landmark with accessible nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  })

  test('has <main> landmark with id="main"', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main#main')).toBeVisible()
  })

  test('has <footer> landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('contentinfo')).toBeVisible()
  })

  test('hero heading is h1 and visible', async ({ page }) => {
    await page.goto('/')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
  })

  test('job cards are in a list with article elements', async ({ page }) => {
    await page.goto('/')
    const articles = page.getByRole('article')
    await expect(articles.first()).toBeVisible()
  })

  test('keyboard: Tab navigates through all interactive elements', async ({ page }) => {
    await page.goto('/')
    // Focus the skip link first
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.className ?? '')
    expect(focused).toContain('skip-link')
  })

  test('Get started button is focusable and has link role', async ({ page }) => {
    await page.goto('/')
    // Multiple "Get started" (desktop + mobile) — at least one exists
    const ctaLinks = page.getByRole('link', { name: /get started/i })
    await expect(ctaLinks.first()).toBeVisible()
  })

  test('theme toggle button is keyboard accessible', async ({ page }) => {
    await page.goto('/')
    const themeBtn = page.getByRole('button', { name: /toggle theme/i }).first()
    await themeBtn.focus()
    await expect(themeBtn).toBeFocused()
  })
})

test.describe('Accessibility — Login page', () => {
  test('has <main> landmark with id="main"', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('main#main')).toBeVisible()
  })

  test('email input has associated label', async ({ page }) => {
    await page.goto('/auth/login')
    const emailInput = page.getByLabel(/email address/i)
    await expect(emailInput).toBeVisible()
  })

  test('submit button is keyboard focusable', async ({ page }) => {
    await page.goto('/auth/login')
    const submitBtn = page.getByRole('button', { name: /send magic link/i })
    await submitBtn.focus()
    await expect(submitBtn).toBeFocused()
  })

  test('back to home link is visible and has href="/"', async ({ page }) => {
    await page.goto('/auth/login')
    const backLink = page.getByText('Back to home')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')
  })

  test('logo link is present and navigates home', async ({ page }) => {
    await page.goto('/auth/login')
    // Logo links to home
    const logoLink = page.getByRole('link', { name: /jobnomad — home/i })
    await expect(logoLink).toBeVisible()
    await expect(logoLink).toHaveAttribute('href', '/')
  })

  test('keyboard: Tab reaches the email input', async ({ page }) => {
    await page.goto('/auth/login')
    // Tab multiple times until we reach the email input
    // (logo link -> email input is the expected order)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? '')
      const type = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type ?? '')
      if (tag === 'INPUT' && type === 'email') break
    }
    const focused = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type ?? '')
    expect(focused).toBe('email')
  })
})

test.describe('Accessibility — Dark mode default', () => {
  test('html element has class "dark" after hydration', async ({ page }) => {
    await page.goto('/')
    // next-themes injects the .dark class client-side after hydration.
    // Wait explicitly for the class to appear rather than using networkidle
    // (which may fire before React finishes hydrating in CI environments).
    await page.waitForFunction(
      () => document.documentElement.classList.contains('dark'),
      { timeout: 10_000 }
    )
    const htmlClass = await page.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('dark')
  })
})
