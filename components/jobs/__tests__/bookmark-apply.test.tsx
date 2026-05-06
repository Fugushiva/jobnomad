/**
 * Tests for BookmarkButton and ApplyButton components.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSaveJob = vi.fn().mockResolvedValue({ success: true })
const mockUnsaveJob = vi.fn().mockResolvedValue({ success: true })
const mockToastError = vi.fn()

vi.mock('@/app/(protected)/saved/actions', () => ({
  saveJob: (...args: unknown[]) => mockSaveJob(...args),
  unsaveJob: (...args: unknown[]) => mockUnsaveJob(...args),
  updateSavedJobStatus: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/toast', () => ({
  toastError: (...args: unknown[]) => mockToastError(...args),
}))

import { BookmarkButton } from '../bookmark-button'
import { ApplyButton } from '../apply-button'

// ---------------------------------------------------------------------------
// BookmarkButton
// ---------------------------------------------------------------------------

describe('BookmarkButton', () => {
  it('renders with aria-label "Bookmark this job" when not bookmarked', () => {
    render(<BookmarkButton jobId="job-1" isBookmarked={false} />)
    const btn = screen.getByRole('button', { name: /bookmark this job/i })
    expect(btn).not.toBeNull()
  })

  it('renders with aria-label "Remove bookmark" when bookmarked', () => {
    render(<BookmarkButton jobId="job-1" isBookmarked={true} />)
    const btn = screen.getByRole('button', { name: /remove bookmark/i })
    expect(btn).not.toBeNull()
  })

  it('has aria-pressed=false when not bookmarked', () => {
    render(<BookmarkButton jobId="job-1" isBookmarked={false} />)
    const btn = screen.getByRole('button', { name: /bookmark this job/i })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('has aria-pressed=true when bookmarked', () => {
    render(<BookmarkButton jobId="job-1" isBookmarked={true} />)
    const btn = screen.getByRole('button', { name: /remove bookmark/i })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls saveJob when clicking to bookmark (not bookmarked)', async () => {
    render(<BookmarkButton jobId="job-42" isBookmarked={false} />)
    const btn = screen.getByRole('button', { name: /bookmark this job/i })
    fireEvent.click(btn)
    // Give the async transition a tick
    await new Promise((r) => setTimeout(r, 10))
    expect(mockSaveJob).toHaveBeenCalledWith('job-42')
  })

  it('calls unsaveJob when clicking to remove (bookmarked)', async () => {
    render(<BookmarkButton jobId="job-99" isBookmarked={true} />)
    const btn = screen.getByRole('button', { name: /remove bookmark/i })
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 10))
    expect(mockUnsaveJob).toHaveBeenCalledWith('job-99')
  })

  it('calls toastError when saveJob returns error', async () => {
    mockSaveJob.mockResolvedValueOnce({ error: 'Save failed' })
    render(<BookmarkButton jobId="job-err" isBookmarked={false} />)
    const btn = screen.getByRole('button', { name: /bookmark this job/i })
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 20))
    expect(mockToastError).toHaveBeenCalledWith('Save failed')
  })
})

// ---------------------------------------------------------------------------
// ApplyButton
// ---------------------------------------------------------------------------

describe('ApplyButton', () => {
  it('renders a link with the apply URL', () => {
    render(
      <ApplyButton
        jobId="job-1"
        applyUrl="https://example.com/apply"
        title="Engineer"
        company="Acme"
      />,
    )
    const link = screen.getByRole('link', { name: /apply to engineer at acme/i })
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('https://example.com/apply')
  })

  it('opens in a new tab (target=_blank)', () => {
    render(
      <ApplyButton
        jobId="job-1"
        applyUrl="https://example.com/apply"
        title="Engineer"
        company="Acme"
      />,
    )
    const link = screen.getByRole('link', { name: /apply to engineer at acme/i })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('fires sendBeacon on click', () => {
    const mockBeacon = vi.fn()
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockBeacon,
      writable: true,
    })

    render(
      <ApplyButton
        jobId="job-beacon"
        applyUrl="https://example.com/apply"
        title="Engineer"
        company="Acme"
      />,
    )
    const link = screen.getByRole('link', { name: /apply to engineer at acme/i })
    fireEvent.click(link)
    expect(mockBeacon).toHaveBeenCalledWith('/api/jobs/job-beacon/track-apply')
  })

  it('renders with correct aria-label including (opens in new tab)', () => {
    render(
      <ApplyButton
        jobId="job-1"
        applyUrl="https://example.com/apply"
        title="Senior Dev"
        company="StartupCo"
      />,
    )
    const link = screen.getByRole('link', {
      name: /apply to senior dev at startupco.*opens in new tab/i,
    })
    expect(link).not.toBeNull()
  })
})
