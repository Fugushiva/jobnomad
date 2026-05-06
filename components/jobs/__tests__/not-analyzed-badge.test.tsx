/**
 * Tests for NotAnalyzedBadge
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotAnalyzedBadge } from '../not-analyzed-badge'

describe('NotAnalyzedBadge', () => {
  it('renders without crashing', () => {
    expect(() => render(<NotAnalyzedBadge />)).not.toThrow()
  })

  it('displays "Not analyzed" text', () => {
    render(<NotAnalyzedBadge />)
    const els = screen.getAllByText('Not analyzed')
    expect(els.length).toBeGreaterThan(0)
  })

  it('has accessible label', () => {
    render(<NotAnalyzedBadge />)
    const badges = screen.getAllByLabelText('Red flags not yet analyzed')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('has a descriptive title attribute', () => {
    render(<NotAnalyzedBadge />)
    const badges = screen.getAllByLabelText('Red flags not yet analyzed')
    const withTitle = badges.find((el) =>
      (el.getAttribute('title') ?? '').includes('not yet been analyzed'),
    )
    expect(withTitle).not.toBeUndefined()
  })

  it('renders a clock icon (aria-hidden)', () => {
    const { container } = render(<NotAnalyzedBadge />)
    const svg = container.querySelector('svg[aria-hidden="true"]')
    expect(svg).not.toBeNull()
  })
})
