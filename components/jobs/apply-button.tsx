/**
 * ApplyButton — opens the job's source URL in a new tab and fires a
 * click_apply tracking event via navigator.sendBeacon (fire-and-forget,
 * works even when the page is being unloaded).
 *
 * The beacon hits /api/jobs/[id]/track-apply which inserts a row in
 * job_views with action='click_apply'.  No PostHog in Phase 1.
 *
 * Props:
 *   jobId    — UUID of the job
 *   applyUrl — source_url from jobs table
 *   title    — used for aria-label
 *   company  — used for aria-label
 *   size     — Button size prop (default 'sm')
 */

'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ApplyButtonProps {
  jobId: string
  applyUrl: string
  title: string
  company: string
  size?: 'sm' | 'default' | 'lg' | 'icon'
}

export function ApplyButton({
  jobId,
  applyUrl,
  title,
  company,
  size = 'sm',
}: ApplyButtonProps) {
  function handleClick() {
    // Fire-and-forget beacon — works even if the tab navigates away
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(`/api/jobs/${jobId}/track-apply`)
    }
  }

  return (
    <Button
      size={size}
      asChild
      onClick={handleClick}
    >
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Apply to ${title} at ${company} (opens in new tab)`}
      >
        Apply
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </Button>
  )
}
