/**
 * JobCard — the core job listing card component.
 *
 * Two variants:
 *   feed   — compact, in list context (radius-lg, shadow-xs)
 *   detail — expanded, standalone (radius-xl, shadow-md, more padding)
 *
 * Data contract: all props typed via a Zod schema re-exported as `jobCardSchema`.
 * Feed data should only include public job fields — no PII.
 *
 * Accessibility:
 *   - <article> semantic element with aria-label
 *   - All interactive elements (bookmark, apply) keyboard focusable
 *   - ScoreBadge carries aria-label with score + meaning
 *   - RedFlagBadges carry aria-label with full reason
 *
 * @example
 *   <JobCard
 *     job={{ id: '1', title: 'Senior Engineer', company: 'Acme', score: 92 }}
 *     onBookmark={(id) => console.log('bookmarked', id)}
 *   />
 */

'use client'

import Link from 'next/link'
import { Bookmark, ExternalLink } from 'lucide-react'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from './score-badge'
import { RedFlagBadge } from './red-flag-badge'
import { cn } from '@/lib/utils'

// -- Job data schema (reusable across feed + detail pages) --------------------
export const jobCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  timezone: z.string().optional(),
  type: z.enum(['full-time', 'part-time', 'contractor', 'contract', 'freelance']).optional(),
  posted: z.string().optional(),
  salary: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  redFlags: z.array(z.object({
    label: z.string().optional(),
    reason: z.string(),
  })).optional(),
  // Require https:// explicitly — `.url()` alone would accept javascript:,
  // data:, etc. Job source URLs are always normalized to https:// at
  // ingestion (see `src/lib/sources/schemas.ts::httpsUrl`), but we duplicate
  // the check here as defense-in-depth in case a future code path bypasses
  // ingestion validation.
  applyUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), 'applyUrl must be https://')
    .optional(),
  isBookmarked: z.boolean().optional(),
})

export type JobCardData = z.infer<typeof jobCardSchema>

type JobCardVariant = 'feed' | 'detail'

interface JobCardProps {
  job: JobCardData
  variant?: JobCardVariant
  /** Called when user bookmarks/unbookmarks the job */
  onBookmark?: (jobId: string, bookmarked: boolean) => void
  className?: string
}

export function JobCard({
  job,
  variant = 'feed',
  onBookmark,
  className,
}: JobCardProps) {
  const {
    id,
    title,
    company,
    timezone,
    type,
    posted,
    salary,
    score,
    tags,
    redFlags,
    applyUrl,
    isBookmarked,
  } = job

  const isDetail = variant === 'detail'

  const meta = [timezone, type, posted].filter(Boolean).join(' · ')

  return (
    <article
      aria-label={`${title} at ${company}${score != null ? `, match score ${score}` : ''}`}
      className={cn(
        'relative flex flex-col gap-3 border border-border bg-surface transition-shadow',
        isDetail
          ? 'rounded-xl p-6 shadow-md hover:shadow-lg'
          : 'rounded-lg p-4 sm:p-5 shadow-xs hover:shadow-sm',
        className
      )}
    >
      {/* -- Card header ---------------------------------------------------- */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* Company overline */}
          <p className="text-overline text-text-muted truncate">{company}</p>
          {/* Job title */}
          <h3
            className={cn(
              'text-text',
              isDetail ? 'text-display-md' : 'text-display-sm'
            )}
          >
            {title}
          </h3>
        </div>

        {/* Score + bookmark (right aligned) */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {score != null && <ScoreBadge score={score} />}
          {onBookmark && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-muted hover:text-primary"
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this job'}
              aria-pressed={isBookmarked}
              onClick={() => onBookmark(id, !isBookmarked)}
            >
              <Bookmark
                className={cn(
                  'h-4 w-4',
                  isBookmarked && 'fill-primary text-primary'
                )}
              />
            </Button>
          )}
        </div>
      </div>

      {/* -- Meta row (timezone · type · posted) ---------------------------- */}
      {meta && (
        <p className="text-mono-sm text-text-muted">{meta}</p>
      )}

      {/* -- Tags ----------------------------------------------------------- */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Skills">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" size="sm" role="listitem">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* -- Red flags ------------------------------------------------------ */}
      {redFlags && redFlags.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="list"
          aria-label="Warning signals"
        >
          {redFlags.map((flag, i) => (
            <span key={i} role="listitem">
              <RedFlagBadge
                label={flag.label}
                reason={flag.reason}
              />
            </span>
          ))}
        </div>
      )}

      {/* -- Footer: salary + apply button ---------------------------------- */}
      <div className="flex items-center justify-between gap-3 mt-1">
        {salary ? (
          <span className="text-label-md text-text-soft">{salary}</span>
        ) : (
          <span />
        )}

        {applyUrl && (
          <Button
            size="sm"
            asChild
          >
            <Link
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Apply to ${title} at ${company} (opens in new tab)`}
            >
              Apply
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
