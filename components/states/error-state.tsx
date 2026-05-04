/**
 * ErrorState — reusable error content placeholder.
 *
 * Use in error boundaries, failed data fetches, network errors.
 *
 * @example
 *   <ErrorState
 *     heading="Could not load jobs"
 *     description="Check your connection and try again."
 *     onRetry={() => router.refresh()}
 *   />
 */

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  heading?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  heading = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-center justify-center text-center gap-4 py-16 px-6',
        className
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-danger-soft">
        <AlertCircle className="h-6 w-6 text-danger" aria-hidden />
      </div>

      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-display-sm text-text">{heading}</h3>
        <p className="text-body-md text-text-soft">{description}</p>
      </div>

      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
