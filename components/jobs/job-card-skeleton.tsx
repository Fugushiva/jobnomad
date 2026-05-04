/**
 * JobCardSkeleton — loading placeholder that matches JobCard layout.
 *
 * Mimics: company overline, title, meta row, tags, score badge, apply button.
 * Used while job data is loading from the database.
 *
 * @example
 *   <JobCardSkeleton />
 *   <JobCardSkeleton variant="detail" />
 */

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface JobCardSkeletonProps {
  variant?: 'feed' | 'detail'
  className?: string
}

export function JobCardSkeleton({ variant = 'feed', className }: JobCardSkeletonProps) {
  const isDetail = variant === 'detail'

  return (
    <div
      aria-hidden="true"
      aria-label="Loading job listing"
      role="status"
      className={cn(
        'relative flex flex-col gap-3 border border-border bg-surface',
        isDetail ? 'rounded-xl p-6' : 'rounded-lg p-4 sm:p-5',
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {/* Company overline */}
          <Skeleton className="h-3 w-24" />
          {/* Title */}
          <Skeleton className={cn('w-3/4', isDetail ? 'h-7' : 'h-5')} />
        </div>
        {/* Score badge placeholder */}
        <Skeleton className="h-6 w-9 rounded-sm shrink-0" />
      </div>

      {/* Meta row */}
      <Skeleton className="h-3 w-48" />

      {/* Tags row */}
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-20 rounded-sm" />
        <Skeleton className="h-5 w-16 rounded-sm" />
        <Skeleton className="h-5 w-24 rounded-sm" />
      </div>

      {/* Footer: salary + apply button */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  )
}
