/**
 * /auth/error page — unit tests.
 *
 * This is an async Server Component that reads searchParams.
 * We render it with `await` to resolve the async component.
 *
 * Covers:
 *  1. Correct metadata (title, description).
 *  2. Renders <main id="main">.
 *  3. Logo present.
 *  4. Table-driven: each known `reason` key renders the correct title.
 *  5. Unknown reason → default "Something went wrong" message.
 *  6. Missing reason → default message.
 *  7. SECURITY: the raw `reason` query param value is NEVER rendered in the DOM.
 *  8. SECURITY: no stack trace / internal message visible.
 *  9. "Try again" button/link → /auth/login.
 * 10. "Back to home" link → /.
 * 11. No inline style attributes (regression guard).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AuthErrorPage, { metadata } from '../page'

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

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    className,
    ...props
  }: {
    children: React.ReactNode
    asChild?: boolean
    className?: string
    [key: string]: unknown
  }) => {
    if (asChild) {
      // When asChild, render children directly (Radix Slot behaviour)
      return <>{children}</>
    }
    return (
      <button className={className} {...props}>
        {children}
      </button>
    )
  },
}))

// ---------------------------------------------------------------------------
// Helper — render the async Server Component
// ---------------------------------------------------------------------------

async function renderErrorPage(reason?: string) {
  const searchParams = Promise.resolve({ reason })
  const jsx = await AuthErrorPage({ searchParams })
  return render(jsx)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/auth/error page', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Authentication error — JobNomad')
  })

  it('exports metadata description', () => {
    expect(metadata.description).toBeTruthy()
  })

  it('renders <main id="main"> for skip-link', async () => {
    const { container } = await renderErrorPage()
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.getAttribute('id')).toBe('main')
  })

  it('renders the Logo', async () => {
    await renderErrorPage()
    expect(screen.getByTestId('logo')).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Error message mapping — table-driven
  // -------------------------------------------------------------------------

  const knownReasons = [
    { reason: 'missing_code',    expectedTitle: 'Invalid link' },
    { reason: 'link_expired',    expectedTitle: 'Link expired' },
    { reason: 'exchange_failed', expectedTitle: 'Sign-in failed' },
    { reason: 'signout_failed',  expectedTitle: 'Sign-out issue' },
  ] as const

  knownReasons.forEach(({ reason, expectedTitle }) => {
    it(`reason="${reason}" renders title "${expectedTitle}"`, async () => {
      await renderErrorPage(reason)
      expect(screen.getByRole('heading', { level: 1, name: expectedTitle })).toBeTruthy()
    })
  })

  it('unknown reason renders the default "Something went wrong" title', async () => {
    await renderErrorPage('totally_unknown_key_xyz')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' })
    ).toBeTruthy()
  })

  it('missing reason renders the default "Something went wrong" title', async () => {
    await renderErrorPage(undefined)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' })
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Security regression tests
  // -------------------------------------------------------------------------

  it('SECURITY: raw reason value is NOT rendered in DOM (XSS / enumeration guard)', async () => {
    const maliciousReason = 'totally_unknown_key_xyz'
    const { container } = await renderErrorPage(maliciousReason)
    // The raw reason string must not appear anywhere in the rendered HTML
    expect(container.innerHTML).not.toContain(maliciousReason)
  })

  it('SECURITY: crafted reason with HTML special chars is not reflected', async () => {
    const xssAttempt = '<script>alert(1)</script>'
    const { container } = await renderErrorPage(xssAttempt)
    // Must not appear literally in DOM (even escaped versions would be suspicious)
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).not.toContain('alert(1)')
  })

  it('SECURITY: no internal error details or stack trace in DOM', async () => {
    const { container } = await renderErrorPage('exchange_failed')
    // Common leak patterns
    expect(container.innerHTML).not.toMatch(/Error:|error:|stack:|at\s+\w+\s+\(/)
    expect(container.innerHTML).not.toContain('supabase')
    expect(container.innerHTML).not.toContain('TypeError')
  })

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  it('renders a "Try again" link/button pointing to /auth/login', async () => {
    await renderErrorPage('link_expired')
    const link = screen.getByRole('link', { name: /try again/i })
    expect(link.getAttribute('href')).toBe('/auth/login')
  })

  it('"Try again" link is outside the Card (footer position)', async () => {
    await renderErrorPage('link_expired')
    const card = screen.getByTestId('card')
    const link = screen.getByRole('link', { name: /try again/i })
    expect(card.contains(link)).toBe(false)
  })

  it('renders a "Back to home" link pointing to "/"', async () => {
    const { container } = await renderErrorPage()
    const allLinks = container.querySelectorAll('a[href="/"]')
    const backLink = Array.from(allLinks).find(
      l => !l.getAttribute('aria-label')?.includes('JobNomad')
    )
    expect(backLink).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Styling regression guard
  // -------------------------------------------------------------------------

  it('has no inline CSS style attributes (regression guard)', async () => {
    const { container } = await renderErrorPage('link_expired')
    const elementsWithStyle = container.querySelectorAll('[style]')
    expect(elementsWithStyle.length).toBe(0)
  })
})
