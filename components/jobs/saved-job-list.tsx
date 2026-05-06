/**
 * SavedJobList — client component that renders the list of saved jobs.
 *
 * Each row shows:
 *  - Job title + company
 *  - Status select (saved / applied / rejected / interviewing / offered)
 *  - ApplyButton (opens source_url + fires tracking beacon)
 *  - BookmarkButton (unsave = remove bookmark)
 *
 * Optimistic updates are handled inside BookmarkButton (useOptimistic).
 * Status changes call updateSavedJobStatus Server Action directly via
 * a <form> select — no extra client state needed.
 */

'use client'

import { BookmarkButton } from './bookmark-button'
import { ApplyButton } from './apply-button'
import { updateSavedJobStatus } from '@/app/(protected)/saved/actions'
import { toastError } from '@/lib/toast'
import type { SavedJobItem } from '@/app/(protected)/saved/page'

const STATUS_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  rejected: 'Rejected',
  interviewing: 'Interviewing',
  offered: 'Offered',
}

interface SavedJobListProps {
  items: SavedJobItem[]
}

export function SavedJobList({ items }: SavedJobListProps) {
  async function handleStatusChange(jobId: string, status: string) {
    const result = await updateSavedJobStatus(jobId, status)
    if ('error' in result) {
      toastError(result.error)
    }
  }

  return (
    <ol className="flex flex-col gap-3 list-none p-0 m-0">
      {items.map((item) => {
        const job = item.jobs

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
            salary = `Up to ${fmt(job.salary_max)} / ${period}`
          }
        }

        return (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-xs"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-overline text-text-muted truncate">{job.company}</p>
                <h3 className="text-display-sm text-text">{job.title}</h3>
              </div>

              {/* Bookmark (unsave) button */}
              <BookmarkButton
                jobId={item.job_id}
                isBookmarked={true}
                className="shrink-0"
              />
            </div>

            {/* Tags (top 4 skills) */}
            {job.skills_required.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.skills_required.slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-mono-xs text-text-muted"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Footer: salary + status + apply */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {salary && (
                  <span className="text-label-md text-text-soft shrink-0">{salary}</span>
                )}

                {/* Status select */}
                <select
                  defaultValue={item.status}
                  aria-label={`Application status for ${job.title}`}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  onChange={(e) => handleStatusChange(item.job_id, e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <ApplyButton
                jobId={item.job_id}
                applyUrl={job.source_url}
                title={job.title}
                company={job.company}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
