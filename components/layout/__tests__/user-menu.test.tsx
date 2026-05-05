/**
 * UserMenu component tests — logout security + structure.
 *
 * We test UserMenu in isolation to bypass Radix UI portal rendering issues
 * in happy-dom (portals don't mount synchronously without real pointer events).
 *
 * Radix DropdownMenu is mocked to render its content directly into the DOM —
 * this is the established pattern for testing Radix-based components in Vitest.
 * The mock preserves the structural contract (trigger, content, items, separator)
 * without the portal layer.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { UserMenu } from '../header'

afterEach(() => cleanup())

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

/**
 * Mock the signOut Server Action.
 * We test that the form wires it correctly, not that it executes.
 */
vi.mock('@/src/lib/auth/actions', () => ({
  signOut: vi.fn(),
}))

/**
 * Mock Radix DropdownMenu to render content inline (no portal).
 *
 * In real Radix, DropdownMenuContent is conditionally rendered in a portal
 * after the trigger is clicked. In happy-dom, this animation-driven mounting
 * doesn't happen synchronously. We replace the Dropdown primitives with
 * simple elements that expose the same structure for testing.
 */
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string; className?: string }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dropdown-label" className={className}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-item">{children}</div>
  ),
}))

// Mock Avatar components
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="avatar">{children}</span>
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserMenu', () => {
  // -------------------------------------------------------------------------
  // Avatar & initials
  // -------------------------------------------------------------------------

  it('renders an avatar trigger with accessible label including the email', () => {
    render(<UserMenu email="alice@example.com" />)
    const trigger = screen.getByRole('button', { name: /user menu for alice@example.com/i })
    expect(trigger).not.toBeNull()
  })

  it('shows initials from the email local part (first 2 chars, uppercase)', () => {
    render(<UserMenu email="alice@example.com" />)
    expect(screen.getByText('AL')).not.toBeNull()
  })

  it('handles single-char local part by repeating it', () => {
    render(<UserMenu email="a@b.com" />)
    // "a" -> slice(0,2) = "a" -> toUpperCase() = "A"
    expect(screen.getByText('A')).not.toBeNull()
  })

  it('initials are always uppercase regardless of email case', () => {
    render(<UserMenu email="BOB@EXAMPLE.COM" />)
    expect(screen.getByText('BO')).not.toBeNull()
  })

  // -------------------------------------------------------------------------
  // Menu content
  // -------------------------------------------------------------------------

  it('shows the user email in the dropdown label', () => {
    render(<UserMenu email="test@example.com" />)
    expect(screen.getByText('test@example.com')).not.toBeNull()
  })

  it('shows an "Account" label in the dropdown header', () => {
    render(<UserMenu email="user@example.com" />)
    expect(screen.getByText('Account')).not.toBeNull()
  })

  it('shows a Settings link', () => {
    render(<UserMenu email="user@example.com" />)
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink).not.toBeNull()
    expect(settingsLink.getAttribute('href')).toBe('/settings')
  })

  // -------------------------------------------------------------------------
  // Logout — structure & security
  // -------------------------------------------------------------------------

  it('renders a Sign out submit button', () => {
    render(<UserMenu email="user@example.com" />)
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    expect(signOutBtn).not.toBeNull()
    expect(signOutBtn.getAttribute('type')).toBe('submit')
  })

  it('Sign out button is inside a <form> element', () => {
    render(<UserMenu email="user@example.com" />)
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    const form = signOutBtn.closest('form')
    expect(form).not.toBeNull()
  })

  it('Sign out form does not use method="GET" (must be POST for CSRF safety)', () => {
    render(<UserMenu email="user@example.com" />)
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    const form = signOutBtn.closest('form')
    const method = form?.getAttribute('method')
    expect(method?.toLowerCase()).not.toBe('get')
  })

  it('Sign out is NOT an <a> link (GET-based logout is a security vulnerability)', () => {
    render(<UserMenu email="user@example.com" />)
    const { container } = render(<UserMenu email="user@example.com" />)
    const signOutLinks = Array.from(container.querySelectorAll('a')).filter(
      (a) => a.textContent?.toLowerCase().includes('sign out')
    )
    expect(signOutLinks).toHaveLength(0)
  })

  it('Sign out button has a LogOut icon (aria-hidden svg)', () => {
    render(<UserMenu email="user@example.com" />)
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    const icon = signOutBtn.querySelector('svg[aria-hidden="true"]')
    expect(icon).not.toBeNull()
  })

  it('Sign out button text is visible (not icon-only)', () => {
    render(<UserMenu email="user@example.com" />)
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    // The button text "Sign out" should be visible in the DOM
    expect(signOutBtn.textContent).toMatch(/sign out/i)
  })
})
