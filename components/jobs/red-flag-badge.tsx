/**
 * RedFlagBadge — warning signal for job listing issues.
 *
 * Per style.pdf: coral is reserved for red flags only — use sparingly.
 * Always includes an icon (AlertTriangle) + short text label.
 * The reason prop is added as title (tooltip) and sr-only for screen readers.
 *
 * @example
 *   <RedFlagBadge reason="Salary not disclosed" />
 *   <RedFlagBadge reason="Requires unpaid test" label="Test project" />
 */

import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface RedFlagBadgeProps {
  /** Short label shown in the badge (default: "Red flag") */
  label?: string
  /** Full reason text — shown as tooltip and to screen readers */
  reason: string
  className?: string
}

export function RedFlagBadge({
  label = 'Red flag',
  reason,
  className,
}: RedFlagBadgeProps) {
  return (
    <Badge
      variant="red-flag"
      title={reason}
      aria-label={`Warning: ${reason}`}
      className={cn(className)}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      <span>{label}</span>
      {/* Full reason text for screen readers */}
      <span className="sr-only">: {reason}</span>
    </Badge>
  )
}
