/**
 * EmptyState — reusable empty content placeholder.
 *
 * Use for: empty feed, no saved jobs, no search results, etc.
 * Icon is passed as a Lucide React component.
 *
 * @example
 *   <EmptyState
 *     icon={Bookmark}
 *     heading="No saved jobs yet"
 *     description="Bookmark jobs from your feed to review later."
 *     action={{ label: "Browse jobs", href: "/feed" }}
 *   />
 */

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon?: LucideIcon
  heading: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({
  icon: Icon,
  heading,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center gap-4 py-16 px-6',
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-bg-tint">
          <Icon className="h-6 w-6 text-text-muted" aria-hidden />
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-display-sm text-text">{heading}</h3>
        {description && (
          <p className="text-body-md text-text-soft">{description}</p>
        )}
      </div>

      {action && (
        action.href ? (
          <Button variant="outline" asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  )
}
