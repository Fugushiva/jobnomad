/**
 * Header component tests -- a11y + navigation + logout
 *
 * Scope:
 *   - Public variant: CTAs, nav links, mobile trigger
 *   - App variant: user menu trigger, avatar, nav links, conditional rendering
 *   - Accessibility landmarks
 *
 * Note: Logout button security tests (form structure, icon, CSRF protection)
 * live in user-menu.test.tsx where UserMenu is rendered in isolation. This
 * avoids Radix UI portal issues in happy-dom (portals require async pointer
 * events that happy-dom doesn't simulate synchronously).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Header } from '../header'

afterEach(() => cleanup())

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), resolvedTheme: 'dark' }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock Logo (to avoid SVG complexity in layout tests)
vi.mock('@/components/brand/logo', () => ({
  Logo: ({ label }: { label?: string }) => <div aria-label={label ?? 'JobNomad'}>JobNomad</div>,
}))

// ThemeToggle is loaded via next/dynamic (ssr:false). Mock the module so the
// toggle renders in the Vitest environment (no SSR boundary here).
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ ThemeToggle: React.ComponentType }>) => {
    let Comp: React.ComponentType | null = null
    loader().then((m) => { Comp = m.ThemeToggle })
    return function DynamicThemeToggle(props: object) {
      if (!Comp) return <div className="h-9 w-9" aria-hidden="true" />
      const C = Comp
      return <C {...props} />
    }
  },
}))

/**
 * Mock MobileNav so Header tests don't need to set up the full Sheet
 * environment. We capture the props passed to verify Header forwards them
 * correctly. MobileNav's own behavior is tested in mobile-nav.test.tsx.
 */
vi.mock('../mobile-nav', () => ({
  MobileNav: ({ variant, userEmail }: { variant?: string; userEmail?: string }) => (
    <div
      data-testid="mobile-nav"
      data-variant={variant}
      data-user-email={userEmail}
    >
      <button aria-label="Open navigation menu">menu</button>
    </div>
  ),
}))

/**
 * Mock the signOut Server Action.
 *
 * Server Actions are imported at the module level in header.tsx. We mock the
 * entire module so the Client Component can import it without requiring a
 * Node.js server runtime. The mock is a no-op — we only care that the form
 * wires it correctly, not that it actually signs the user out (that is tested
 * separately in src/lib/auth/__tests__/signout.test.ts).
 */
vi.mock('@/src/lib/auth/actions', () => ({
  signOut: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Public variant
// ---------------------------------------------------------------------------

describe('Header -- public variant', () => {
  it('renders skip-link targeting #main', () => {
    const { container } = render(<Header variant="public" />)
    const skipLink = container.querySelector('.skip-link')
    expect(skipLink).not.toBeNull()
    expect(skipLink?.getAttribute('href')).toBe('#main')
  })

  it('renders Sign in link', () => {
    render(<Header variant="public" />)
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
    expect(signInLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Get started link', () => {
    render(<Header variant="public" />)
    const ctaLinks = screen.getAllByRole('link', { name: /get started/i })
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Browse jobs nav link', () => {
    render(<Header variant="public" />)
    const browseLinks = screen.getAllByRole('link', { name: /browse jobs/i })
    expect(browseLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders mobile menu trigger button', () => {
    render(<Header variant="public" />)
    const menuBtn = screen.getByRole('button', { name: /open navigation menu/i })
    expect(menuBtn).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// App variant
// ---------------------------------------------------------------------------

describe('Header -- app variant', () => {
  it('renders Feed nav link', () => {
    render(<Header variant="app" userEmail="test@example.com" />)
    const feedLinks = screen.getAllByRole('link', { name: /feed/i })
    expect(feedLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Saved nav link', () => {
    render(<Header variant="app" userEmail="test@example.com" />)
    const savedLinks = screen.getAllByRole('link', { name: /saved/i })
    expect(savedLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders user avatar menu trigger with accessible label', () => {
    render(<Header variant="app" userEmail="user@example.com" />)
    const userMenu = screen.getByRole('button', { name: /user menu for user@example.com/i })
    expect(userMenu).not.toBeNull()
  })

  it('does NOT render Sign in or Get started in app variant', () => {
    render(<Header variant="app" userEmail="user@example.com" />)
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /get started/i })).toBeNull()
  })

  it('avatar shows initials derived from email local part', () => {
    render(<Header variant="app" userEmail="alice@example.com" />)
    // "alice" -> slice(0,2).toUpperCase() = "AL"
    expect(screen.getByText('AL')).not.toBeNull()
  })

  it('avatar initials are uppercase', () => {
    render(<Header variant="app" userEmail="bob@example.com" />)
    const initialsEl = screen.getByText('BO')
    expect(initialsEl.textContent).toBe('BO')
  })

  it('does not render UserMenu when userEmail is absent in app variant', () => {
    render(<Header variant="app" />)
    // No avatar trigger rendered without email
    expect(screen.queryByRole('button', { name: /user menu/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('Header -- accessibility', () => {
  it('has a <header> landmark element', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).not.toBeNull()
  })

  it('desktop nav has aria-label', () => {
    const { container } = render(<Header />)
    const nav = container.querySelector('nav[aria-label="Main navigation"]')
    expect(nav).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MobileNav prop forwarding
//
// Verifies that Header passes the correct variant and userEmail to MobileNav.
// MobileNav's own behavior (links, sign out, a11y) is tested in mobile-nav.test.tsx.
// ---------------------------------------------------------------------------

describe('Header -- MobileNav prop forwarding', () => {
  it('passes variant="public" to MobileNav', () => {
    const { container } = render(<Header variant="public" />)
    const mobileNav = container.querySelector('[data-testid="mobile-nav"]')
    expect(mobileNav?.getAttribute('data-variant')).toBe('public')
  })

  it('passes variant="app" to MobileNav', () => {
    const { container } = render(<Header variant="app" userEmail="test@example.com" />)
    const mobileNav = container.querySelector('[data-testid="mobile-nav"]')
    expect(mobileNav?.getAttribute('data-variant')).toBe('app')
  })

  it('passes userEmail to MobileNav in app variant', () => {
    const { container } = render(<Header variant="app" userEmail="alice@example.com" />)
    const mobileNav = container.querySelector('[data-testid="mobile-nav"]')
    expect(mobileNav?.getAttribute('data-user-email')).toBe('alice@example.com')
  })

  it('passes undefined userEmail to MobileNav when not provided', () => {
    const { container } = render(<Header variant="app" />)
    const mobileNav = container.querySelector('[data-testid="mobile-nav"]')
    // data-user-email attribute should be absent or empty when userEmail is undefined
    const attr = mobileNav?.getAttribute('data-user-email')
    expect(attr === null || attr === 'undefined' || attr === '').toBe(true)
  })

  it('MobileNav is rendered inside the mobile-only container', () => {
    const { container } = render(<Header variant="public" />)
    // The mobile container has class "flex md:hidden"
    const mobileArea = container.querySelector('.\\[flex\\].\\[md\\:hidden\\]') ??
      Array.from(container.querySelectorAll('div')).find(
        (el) => el.className.includes('md:hidden') && el.className.includes('flex')
      )
    expect(mobileArea).not.toBeNull()
    // MobileNav should be a descendant of the mobile area
    const mobileNav = mobileArea?.querySelector('[data-testid="mobile-nav"]')
    expect(mobileNav).not.toBeNull()
  })
})
