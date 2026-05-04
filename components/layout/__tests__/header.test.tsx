/**
 * Header component tests -- a11y + navigation
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
    // Resolve the module synchronously in test context
    let Comp: React.ComponentType | null = null
    loader().then((m) => { Comp = m.ThemeToggle })
    return function DynamicThemeToggle(props: object) {
      if (!Comp) {
        return <div className="h-9 w-9" aria-hidden="true" />
      }
      const C = Comp
      return <C {...props} />
    }
  },
}))

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

  it('renders user avatar menu with accessible label', () => {
    render(<Header variant="app" userEmail="user@example.com" />)
    const userMenu = screen.getByRole('button', { name: /user menu for user@example.com/i })
    expect(userMenu).not.toBeNull()
  })

  it('does NOT render Sign in or Get started in app variant', () => {
    render(<Header variant="app" userEmail="user@example.com" />)
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /get started/i })).toBeNull()
  })
})

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
