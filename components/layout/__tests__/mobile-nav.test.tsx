/**
 * MobileNav component tests — structure, accessibility, and security.
 *
 * Architecture note:
 *   MobileNav renders a Radix Dialog (via Sheet) whose content is mounted in
 *   a portal only after the trigger is clicked. In happy-dom, Radix portal
 *   lifecycle (pointer events, animation end) does not run synchronously, so
 *   testing the full Sheet open/close cycle is unreliable.
 *
 *   Strategy: We test `MobileNavContent` directly (exported from mobile-nav.tsx
 *   for this purpose). MobileNavContent contains all the links and actions —
 *   it is the semantic contract we care about. MobileNav itself is tested at a
 *   structural level (trigger button exists, MobileNavContent receives correct
 *   props via integration with Header tests + E2E).
 *
 * Security note:
 *   The "Sign out is a form submit, not a link" test is a REGRESSION GUARD.
 *   GET-based logout is a CSRF vulnerability. This test must never be removed
 *   without a security review. See mobile-nav.tsx JSDoc for the full contract.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MobileNav, MobileNavContent } from '../mobile-nav'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Mocks — minimal, consistent with header.test.tsx and user-menu.test.tsx
// ---------------------------------------------------------------------------

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock Logo (no SVG complexity in layout tests)
vi.mock('@/components/brand/logo', () => ({
  Logo: ({ label, asDiv }: { label?: string; asDiv?: boolean }) => {
    const Tag = asDiv ? 'div' : 'a'
    return <Tag aria-label={label ?? 'JobNomad'}>JobNomad</Tag>
  },
}))

// Mock Button (avoid Radix Slot complexity)
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild: _asChild,
    ...props
  }: { children: React.ReactNode; asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

/**
 * Mock the signOut Server Action.
 * We verify the form structure (CSRF safety), not that the action executes.
 * Actual signOut behavior is tested in src/lib/auth/__tests__/signout.test.ts.
 */
vi.mock('@/src/lib/auth/actions', () => ({
  signOut: vi.fn(),
}))

/**
 * Mock the Sheet primitives.
 *
 * Radix Sheet (Dialog) uses portals + pointer-event animations to mount
 * SheetContent. In happy-dom these do not fire synchronously.
 * We replace the Sheet with a simple structure that renders children directly
 * so MobileNav's outer wrapper can be tested for the trigger button.
 *
 * MobileNavContent is tested separately and more thoroughly below.
 */
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet">{children}</div>
  ),
  SheetTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div data-testid="sheet-trigger">{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div data-testid="sheet-title">{children}</div>,
  SheetClose: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-close">{children}</div>
  ),
}))

// ---------------------------------------------------------------------------
// MobileNav (wrapper) — structural tests
// ---------------------------------------------------------------------------

describe('MobileNav — burger trigger', () => {
  it('renders the burger button with accessible label', () => {
    render(<MobileNav variant="public" />)
    const btn = screen.getByRole('button', { name: /open navigation menu/i })
    expect(btn).not.toBeNull()
  })

  it('renders the burger button in public variant', () => {
    render(<MobileNav variant="public" />)
    expect(screen.getByRole('button', { name: /open navigation menu/i })).not.toBeNull()
  })

  it('renders the burger button in app variant', () => {
    render(<MobileNav variant="app" userEmail="user@example.com" />)
    expect(screen.getByRole('button', { name: /open navigation menu/i })).not.toBeNull()
  })

  it('defaults to public variant when no variant prop is provided', () => {
    render(<MobileNav />)
    // Should not crash and should render a burger
    expect(screen.getByRole('button', { name: /open navigation menu/i })).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MobileNavContent — public variant
// ---------------------------------------------------------------------------

describe('MobileNavContent — public variant', () => {
  const noOp = vi.fn()

  it('renders the mobile nav landmark', () => {
    const { container } = render(<MobileNavContent variant="public" onClose={noOp} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')
    expect(nav).not.toBeNull()
  })

  it('renders Browse jobs nav link', () => {
    render(<MobileNavContent variant="public" onClose={noOp} />)
    const link = screen.getByRole('link', { name: /browse jobs/i })
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/jobs')
  })

  it('renders Sign in link', () => {
    render(<MobileNavContent variant="public" onClose={noOp} />)
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
    expect(signInLinks.length).toBeGreaterThanOrEqual(1)
    expect(signInLinks[0]?.getAttribute('href')).toBe('/auth/login')
  })

  it('renders Get started link', () => {
    render(<MobileNavContent variant="public" onClose={noOp} />)
    const ctaLinks = screen.getAllByRole('link', { name: /get started/i })
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1)
    expect(ctaLinks[0]?.getAttribute('href')).toBe('/auth/login')
  })

  it('does NOT render Sign out in public variant', () => {
    render(<MobileNavContent variant="public" onClose={noOp} />)
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('does NOT render Settings link in public variant', () => {
    render(<MobileNavContent variant="public" onClose={noOp} />)
    expect(screen.queryByRole('link', { name: /settings/i })).toBeNull()
  })

  it('does NOT render user email in public variant', () => {
    render(<MobileNavContent variant="public" onClose={noOp} />)
    // No email paragraph should be in the DOM
    expect(screen.queryByTitle(/@/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MobileNavContent — app variant WITH userEmail
// ---------------------------------------------------------------------------

describe('MobileNavContent — app variant (authenticated)', () => {
  const noOp = vi.fn()

  it('renders the mobile nav landmark', () => {
    const { container } = render(
      <MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />
    )
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')
    expect(nav).not.toBeNull()
  })

  it('renders Feed nav link', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const link = screen.getByRole('link', { name: /feed/i })
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/feed')
  })

  it('renders Saved nav link', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const link = screen.getByRole('link', { name: /saved/i })
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/saved')
  })

  it('renders Settings link', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const link = screen.getByRole('link', { name: /settings/i })
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/settings')
  })

  it('displays the user email', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    expect(screen.getByText('alice@example.com')).not.toBeNull()
  })

  it('does NOT render Sign in or Get started in app variant', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /get started/i })).toBeNull()
  })

  // -------------------------------------------------------------------------
  // SECURITY REGRESSION GUARDS — Sign out
  //
  // These tests enforce the CSRF-safe logout contract.
  // NEVER REMOVE without a security review.
  // -------------------------------------------------------------------------

  it('[SECURITY] Sign out button is type="submit"', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const btn = screen.getByRole('button', { name: /sign out/i })
    expect(btn.getAttribute('type')).toBe('submit')
  })

  it('[SECURITY] Sign out button is inside a <form> element (CSRF protection)', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const btn = screen.getByRole('button', { name: /sign out/i })
    const form = btn.closest('form')
    expect(form).not.toBeNull()
  })

  it('[SECURITY] Sign out form does not use method="GET"', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const btn = screen.getByRole('button', { name: /sign out/i })
    const form = btn.closest('form')
    const method = form?.getAttribute('method')
    // method is null (Server Action default = POST) or explicitly "post"
    // Either way it must NOT be "get"
    expect(method?.toLowerCase()).not.toBe('get')
  })

  it('[SECURITY] Sign out is NOT an <a> link (GET-based logout is a CSRF vulnerability)', () => {
    const { container } = render(
      <MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />
    )
    const signOutLinks = Array.from(container.querySelectorAll('a')).filter((a) =>
      a.textContent?.toLowerCase().includes('sign out')
    )
    expect(signOutLinks).toHaveLength(0)
  })

  it('Sign out button has a decorative icon (aria-hidden svg)', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const btn = screen.getByRole('button', { name: /sign out/i })
    // The LogOut icon should be aria-hidden (decorative, text label carries meaning)
    const icon = btn.querySelector('svg[aria-hidden="true"]')
    expect(icon).not.toBeNull()
  })

  it('Sign out button has visible text (not icon-only)', () => {
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={noOp} />)
    const btn = screen.getByRole('button', { name: /sign out/i })
    expect(btn.textContent).toMatch(/sign out/i)
  })

  it('nav links call onClose when clicked', () => {
    const onClose = vi.fn()
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={onClose} />)
    const feedLink = screen.getByRole('link', { name: /feed/i })
    feedLink.click()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Settings link calls onClose when clicked', () => {
    const onClose = vi.fn()
    render(<MobileNavContent variant="app" userEmail="alice@example.com" onClose={onClose} />)
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    settingsLink.click()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// MobileNavContent — app variant WITHOUT userEmail
// ---------------------------------------------------------------------------

describe('MobileNavContent — app variant (no email)', () => {
  const noOp = vi.fn()

  it('does NOT render the account section when userEmail is absent', () => {
    render(<MobileNavContent variant="app" onClose={noOp} />)
    // No sign out button
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
    // No settings link
    expect(screen.queryByRole('link', { name: /settings/i })).toBeNull()
  })

  it('still renders Feed and Saved nav links without userEmail', () => {
    render(<MobileNavContent variant="app" onClose={noOp} />)
    expect(screen.getByRole('link', { name: /feed/i })).not.toBeNull()
    expect(screen.getByRole('link', { name: /saved/i })).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// nav-links parity — ensure mobile links match desktop nav-links module
// ---------------------------------------------------------------------------

describe('MobileNavContent — link parity with nav-links module', () => {
  const noOp = vi.fn()

  it('public variant: all NAV_LINKS_PUBLIC hrefs are present', async () => {
    const { NAV_LINKS_PUBLIC } = await import('@/components/layout/nav-links')
    const { container } = render(<MobileNavContent variant="public" onClose={noOp} />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')
    for (const link of NAV_LINKS_PUBLIC) {
      const el = nav?.querySelector(`a[href="${link.href}"]`)
      expect(el, `Expected link to ${link.href} (${link.label}) in mobile nav`).not.toBeNull()
    }
  })

  it('app variant: all NAV_LINKS_APP hrefs are present', async () => {
    const { NAV_LINKS_APP } = await import('@/components/layout/nav-links')
    const { container } = render(
      <MobileNavContent variant="app" userEmail="test@example.com" onClose={noOp} />
    )
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')
    for (const link of NAV_LINKS_APP) {
      const el = nav?.querySelector(`a[href="${link.href}"]`)
      expect(el, `Expected link to ${link.href} (${link.label}) in mobile nav`).not.toBeNull()
    }
  })
})
