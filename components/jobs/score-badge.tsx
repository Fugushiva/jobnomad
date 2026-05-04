/**
 * ScoreBadge — match score indicator.
 *
 * Three tiers (per style.pdf page 3):
 *   0–59   → coral  (score-low)  — Skip
 *   60–84  → sun    (score-mid)  — Read and decide
 *   85–100 → lagoon (score-high) — Strong fit, apply
 *
 * Color jumps at 60 and 85 — not a gradient.
 * Always uses tabular-nums for score alignment.
 *
 * Accessibility:
 *   - aria-label conveys score + meaning (e.g. "Match score 92 out of 100, strong fit — apply")
 *   - Tooltip (title attr) for hover
 *
 * @example
 *   <ScoreBadge score={92} />
 *   <ScoreBadge score={74} size="lg" />
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ScoreTier = 'high' | 'mid' | 'low'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

function getScoreTier(score: number): ScoreTier {
  if (score >= 85) return 'high'
  if (score >= 60) return 'mid'
  return 'low'
}

const TIER_LABELS: Record<ScoreTier, string> = {
  high: 'strong fit — apply',
  mid:  'read and decide',
  low:  'skip',
}

const TIER_VARIANTS: Record<ScoreTier, 'score-high' | 'score-mid' | 'score-low'> = {
  high: 'score-high',
  mid:  'score-mid',
  low:  'score-low',
}

export function ScoreBadge({ score, size = 'default', className }: ScoreBadgeProps) {
  const tier = getScoreTier(score)
  const label = TIER_LABELS[tier]
  const ariaLabel = `Match score ${score} out of 100, ${label}`

  return (
    <Badge
      variant={TIER_VARIANTS[tier]}
      size={size}
      aria-label={ariaLabel}
      title={label}
      className={cn('font-mono tabular-nums', className)}
    >
      {score}
    </Badge>
  )
}
