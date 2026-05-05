/**
 * nav-links.ts — shared navigation link definitions.
 *
 * Single source of truth for nav items rendered in both:
 *   - Header desktop nav (hidden below md breakpoint)
 *   - MobileNav drawer (visible below md breakpoint)
 *
 * Rules:
 *   - Only include routes that actually exist in the app.
 *   - `as const` + `readonly` prevents accidental mutation from Client Components.
 *   - This is a pure TS module: no React, no side-effects, fully tree-shakeable.
 */

export type NavLink = {
  readonly href: string
  readonly label: string
}

/**
 * Links shown when the user is NOT authenticated (public / landing pages).
 * Must stay in sync with routes under app/ that don't require auth.
 */
export const NAV_LINKS_PUBLIC: readonly NavLink[] = [
  { href: '/jobs', label: 'Browse jobs' },
] as const

/**
 * Links shown when the user IS authenticated (app shell).
 * Must stay in sync with protected routes under app/(protected)/.
 *
 * Note: Settings is intentionally excluded here — it lives in the UserMenu
 * dropdown (desktop) and the account section (mobile drawer), not as a top
 * nav item. This mirrors the UX hierarchy: settings is contextual, not primary.
 */
export const NAV_LINKS_APP: readonly NavLink[] = [
  { href: '/feed', label: 'Feed' },
  { href: '/saved', label: 'Saved' },
] as const
