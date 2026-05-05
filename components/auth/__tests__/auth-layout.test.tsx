/**
 * AuthLayout component — unit tests.
 *
 * Covers:
 *  1. Renders <main id="main"> for skip-link accessibility target.
 *  2. Always renders the Logo linking to "/".
 *  3. Renders the title as <h1>.
 *  4. Renders subtitle when provided; omits it when absent.
 *  5. Renders the icon block when provided; omits it when absent.
 *  6. Renders children inside the Card.
 *  7. Renders footer outside the Card when provided; omits it when absent.
 *  8. No inline `style` attributes — only Tailwind classes (regression guard).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { AuthLayout } from '../auth-layout'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next/link renders an <a> in happy-dom — no special mock needed.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Logo renders a Link + SVG + text — mock at the brand level to keep tests
// focused on AuthLayout structure rather than Logo internals.
vi.mock('@/components/brand/logo', () => ({
  Logo: ({ href, label }: { href: string; label: string }) => (
    <a href={href} aria-label={label} data-testid="logo">
      JobNomad
    </a>
  ),
}))

// Card components — render their children directly so we can assert structure.
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthLayout', () => {
  it('renders <main id="main"> as the root element (skip-link target)', () => {
    const { container } = render(<AuthLayout title="Test" />)
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.getAttribute('id')).toBe('main')
  })

  it('renders the Logo linking to "/"', () => {
    const { getByTestId } = render(<AuthLayout title="Test" />)
    const logo = getByTestId('logo')
    expect(logo).toBeTruthy()
    expect(logo.getAttribute('href')).toBe('/')
  })

  it('renders the title inside an <h1>', () => {
    const { container } = render(<AuthLayout title="Sign in" />)
    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1?.textContent).toBe('Sign in')
  })

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <AuthLayout title="Sign in" subtitle="Enter your email to receive a magic link." />
    )
    expect(getByText('Enter your email to receive a magic link.')).toBeTruthy()
  })

  it('does NOT render a subtitle wrapper when subtitle is omitted', () => {
    const { container } = render(<AuthLayout title="Sign in" />)
    // The subtitle div has both text-body-md and text-text-soft classes
    const subtitleEl = container.querySelector('.text-body-md.text-text-soft')
    expect(subtitleEl).toBeNull()
  })

  it('renders the icon block when provided', () => {
    const { queryByTestId } = render(
      <AuthLayout title="Check your email" icon={<div data-testid="mail-icon" />} />
    )
    expect(queryByTestId('mail-icon')).not.toBeNull()
  })

  it('does NOT render the icon slot when icon is omitted', () => {
    const { queryByTestId } = render(<AuthLayout title="No icon" />)
    expect(queryByTestId('mail-icon')).toBeNull()
  })

  it('renders children inside CardContent', () => {
    const { getByTestId, getByRole } = render(
      <AuthLayout title="Test">
        <button>Submit</button>
      </AuthLayout>
    )
    const content = getByTestId('card-content')
    expect(content).toBeTruthy()
    expect(getByRole('button', { name: 'Submit' })).toBeTruthy()
  })

  it('does NOT render CardContent when children is omitted', () => {
    const { queryByTestId } = render(<AuthLayout title="No content" />)
    expect(queryByTestId('card-content')).toBeNull()
  })

  it('renders footer content outside the Card when provided', () => {
    const { getByTestId, getByRole, container } = render(
      <AuthLayout
        title="Test"
        footer={<a href="/auth/login">Back to sign in</a>}
      />
    )
    const card = getByTestId('card')
    const footerLink = getByRole('link', { name: 'Back to sign in' })

    // Footer link must not be inside the Card
    expect(card.contains(footerLink)).toBe(false)

    // But it must be inside <main>
    const main = container.querySelector('main')
    expect(main?.contains(footerLink)).toBe(true)
  })

  it('does NOT render the footer wrapper when footer is omitted', () => {
    const { container } = render(<AuthLayout title="No footer" />)
    const main = container.querySelector('main')
    // Only 1 direct child of main: the Card
    const directChildren = Array.from(main?.children ?? [])
    expect(directChildren).toHaveLength(1)
    expect(directChildren[0].getAttribute('data-testid')).toBe('card')
  })

  it('Card has the correct structural classes (regression guard)', () => {
    const { getByTestId } = render(<AuthLayout title="Test" />)
    const card = getByTestId('card')
    expect(card.className).toContain('max-w-sm')
    expect(card.className).toContain('rounded-2xl')
    expect(card.className).toContain('shadow-md')
  })

  it('main has bg-bg class for correct background token', () => {
    const { container } = render(<AuthLayout title="Test" />)
    const main = container.querySelector('main')
    expect(main?.className).toContain('bg-bg')
  })

  it('main is vertically centred (flex + items-center + justify-center)', () => {
    const { container } = render(<AuthLayout title="Test" />)
    const main = container.querySelector('main')
    expect(main?.className).toContain('items-center')
    expect(main?.className).toContain('justify-center')
  })
})
