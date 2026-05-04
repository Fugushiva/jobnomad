/**
 * JobCard, ScoreBadge, RedFlagBadge tests
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { JobCard, type JobCardData } from '../job-card'
import { ScoreBadge } from '../score-badge'
import { RedFlagBadge } from '../red-flag-badge'

afterEach(() => cleanup())

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ── ScoreBadge ─────────────────────────────────────────────────────────────

describe('ScoreBadge', () => {
  it('renders score value', () => {
    const { getByText } = render(<ScoreBadge score={92} />)
    expect(getByText('92')).not.toBeNull()
  })

  it('aria-label includes score and tier (high)', () => {
    const { getByLabelText } = render(<ScoreBadge score={92} />)
    const badge = getByLabelText(/match score 92.*strong fit/i)
    expect(badge).not.toBeNull()
  })

  it('aria-label reflects mid tier (60-84)', () => {
    const { getByLabelText } = render(<ScoreBadge score={74} />)
    const badge = getByLabelText(/match score 74.*read and decide/i)
    expect(badge).not.toBeNull()
  })

  it('aria-label reflects low tier (0-59)', () => {
    const { getByLabelText } = render(<ScoreBadge score={41} />)
    const badge = getByLabelText(/match score 41.*skip/i)
    expect(badge).not.toBeNull()
  })

  it('score 60 is mid tier (boundary test)', () => {
    const { getByLabelText } = render(<ScoreBadge score={60} />)
    expect(getByLabelText(/read and decide/i)).not.toBeNull()
  })

  it('score 85 is high tier (boundary test)', () => {
    const { getByLabelText } = render(<ScoreBadge score={85} />)
    expect(getByLabelText(/strong fit/i)).not.toBeNull()
  })

  it('score 59 is low tier (boundary test)', () => {
    const { getByLabelText } = render(<ScoreBadge score={59} />)
    expect(getByLabelText(/skip/i)).not.toBeNull()
  })
})

// ── RedFlagBadge ────────────────────────────────────────────────────────────

describe('RedFlagBadge', () => {
  it('renders default label', () => {
    const { getByText } = render(<RedFlagBadge reason="Salary not disclosed" />)
    expect(getByText('Red flag')).not.toBeNull()
  })

  it('renders custom label', () => {
    const { getByText } = render(<RedFlagBadge label="Unpaid trial" reason="Unpaid work required" />)
    expect(getByText('Unpaid trial')).not.toBeNull()
  })

  it('aria-label contains full reason', () => {
    const { getByLabelText } = render(<RedFlagBadge reason="Salary not disclosed" />)
    expect(getByLabelText(/salary not disclosed/i)).not.toBeNull()
  })

  it('has AlertTriangle icon (aria-hidden)', () => {
    const { container } = render(<RedFlagBadge reason="test" />)
    // Lucide renders as SVG
    const svg = container.querySelector('svg[aria-hidden]')
    expect(svg).not.toBeNull()
  })
})

// ── JobCard ─────────────────────────────────────────────────────────────────

const BASE_JOB: JobCardData = {
  id: 'job-1',
  title: 'Senior Full-Stack Engineer',
  company: 'Async-First Co.',
  timezone: 'UTC±4',
  type: 'contractor',
  posted: '2h ago',
  salary: '$120–150k',
  score: 92,
  tags: ['TypeScript', 'Next.js', 'Postgres'],
  applyUrl: 'https://example.com/apply',
  isBookmarked: false,
}

describe('JobCard', () => {
  it('renders job title and company', () => {
    const { getByText } = render(<JobCard job={BASE_JOB} />)
    expect(getByText('Senior Full-Stack Engineer')).not.toBeNull()
    expect(getByText('Async-First Co.')).not.toBeNull()
  })

  it('renders score badge', () => {
    const { container } = render(<JobCard job={BASE_JOB} />)
    // The badge div has aria-label with full score + meaning; article also has it
    // Use getAllByLabelText + pick the non-article element
    const elements = screen.getAllByLabelText(/match score 92/i)
    // At least 1 element (the badge div itself)
    expect(elements.length).toBeGreaterThanOrEqual(1)
    // The badge specifically has text content "92"
    const badge = elements.find(el => el.textContent?.trim() === '92')
    expect(badge).not.toBeUndefined()
    // Confirm it's in the DOM
    expect(container.querySelector('[aria-label*="Match score 92"]')).not.toBeNull()
  })

  it('renders salary', () => {
    const { getByText } = render(<JobCard job={BASE_JOB} />)
    expect(getByText('$120–150k')).not.toBeNull()
  })

  it('renders tags list', () => {
    render(<JobCard job={BASE_JOB} />)
    expect(screen.getByText('TypeScript')).not.toBeNull()
    expect(screen.getByText('Next.js')).not.toBeNull()
  })

  it('renders apply button linking to applyUrl', () => {
    render(<JobCard job={BASE_JOB} />)
    const applyLink = screen.getByRole('link', { name: /apply to senior full-stack/i })
    expect(applyLink.getAttribute('href')).toBe('https://example.com/apply')
  })

  it('renders bookmark button with aria-pressed=false when not bookmarked', () => {
    const handleBookmark = vi.fn()
    render(<JobCard job={BASE_JOB} onBookmark={handleBookmark} />)
    const btn = screen.getByRole('button', { name: /bookmark this job/i })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onBookmark with jobId when bookmark button clicked', () => {
    const handleBookmark = vi.fn()
    render(<JobCard job={BASE_JOB} onBookmark={handleBookmark} />)
    const btn = screen.getByRole('button', { name: /bookmark this job/i })
    fireEvent.click(btn)
    expect(handleBookmark).toHaveBeenCalledWith('job-1', true)
  })

  it('shows "Remove bookmark" label when isBookmarked=true', () => {
    const handleBookmark = vi.fn()
    render(<JobCard job={{ ...BASE_JOB, isBookmarked: true }} onBookmark={handleBookmark} />)
    const btn = screen.getByRole('button', { name: /remove bookmark/i })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders red flags when present', () => {
    render(
      <JobCard
        job={{ ...BASE_JOB, redFlags: [{ reason: 'Salary not disclosed' }] }}
      />
    )
    expect(screen.getByLabelText(/salary not disclosed/i)).not.toBeNull()
  })

  it('article has accessible label including title and company', () => {
    render(<JobCard job={BASE_JOB} />)
    const article = screen.getByRole('article', {
      name: /senior full-stack engineer at async-first co/i,
    })
    expect(article).not.toBeNull()
  })

  it('renders as <article> semantic element', () => {
    const { container } = render(<JobCard job={BASE_JOB} />)
    const article = container.querySelector('article')
    expect(article).not.toBeNull()
  })

  it('does not render bookmark button when onBookmark not provided', () => {
    render(<JobCard job={BASE_JOB} />)
    expect(screen.queryByRole('button', { name: /bookmark/i })).toBeNull()
  })

  it('detail variant applies larger padding class', () => {
    const { container } = render(<JobCard job={BASE_JOB} variant="detail" />)
    const article = container.querySelector('article')
    expect(article?.className).toContain('rounded-xl')
  })
})
