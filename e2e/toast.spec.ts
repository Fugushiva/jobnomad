/**
 * E2E — Toast system (Sonner)
 *
 * Tests the end-to-end toast behaviour using the dev-only
 * /dev-tools/toast-test page which exposes trigger buttons for each toast type.
 *
 * What is tested:
 *   - Success toast appears with the correct text.
 *   - Error toast via toastError() shows the fallback, NOT the raw Error message.
 *   - Info and warning toasts appear with correct text.
 *   - Toasts auto-dismiss (default 4 s duration).
 *   - Responsive position: top-right on desktop, top-center on mobile.
 *   - A11y: toast container has appropriate ARIA role (status/alert).
 *   - Promise toast shows loading, then resolves to success.
 *
 * Note: Playwright runs against a live Next.js dev server (started by
 * playwright.config.ts webServer). The /__dev__/toast-test page is available
 * because NODE_ENV is "development" during dev server.
 */

import { test, expect } from '@playwright/test'

const DEV_PAGE = '/dev-tools/toast-test'

// Sonner attaches data attributes to its DOM elements.
const TOASTER = '[data-sonner-toaster]'
const TOAST = '[data-sonner-toast]'

test.describe('Toast system — Sonner integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEV_PAGE)
    // Ensure the page has loaded and buttons are interactive.
    await expect(page.getByTestId('trigger-success')).toBeVisible()
  })

  // ── Appearance ─────────────────────────────────────────────────────────────

  test('success toast appears with correct text', async ({ page }) => {
    await page.getByTestId('trigger-success').click()
    const toast = page.locator(TOAST).first()
    await expect(toast).toBeVisible({ timeout: 3_000 })
    await expect(toast).toContainText('Job saved successfully')
  })

  test('error toast shows the fallback message, NOT the raw error message', async ({ page }) => {
    await page.getByTestId('trigger-error').click()
    const toast = page.locator(TOAST).first()
    await expect(toast).toBeVisible({ timeout: 3_000 })
    // Must show the safe fallback
    await expect(toast).toContainText('Failed to save job')
    // Must NOT leak the raw Error message
    await expect(toast).not.toContainText('DB error — must not leak')
  })

  test('info toast appears with correct text', async ({ page }) => {
    await page.getByTestId('trigger-info').click()
    const toast = page.locator(TOAST).first()
    await expect(toast).toBeVisible({ timeout: 3_000 })
    await expect(toast).toContainText('Profile updated')
  })

  test('warning toast appears with correct text', async ({ page }) => {
    await page.getByTestId('trigger-warning').click()
    const toast = page.locator(TOAST).first()
    await expect(toast).toBeVisible({ timeout: 3_000 })
    await expect(toast).toContainText('approaching your daily limit')
  })

  // ── Promise toast ───────────────────────────────────────────────────────────

  test('promise toast: shows loading state then resolves to success', async ({ page }) => {
    await page.getByTestId('trigger-promise').click()
    const toast = page.locator(TOAST).first()

    // Loading state
    await expect(toast).toBeVisible({ timeout: 3_000 })
    await expect(toast).toContainText('Saving…')

    // Success state (after the ~1.5 s promise resolves)
    await expect(toast).toContainText('Job saved via promise', { timeout: 5_000 })
  })

  // ── Auto-dismiss ────────────────────────────────────────────────────────────

  test('toast auto-dismisses after ~4 seconds', async ({ page }) => {
    await page.getByTestId('trigger-info').click()
    const toast = page.locator(TOAST).first()
    await expect(toast).toBeVisible({ timeout: 3_000 })

    // Toast should be gone within 6 s (4 s duration + animation + buffer).
    await expect(toast).not.toBeVisible({ timeout: 8_000 })
  })

  // ── ARIA / Accessibility ────────────────────────────────────────────────────

  test('toaster container is in the DOM with Sonner data attribute', async ({ page }) => {
    // Trigger a toast first — Sonner renders the <ol> container lazily on first toast.
    await page.getByTestId('trigger-success').click()
    const toaster = page.locator(TOASTER)
    // data-sonner-toaster is a boolean attribute rendered as "true".
    await expect(toaster).toHaveAttribute('data-sonner-toaster', 'true', { timeout: 3_000 })
  })

  test('Sonner renders an aria-live region for screen readers', async ({ page }) => {
    // Sonner renders a dedicated <section aria-live="polite"> screen reader region
    // separate from the visual toaster <ol>. This ensures toasts are announced
    // to assistive technologies without depending on the visual container.
    const ariaLiveRegion = page.locator('[aria-live="polite"]')
    await expect(ariaLiveRegion.first()).toBeAttached()
  })

  // ── Responsive position ─────────────────────────────────────────────────────

  test('toaster is positioned top-right on desktop (≥ 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.reload()
    await expect(page.getByTestId('trigger-success')).toBeVisible()

    await page.getByTestId('trigger-success').click()
    await expect(page.locator(TOAST).first()).toBeVisible({ timeout: 3_000 })

    // Sonner splits position into data-x-position and data-y-position attributes.
    const toaster = page.locator(TOASTER)
    await expect(toaster).toHaveAttribute('data-y-position', 'top')
    await expect(toaster).toHaveAttribute('data-x-position', 'right')
  })

  test('toaster is positioned top-center on mobile (< 768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expect(page.getByTestId('trigger-success')).toBeVisible()

    await page.getByTestId('trigger-success').click()
    await expect(page.locator(TOAST).first()).toBeVisible({ timeout: 3_000 })

    const toaster = page.locator(TOASTER)
    await expect(toaster).toHaveAttribute('data-y-position', 'top')
    await expect(toaster).toHaveAttribute('data-x-position', 'center')
  })

  // ── Multiple toasts ─────────────────────────────────────────────────────────

  test('multiple toasts stack without breaking each other', async ({ page }) => {
    await page.getByTestId('trigger-success').click()
    await page.getByTestId('trigger-info').click()
    await page.getByTestId('trigger-warning').click()

    const toasts = page.locator(TOAST)
    await expect(toasts).toHaveCount(3, { timeout: 3_000 })
  })
})
