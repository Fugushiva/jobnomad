/**
 * BookmarkButton — optimistic bookmark toggle for a job.
 *
 * Uses React's useOptimistic to immediately reflect the new state in the UI,
 * then calls the Server Action in the background. On failure, the optimistic
 * state is rolled back and a toast error is shown.
 *
 * Props:
 *   jobId       — UUID of the job
 *   isBookmarked — current persisted state (from DB, fetched in parent SC)
 *   className   — optional Tailwind classes
 */

'use client'

import { useOptimistic, useTransition } from 'react'
import { Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/toast'
import { saveJob, unsaveJob } from '@/app/(protected)/saved/actions'
import { cn } from '@/lib/utils'

interface BookmarkButtonProps {
  jobId: string
  isBookmarked: boolean
  className?: string
}

export function BookmarkButton({
  jobId,
  isBookmarked,
  className,
}: BookmarkButtonProps) {
  const [optimisticBookmarked, setOptimisticBookmarked] = useOptimistic(isBookmarked)
  const [, startTransition] = useTransition()

  function handleClick() {
    const next = !optimisticBookmarked
    startTransition(async () => {
      setOptimisticBookmarked(next)
      const result = next ? await saveJob(jobId) : await unsaveJob(jobId)
      if ('error' in result) {
        // Roll back is automatic (optimistic state tied to transition)
        toastError(result.error)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7 text-text-muted hover:text-primary', className)}
      aria-label={optimisticBookmarked ? 'Remove bookmark' : 'Bookmark this job'}
      aria-pressed={optimisticBookmarked}
      onClick={handleClick}
    >
      <Bookmark
        className={cn(
          'h-4 w-4',
          optimisticBookmarked && 'fill-primary text-primary',
        )}
      />
    </Button>
  )
}
