/**
 * EmptyState + ErrorState tests
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EmptyState } from '../empty-state'
import { ErrorState } from '../error-state'
import { Bookmark } from 'lucide-react'

afterEach(() => cleanup())

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('EmptyState', () => {
  it('renders heading', () => {
    const { getByText } = render(<EmptyState heading="No saved jobs yet" />)
    expect(getByText('No saved jobs yet')).not.toBeNull()
  })

  it('renders description when provided', () => {
    const { getByText } = render(
      <EmptyState heading="test" description="Bookmark jobs to review later." />
    )
    expect(getByText('Bookmark jobs to review later.')).not.toBeNull()
  })

  it('renders icon when provided', () => {
    const { container } = render(<EmptyState icon={Bookmark} heading="test" />)
    const svg = container.querySelector('svg[aria-hidden]')
    expect(svg).not.toBeNull()
  })

  it('renders action link when href provided', () => {
    const { getByRole } = render(
      <EmptyState
        heading="test"
        action={{ label: 'Browse jobs', href: '/feed' }}
      />
    )
    const link = getByRole('link', { name: 'Browse jobs' })
    expect(link.getAttribute('href')).toBe('/feed')
  })

  it('renders action button when onClick provided', () => {
    const handleClick = vi.fn()
    const { getByRole } = render(
      <EmptyState
        heading="test"
        action={{ label: 'Retry', onClick: handleClick }}
      />
    )
    const btn = getByRole('button', { name: 'Retry' })
    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('has role=status for screen readers', () => {
    render(<EmptyState heading="test" />)
    expect(screen.getByRole('status')).not.toBeNull()
  })
})

describe('ErrorState', () => {
  it('renders default heading', () => {
    const { getByText } = render(<ErrorState />)
    expect(getByText('Something went wrong')).not.toBeNull()
  })

  it('renders custom heading and description', () => {
    render(<ErrorState heading="Load failed" description="Try refreshing." />)
    expect(screen.getByText('Load failed')).not.toBeNull()
    expect(screen.getByText('Try refreshing.')).not.toBeNull()
  })

  it('renders retry button and calls onRetry', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    const btn = screen.getByRole('button', { name: 'Try again' })
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not render retry button when onRetry absent', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('has role=alert with aria-live=assertive', () => {
    const { container } = render(<ErrorState />)
    const alert = container.querySelector('[role="alert"][aria-live="assertive"]')
    expect(alert).not.toBeNull()
  })

  it('renders AlertCircle icon (aria-hidden)', () => {
    const { container } = render(<ErrorState />)
    const svg = container.querySelector('svg[aria-hidden]')
    expect(svg).not.toBeNull()
  })
})
