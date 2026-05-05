/**
 * E2E tests — Mobile navigation drawer (issue #40)
 *
 * These tests validate the MobileNav Sheet component at the browser level,
 * covering behaviours that cannot be reliably tested in happy-dom unit tests:
 *   - Responsive breakpoint visibility (Tailwind md:hidden / md:flex)
 *   - Radix Dialog portal lifecycle (focus trap, animation, overlay)
 *   - Real keyboard events (ESC, Tab)
 *   - Cross-page navigation after link click
 *
 * All tests use the public home page ("/") to avoid needing Supabase auth.
 * The public variant renders Browse jobs + Sign in + Get started in the drawer,
 * which is sufficient to validate the full open/close/navigate cycle.
 *
 * Viewport conventions:
 *   MOBILE_VIEWPORT — iPhone SE (375×667): drawer should be visible
 *   DESKTOP_VIEWPORT — MacBook Air (1280×800): drawer should be hidden
 */

import { test, expect, type Page } from '@playwright/test'

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const DESKTOP_VIEWPORT = { width: 1280, height: 800 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the navigation drawer on a mobile viewport. */
async function openDrawer(page: Page): Promise<void> {
  const burger = page.getByRole('button', { name: /open navigation menu/i })
  await expect(burger).toBeVisible()
  await burger.click()
  // Wait for Radix Dialog to animate in (data-state=open)
  await expect(page.getByRole('dialog')).toBeVisible()
}

// ---------------------------------------------------------------------------
// Breakpoint visibility
// ---------------------------------------------------------------------------

test.describe('MobileNav — breakpoint visibility', () => {
  test('burger button is visible on mobile (< 768px)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    const burger = page.getByRole('button', { name: /open navigation menu/i })
    await expect(burger).toBeVisible()
  })

  test('burger button is hidden on desktop (>= 768px)', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    // The burger sits in a div.md:hidden — Tailwind hides it above md.
    // We verify the button is not visible (may still be in the DOM).
    const burger = page.getByRole('button', { name: /open navigation menu/i })
    await expect(burger).toBeHidden()
  })

  test('desktop nav is visible on desktop (>= 768px)', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Open / Close mechanics
// ---------------------------------------------------------------------------

test.describe('MobileNav — open and close', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('clicking the burger opens the drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    // The Sheet dialog should be open
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
  })

  test('drawer contains the mobile nav landmark', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(mobileNav).toBeVisible()
  })

  test('pressing ESC closes the drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    await page.keyboard.press('Escape')

    // Dialog should no longer be visible (Radix animates it out)
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking the overlay closes the drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    // The Radix overlay covers the area outside the panel.
    // Click at top-left corner which is always outside the right-side panel.
    await page.mouse.click(10, 10)

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking the close (×) button closes the drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    // SheetContent renders a Radix DialogClose with an X icon
    const closeBtn = page.getByRole('button', { name: /close/i })
    await closeBtn.click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation links
// ---------------------------------------------------------------------------

test.describe('MobileNav — navigation links (public variant)', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('drawer contains Browse jobs link', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    const link = page.getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: /browse jobs/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/jobs')
  })

  test('drawer contains Sign in link', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    // Sign in appears in the auth CTA section below the nav
    const signInLinks = page.getByRole('link', { name: /sign in/i })
    await expect(signInLinks.first()).toBeVisible()
  })

  test('drawer contains Get started link', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    const ctaLinks = page.getByRole('link', { name: /get started/i })
    await expect(ctaLinks.first()).toBeVisible()
  })

  test('clicking Browse jobs navigates and closes the drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    const link = page.getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: /browse jobs/i })

    // Next.js navigation is client-side; wait for URL change
    await Promise.all([
      page.waitForURL('/jobs'),
      link.click(),
    ])

    // Drawer should be closed after navigation
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('clicking Sign in navigates and closes the drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    const signInLinks = page.getByRole('link', { name: /sign in/i })
    await Promise.all([
      page.waitForURL('/auth/login'),
      signInLinks.first().click(),
    ])

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test.describe('MobileNav — accessibility', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('drawer has role="dialog" (Radix Dialog)', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('drawer is labelled (aria-labelledby points to SheetTitle)', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    // Radix Dialog wires aria-labelledby to the DialogTitle element.
    // The SheetTitle contains the Logo with label="JobNomad".
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // aria-labelledby should be set (non-empty)
    const labelledBy = await dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
  })

  test('focus trap: Tab key keeps focus inside the open drawer', async ({ page }) => {
    await page.goto('/')
    await openDrawer(page)

    // Tab through all focusable elements — focus should never leave the dialog
    const dialog = page.getByRole('dialog')

    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      // Check that the focused element is within the dialog
      const isInsideDialog = await page.evaluate(() => {
        const active = document.activeElement
        const dialogEl = document.querySelector('[role="dialog"]')
        return dialogEl ? dialogEl.contains(active) : false
      })
      expect(isInsideDialog, `Tab press ${i + 1}: focus escaped the dialog`).toBe(true)
    }

    await expect(dialog).toBeVisible()
  })

  test('burger trigger is keyboard focusable', async ({ page }) => {
    await page.goto('/')

    const burger = page.getByRole('button', { name: /open navigation menu/i })
    await burger.focus()
    await expect(burger).toBeFocused()
  })

  test('theme toggle remains accessible on mobile (outside drawer)', async ({ page }) => {
    await page.goto('/')

    // ThemeToggle is rendered next to the burger in the mobile area
    // and should be accessible without opening the drawer
    const themeBtn = page.getByRole('button', { name: /toggle theme/i }).first()
    await expect(themeBtn).toBeVisible()
    await themeBtn.focus()
    await expect(themeBtn).toBeFocused()
  })
})

// ---------------------------------------------------------------------------
// Responsive: drawer does not appear at desktop widths
// ---------------------------------------------------------------------------

test.describe('MobileNav — responsive integrity', () => {
  test('drawer does not open at desktop width (burger hidden)', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    // The burger is not visible — clicking it should not be possible
    const burger = page.getByRole('button', { name: /open navigation menu/i })
    await expect(burger).toBeHidden()

    // Desktop nav links are visible instead
    const desktopNav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(desktopNav).toBeVisible()
  })

  test('resizing from desktop to mobile makes burger appear', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    // Burger hidden at desktop
    await expect(page.getByRole('button', { name: /open navigation menu/i })).toBeHidden()

    // Resize to mobile
    await page.setViewportSize(MOBILE_VIEWPORT)

    // Burger now visible
    await expect(page.getByRole('button', { name: /open navigation menu/i })).toBeVisible()
  })
})
