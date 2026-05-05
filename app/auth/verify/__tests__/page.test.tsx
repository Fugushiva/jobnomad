/**
 * /auth/verify page — unit tests.
 *
 * Covers:
 *  1. Correct metadata (title, description).
 *  2. Renders <main id="main"> (skip-link target).
 *  3. Logo is present.
 *  4. "Check your email" heading rendered as <h1>.
 *  5. Mail icon with motion-safe:animate-pulse class (accessible animation).
 *  6. "Use a different email" link → /auth/login (primary back-link).
 *  7. "Back to home" link → / (secondary back-link).
 *  8. Both footer links are outside the Card.
 *  9. No inline style attribute on any rendered element (regression guard).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import VerifyPage, { metadata } from '../page'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/brand/logo', () => ({
  Logo: ({ href, label }: { href: string; label: string }) => (
    <a href={href} aria-label={label} data-testid="logo">
      JobNomad
    </a>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/auth/verify page', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Check your email — JobNomad')
  })

  it('exports metadata description', () => {
    expect(metadata.description).toBeTruthy()
  })

  it('renders <main id="main"> for skip-link', () => {
    const { container } = render(<VerifyPage />)
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.getAttribute('id')).toBe('main')
  })

  it('renders the Logo', () => {
    render(<VerifyPage />)
    expect(screen.getByTestId('logo')).toBeTruthy()
  })

  it('renders "Check your email" as <h1>', () => {
    render(<VerifyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeTruthy()
  })

  it('renders the mail icon with motion-safe:animate-pulse class', () => {
    const { container } = render(<VerifyPage />)
    // The decorative circle wrapping the mail SVG
    const iconDiv = container.querySelector('.motion-safe\\:animate-pulse')
    expect(iconDiv).not.toBeNull()
  })

  it('mail icon circle has aria-hidden="true"', () => {
    const { container } = render(<VerifyPage />)
    const iconDiv = container.querySelector('.motion-safe\\:animate-pulse')
    expect(iconDiv?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders a "Use a different email" link pointing to /auth/login', () => {
    render(<VerifyPage />)
    const link = screen.getByRole('link', { name: /use a different email/i })
    expect(link.getAttribute('href')).toBe('/auth/login')
  })

  it('renders a "Back to home" link pointing to "/"', () => {
    render(<VerifyPage />)
    // There are two links that could mention home — get the back to home one
    const links = screen.getAllByRole('link')
    const homeLink = links.find(l => l.getAttribute('href') === '/' && !/logo|jobnomad/i.test(l.getAttribute('aria-label') ?? ''))
    expect(homeLink).toBeTruthy()
  })

  it('"Use a different email" link is outside the Card', () => {
    render(<VerifyPage />)
    const card = screen.getByTestId('card')
    const link = screen.getByRole('link', { name: /use a different email/i })
    expect(card.contains(link)).toBe(false)
  })

  it('"Back to home" link is outside the Card', () => {
    const { container } = render(<VerifyPage />)
    const card = screen.getByTestId('card')
    // Find back to home link (href="/" that isn't the logo)
    const allLinks = container.querySelectorAll('a[href="/"]')
    // There will be logo (aria-label="JobNomad — home") + back to home link
    const backLink = Array.from(allLinks).find(
      l => !l.getAttribute('aria-label')?.includes('JobNomad')
    )
    expect(backLink).toBeTruthy()
    expect(card.contains(backLink!)).toBe(false)
  })

  it('has no inline style attributes (regression guard — all styling via Tailwind)', () => {
    /**
     * The old verify page used inline `style={{ backgroundColor: 'var(--bg)' }}` etc.
     * This test guards against regression: after the polish, only SVG stroke/fill
     * inline styles are allowed (SVG attributes, not CSS style attributes).
     */
    const { container } = render(<VerifyPage />)
    // Collect all elements with a `style` attribute
    const allElements = container.querySelectorAll('[style]')
    // Filter out SVG stroke/fill attributes (those are SVG presentation attributes,
    // not CSS style properties — they appear as `style` on the SVG element itself
    // when set via React props like stroke="var(--primary)")
    // In practice, SVG stroke/fill set as JSX props are NOT style attributes in the DOM.
    // So any `style` attribute is a genuine inline CSS style.
    expect(allElements.length).toBe(0)
  })
})
