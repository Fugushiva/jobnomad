/**
 * FeedSkeleton — full feed loading state.
 *
 * Renders N job card skeletons with staggered animation delay
 * to avoid a jarring simultaneous pulse.
 *
 * @example
 *   <FeedSkeleton count={5} />
 */

import { JobCardSkeleton } from '@/components/jobs/job-card-skeleton'
import { cn } from '@/lib/utils'

interface FeedSkeletonProps {
  /** Number of skeleton cards to render (default: 5) */
  count?: number
  className?: string
}

export function FeedSkeleton({ count = 5, className }: FeedSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading job feed"
      aria-busy="true"
      className={cn('flex flex-col gap-3', className)}
    >
      <span className="sr-only">Loading job listings…</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            animationDelay: `${i * 100}ms`,
            animationFillMode: 'both',
          }}
        >
          <JobCardSkeleton />
        </div>
      ))}
    </div>
  )
}
