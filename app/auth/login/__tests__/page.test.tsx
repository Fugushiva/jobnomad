/**
 * /auth/login page — unit tests.
 *
 * Focuses on what is NOT covered by E2E (auth.spec.ts):
 *  - The page renders AuthLayout (structural test).
 *  - Metadata is exported (static assertion).
 *  - Footer contains the correct "Back to home" link to "/".
 *  - The LoginForm is rendered inside the layout.
 *
 * Note: LoginForm (client component) is mocked to keep this test focused
 * on page structure. LoginForm's own behaviour is covered by E2E.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import LoginPage, { metadata } from '../page'

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

// Mock LoginForm — its E2E behaviour is tested in e2e/auth.spec.ts
vi.mock('../login-form', () => ({
  LoginForm: () => <div data-testid="login-form" />,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/auth/login page', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Sign in — JobNomad')
  })

  it('exports correct metadata description (no password messaging)', () => {
    expect(metadata.description).toContain('magic link')
    expect(metadata.description).toContain('No password')
  })

  it('renders <main id="main"> for skip-link', () => {
    const { container } = render(<LoginPage />)
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.getAttribute('id')).toBe('main')
  })

  it('renders the Logo', () => {
    render(<LoginPage />)
    expect(screen.getByTestId('logo')).toBeTruthy()
  })

  it('renders the Sign in heading as <h1>', () => {
    render(<LoginPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
  })

  it('renders the subtitle with magic link copy', () => {
    render(<LoginPage />)
    const subtitle = screen.getByText(/magic link/i)
    expect(subtitle).toBeTruthy()
  })

  it('renders the LoginForm', () => {
    render(<LoginPage />)
    expect(screen.getByTestId('login-form')).toBeTruthy()
  })

  it('renders a "Back to home" link pointing to "/"', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /back to home/i })
    expect(link.getAttribute('href')).toBe('/')
  })

  it('"Back to home" link is outside the Card (footer position)', () => {
    render(<LoginPage />)
    const card = screen.getByTestId('card')
    const link = screen.getByRole('link', { name: /back to home/i })
    // The link must NOT be inside the Card
    expect(card.contains(link)).toBe(false)
  })
})
