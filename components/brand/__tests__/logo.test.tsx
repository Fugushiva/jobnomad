/**
 * Brand mark tests — Logo + LogoMark components
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LogoMark } from '../logo-mark'
import { Logo } from '../logo'

// Mock next/link for unit tests
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

afterEach(() => cleanup())

describe('LogoMark', () => {
  it('renders as aria-hidden SVG by default', () => {
    const { container } = render(<LogoMark />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders at correct size (default 28px)', () => {
    const { container } = render(<LogoMark size={28} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('28')
    expect(svg?.getAttribute('height')).toBe('20')
  })

  it('renders at 56px size (scale 2x)', () => {
    const { container } = render(<LogoMark size={56} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('56')
    expect(svg?.getAttribute('height')).toBe('40')
  })

  it('renders all brand elements (2 horizon lines, sun arc, dot)', () => {
    const { container } = render(<LogoMark />)
    const lines = container.querySelectorAll('line')
    const paths = container.querySelectorAll('path')
    const circles = container.querySelectorAll('circle')
    expect(lines).toHaveLength(2)
    expect(paths).toHaveLength(1)
    expect(circles).toHaveLength(1)
  })

  it('default variant uses accent color for sun', () => {
    const { container } = render(<LogoMark variant="default" />)
    const path = container.querySelector('path')
    expect(path?.getAttribute('fill')).toBe('var(--accent)')
  })

  it('on-primary variant uses white for horizon', () => {
    const { container } = render(<LogoMark variant="on-primary" />)
    const lines = container.querySelectorAll('line')
    expect(lines[0]?.getAttribute('stroke')).toBe('white')
  })

  it('mono variant uses currentColor for all elements', () => {
    const { container } = render(<LogoMark variant="mono" />)
    const path = container.querySelector('path')
    const circle = container.querySelector('circle')
    expect(path?.getAttribute('fill')).toBe('currentColor')
    expect(circle?.getAttribute('fill')).toBe('currentColor')
  })
})

describe('Logo', () => {
  it('renders as a link with correct href', () => {
    const { getByRole } = render(<Logo href="/" label="JobNomad home" />)
    const link = getByRole('link', { name: 'JobNomad home' })
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/')
  })

  it('renders the wordmark text within the link', () => {
    const { container } = render(<Logo label="test" />)
    const span = container.querySelector('span')
    expect(span?.textContent).toContain('JobNomad')
  })

  it('renders as div with role="img" when asDiv=true', () => {
    const { getByRole } = render(<Logo asDiv label="JobNomad logo" />)
    const div = getByRole('img', { name: 'JobNomad logo' })
    expect(div).not.toBeNull()
  })

  it('renders custom href correctly', () => {
    const { getByRole } = render(<Logo href="/about" label="JobNomad about" />)
    const link = getByRole('link', { name: 'JobNomad about' })
    expect(link.getAttribute('href')).toBe('/about')
  })

  const variants = ['default', 'on-primary', 'mono-positive', 'mono-inverse'] as const
  variants.forEach((variant) => {
    it(`renders variant="${variant}" without error`, () => {
      expect(() => render(<Logo variant={variant} label={`test-${variant}`} />)).not.toThrow()
    })
  })
})
