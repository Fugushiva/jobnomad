/**
 * NotAnalyzedBadge — shown on job cards when red_flags has not yet been
 * analyzed by the AI pipeline (Phase 1: red_flags is NULL or empty array).
 *
 * This badge is intentionally low-key (grey, secondary variant) to avoid
 * alarming users — it simply signals that analysis is pending, not that
 * there is a problem with the job.
 *
 * Phase 2: once the AI pipeline runs, this badge is replaced by actual
 * RedFlagBadge components (or hidden if no flags were found).
 */

import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface NotAnalyzedBadgeProps {
  className?: string
}

export function NotAnalyzedBadge({ className }: NotAnalyzedBadgeProps) {
  return (
    <Badge
      variant="secondary"
      size="sm"
      aria-label="Red flags not yet analyzed"
      title="This job has not yet been analyzed for red flags"
      className={cn('gap-1 text-text-muted', className)}
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden />
      <span>Not analyzed</span>
    </Badge>
  )
}
