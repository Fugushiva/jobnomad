/**
 * JobFeedList — renders the list of job cards + Previous/Next pagination.
 *
 * This is a Server Component: pagination is done via URL query params (?page=N)
 * so the whole page re-fetches from the server (no client state needed for
 * Phase 1). This also means the browser Back button works correctly.
 *
 * Props:
 *   jobs    — pre-fetched array of FeedJob (from queries.ts)
 *   total   — total count from DB (for pagination math)
 *   page    — current 1-indexed page
 *   filters — current filters (serialised back to href for pagination links)
 */

import Link from 'next/link'
import { Briefcase, ChevronLeft, ChevronRight } from 'lucide-react'
import { JobCard } from '@/components/jobs/job-card'
import { NotAnalyzedBadge } from '@/components/jobs/not-analyzed-badge'
import { EmptyState } from '@/components/states/empty-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FeedJob } from '@/src/lib/feed/queries'
import type { FeedFilters } from '@/src/lib/feed/schemas'
import { FEED_PAGE_SIZE } from '@/src/lib/feed/queries'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a FeedJob into the JobCardData shape expected by JobCard. */
function toJobCardData(job: FeedJob) {
  // Build salary string
  let salary: string | undefined
  if (job.salary_min != null || job.salary_max != null) {
    const currency = job.salary_currency ?? 'USD'
    const period = job.salary_period ?? 'year'
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(n)
    if (job.salary_min != null && job.salary_max != null) {
      salary = `${fmt(job.salary_min)} – ${fmt(job.salary_max)} / ${period}`
    } else if (job.salary_min != null) {
      salary = `From ${fmt(job.salary_min)} / ${period}`
    } else if (job.salary_max != null) {
      salary = `Up to ${fmt(job.salary_max!)} / ${period}`
    }
  }

  // Parse red_flags — permissive: ignore if not array
  // notAnalyzed = true when red_flags is NULL or an empty array (Phase 1)
  let redFlags: { reason: string }[] = []
  let notAnalyzed = true
  if (Array.isArray(job.red_flags)) {
    redFlags = (job.red_flags as unknown[])
      .filter((f): f is string => typeof f === 'string')
      .map((reason) => ({ reason }))
    // If the array exists (even empty), the field was set by extraction
    // A non-null empty array means "analyzed, no flags found" — not "not analyzed"
    // A null means "not yet processed by the AI pipeline" (Phase 1 default)
    notAnalyzed = job.red_flags === null
  }

  // Format posted_at relative to today
  let posted: string | undefined
  if (job.posted_at) {
    const diffMs = Date.now() - new Date(job.posted_at).getTime()
    const diffDays = Math.floor(diffMs / 86_400_000)
    if (diffDays === 0) posted = 'Today'
    else if (diffDays === 1) posted = 'Yesterday'
    else if (diffDays < 14) posted = `${diffDays}d ago`
    else if (diffDays < 60) posted = `${Math.floor(diffDays / 7)}w ago`
    else posted = `${Math.floor(diffDays / 30)}mo ago`
  }

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    applyUrl: job.source_url,
    salary,
    posted,
    type: job.contract_type as 'contractor' | 'full-time' | undefined,
    tags: job.skills_required.slice(0, 6), // cap displayed tags
    redFlags: redFlags.length > 0 ? redFlags : undefined,
    notAnalyzed,
  }
}

/** Build an href that preserves existing filters, updating only ?page=. */
function buildPageHref(
  filters: FeedFilters,
  targetPage: number,
): string {
  const params = new URLSearchParams()
  if (filters.contract) params.set('contract', filters.contract)
  if (filters.seniority) params.set('seniority', filters.seniority)
  if (filters.geo_policy) params.set('geo_policy', filters.geo_policy)
  if (filters.salary_min != null) params.set('salary_min', String(filters.salary_min))
  params.set('page', String(targetPage))
  return `/feed?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobFeedListProps {
  jobs: FeedJob[]
  total: number
  page: number
  filters: FeedFilters
  className?: string
}

export function JobFeedList({
  jobs,
  total,
  page,
  filters,
  className,
}: JobFeedListProps) {
  const totalPages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        heading="No jobs found"
        description={
          total === 0
            ? 'The job feed is empty — check back once the ingestion cron has run.'
            : 'No jobs match your current filters. Try widening your search.'
        }
      />
    )
  }

  return (
    <section aria-label="Job listings" className={cn('flex flex-col gap-4', className)}>
      {/* -- Job cards ------------------------------------------------------- */}
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {jobs.map((job) => {
          const cardData = toJobCardData(job)
          return (
            <li key={job.id}>
              <JobCard job={cardData} variant="feed" />
              {/* Phase 1: show "Not analyzed" badge when red_flags is NULL */}
              {cardData.notAnalyzed && !cardData.redFlags && (
                <div className="px-1 pt-1.5">
                  <NotAnalyzedBadge />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* -- Pagination controls --------------------------------------------- */}
      <nav
        aria-label="Pagination"
        className="flex items-center justify-between pt-2"
      >
        <span className="text-body-sm text-text-muted">
          {total.toLocaleString()} job{total !== 1 ? 's' : ''} · page {page} of{' '}
          {totalPages}
        </span>

        <div className="flex gap-2">
          {hasPrev ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(filters, page - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled aria-disabled="true">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
          )}

          {hasNext ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(filters, page + 1)} aria-label="Next page">
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled aria-disabled="true">
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </nav>
    </section>
  )
}
