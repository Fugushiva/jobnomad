/**
 * Tests for feed components:
 *   - JobFeedList (empty state, job cards, pagination)
 *   - FeedFilters (active count, render without crash)
 *
 * Uses Vitest + React Testing Library + happy-dom.
 * No jest-dom — use .not.toBeNull() / .not.toBeUndefined() etc.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { JobFeedList } from '../job-feed-list'
import { FeedFilters } from '../feed-filters'
import type { FeedJob } from '@/src/lib/feed/queries'
import type { FeedFilters as FeedFiltersType } from '@/src/lib/feed/schemas'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultFilters: FeedFiltersType = {
  page: 1,
  contract: undefined,
  seniority: undefined,
  geo_policy: undefined,
  salary_min: undefined,
}

const makeJob = (overrides?: Partial<FeedJob>): FeedJob => ({
  id: 'job-1',
  title: 'Senior Engineer',
  company: 'Acme Corp',
  logo_url: null,
  source_url: 'https://example.com/apply',
  source: 'remoteok',
  skills_required: ['TypeScript', 'React'],
  salary_min: 80000,
  salary_max: 120000,
  salary_currency: 'USD',
  salary_period: 'year',
  contract_type: 'contractor',
  geo_policy: 'worldwide',
  seniority: 'senior',
  red_flags: [],
  posted_at: new Date(Date.now() - 86_400_000).toISOString(), // yesterday
  ingested_at: new Date().toISOString(),
  ...overrides,
})

// ---------------------------------------------------------------------------
// JobFeedList
// ---------------------------------------------------------------------------

describe('JobFeedList', () => {
  it('renders "No jobs found" empty state when jobs array is empty', () => {
    render(
      <JobFeedList jobs={[]} total={0} page={1} filters={defaultFilters} />,
    )
    expect(screen.getByText('No jobs found')).not.toBeNull()
  })

  it('shows correct empty message when total=0 (DB empty)', () => {
    render(
      <JobFeedList jobs={[]} total={0} page={1} filters={defaultFilters} />,
    )
    // Partial match
    const el = screen.getAllByText(/check back once the ingestion cron/i)
    expect(el.length).toBeGreaterThan(0)
  })

  it('shows "no match" message when total>0 but page returns 0 jobs', () => {
    render(
      <JobFeedList jobs={[]} total={50} page={3} filters={defaultFilters} />,
    )
    const el = screen.getAllByText(/no jobs match your current filters/i)
    expect(el.length).toBeGreaterThan(0)
  })

  it('renders job card for each job', () => {
    const jobs = [makeJob({ id: 'a', title: 'Job A' }), makeJob({ id: 'b', title: 'Job B' })]
    render(
      <JobFeedList jobs={jobs} total={2} page={1} filters={defaultFilters} />,
    )
    expect(screen.getByText('Job A')).not.toBeNull()
    expect(screen.getByText('Job B')).not.toBeNull()
  })

  it('renders pagination info text', () => {
    const jobs = [makeJob()]
    render(
      <JobFeedList jobs={jobs} total={1} page={1} filters={defaultFilters} />,
    )
    const paginationEl = screen.getAllByText(/page 1 of 1/i)
    expect(paginationEl.length).toBeGreaterThan(0)
  })

  it('disables Previous button on first page (aria-disabled)', () => {
    render(
      <JobFeedList jobs={[makeJob()]} total={1} page={1} filters={defaultFilters} />,
    )
    // The disabled Previous is a <button aria-disabled="true">
    const prevBtns = screen.getAllByRole('button')
    const prevBtn = prevBtns.find((b) => b.textContent?.includes('Previous'))
    expect(prevBtn).not.toBeUndefined()
    expect(
      prevBtn!.getAttribute('disabled') !== null ||
      prevBtn!.getAttribute('aria-disabled') === 'true'
    ).toBe(true)
  })

  it('shows Previous link on page 2', () => {
    const jobs = Array.from({ length: 20 }, (_, i) => makeJob({ id: String(i) }))
    render(
      <JobFeedList jobs={jobs} total={40} page={2} filters={defaultFilters} />,
    )
    // Page 2 — Previous should be a link
    const prevLink = screen.queryByRole('link', { name: /previous page/i })
    expect(prevLink).not.toBeNull()
  })

  it('disables Next button on last page (aria-disabled)', () => {
    render(
      <JobFeedList jobs={[makeJob()]} total={1} page={1} filters={defaultFilters} />,
    )
    const allBtns = screen.getAllByRole('button')
    const nextBtn = allBtns.find((b) => b.textContent?.includes('Next'))
    expect(nextBtn).not.toBeUndefined()
    expect(
      nextBtn!.getAttribute('disabled') !== null ||
      nextBtn!.getAttribute('aria-disabled') === 'true'
    ).toBe(true)
  })

  it('shows Next link when more pages exist', () => {
    const jobs = Array.from({ length: 20 }, (_, i) => makeJob({ id: String(i) }))
    render(
      <JobFeedList jobs={jobs} total={40} page={1} filters={defaultFilters} />,
    )
    const nextLink = screen.queryByRole('link', { name: /next page/i })
    expect(nextLink).not.toBeNull()
  })

  it('handles red_flags that are strings (permissive parsing)', () => {
    const job = makeJob({ red_flags: ['No overtime pay', 'Vague role'] })
    expect(() =>
      render(
        <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
      ),
    ).not.toThrow()
  })

  it('handles null red_flags gracefully', () => {
    const job = makeJob({ red_flags: null as unknown as [] })
    expect(() =>
      render(
        <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
      ),
    ).not.toThrow()
  })

  it('shows "Not analyzed" badge when red_flags is null', () => {
    const job = makeJob({ red_flags: null as unknown as [] })
    render(
      <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
    )
    const badges = screen.getAllByText('Not analyzed')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('does NOT show "Not analyzed" badge when red_flags is a non-empty array', () => {
    const job = makeJob({ red_flags: ['Unpaid trial'] })
    render(
      <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
    )
    // Badge should not appear (job has been analyzed)
    const badges = screen.queryAllByText('Not analyzed')
    expect(badges.length).toBe(0)
  })

  it('does NOT show "Not analyzed" badge when red_flags is empty array (analyzed, no flags)', () => {
    const job = makeJob({ red_flags: [] })
    render(
      <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
    )
    const badges = screen.queryAllByText('Not analyzed')
    expect(badges.length).toBe(0)
  })

  it('renders salary when both min and max present', () => {
    const job = makeJob({ salary_min: 80000, salary_max: 120000, salary_currency: 'USD', salary_period: 'year' })
    const { container } = render(
      <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
    )
    // Salary element should contain numbers — use container text check
    expect(container.textContent).toContain('80')
    expect(container.textContent).toContain('120')
  })

  it('renders without crash when salary_min and salary_max are null', () => {
    const job = makeJob({ salary_min: null, salary_max: null })
    expect(() =>
      render(
        <JobFeedList jobs={[job]} total={1} page={1} filters={defaultFilters} />,
      ),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// FeedFilters
// ---------------------------------------------------------------------------

describe('FeedFilters', () => {
  it('renders without crashing with empty filters', () => {
    expect(() =>
      render(<FeedFilters filters={defaultFilters} />),
    ).not.toThrow()
  })

  it('renders "Filters" label', () => {
    render(<FeedFilters filters={defaultFilters} />)
    // Appears in desktop sidebar AND mobile Sheet title — both valid
    const headings = screen.getAllByText('Filters')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('renders "Reset all filters" button (at least one)', () => {
    render(<FeedFilters filters={defaultFilters} />)
    // Desktop sidebar has it; mobile Sheet is initially closed (portal not rendered)
    const resetBtns = screen.getAllByText(/reset all filters/i)
    expect(resetBtns.length).toBeGreaterThan(0)
  })

  it('renders contract type options', () => {
    render(<FeedFilters filters={defaultFilters} />)
    const contractorLabels = screen.getAllByText(/contractor \/ freelance/i)
    expect(contractorLabels.length).toBeGreaterThan(0)
  })

  it('renders seniority options', () => {
    render(<FeedFilters filters={defaultFilters} />)
    const juniorLabels = screen.getAllByText('Junior')
    expect(juniorLabels.length).toBeGreaterThan(0)
    const seniorLabels = screen.getAllByText('Senior')
    expect(seniorLabels.length).toBeGreaterThan(0)
  })

  it('renders minimum salary dropdown', () => {
    render(<FeedFilters filters={defaultFilters} />)
    // There may be multiple selects (sidebar + hidden mobile form)
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(0)
  })

  it('shows active filter badge when contract is set', () => {
    render(
      <FeedFilters filters={{ ...defaultFilters, contract: 'contractor' }} />,
    )
    const badges = screen.getAllByText('1')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows correct active count for multiple filters', () => {
    render(
      <FeedFilters
        filters={{ ...defaultFilters, contract: 'contractor', seniority: 'senior', salary_min: 80000 }}
      />,
    )
    const badges = screen.getAllByText('3')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows "Clear" button when contract filter is active', () => {
    render(
      <FeedFilters filters={{ ...defaultFilters, contract: 'contractor' }} />,
    )
    const clearBtns = screen.getAllByText('Clear')
    expect(clearBtns.length).toBeGreaterThan(0)
  })
})
