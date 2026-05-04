/**
 * LogoMark — the JobNomad brand symbol.
 *
 * Concept: tropical sun rising above the horizon line.
 * The gap in the horizon represents the boundary a nomad crosses
 * between compatible/incompatible opportunities.
 *
 * Variants (per style.pdf page 9):
 *   default     — text-colored horizon, accent sun, primary dot
 *   on-primary  — white horizon (for lagoon backgrounds)
 *   mono        — single color (--text) all elements
 *
 * Sizes: 20 / 28 / 40 / 56 / 80px (height)
 * Minimum recommended: 20px. Below 20px use favicon instead.
 */

import { cn } from '@/lib/utils'

type LogoMarkVariant = 'default' | 'on-primary' | 'mono'
type LogoMarkSize = 20 | 28 | 40 | 56 | 80

export interface LogoMarkProps {
  variant?: LogoMarkVariant
  size?: LogoMarkSize
  className?: string
  'aria-hidden'?: boolean
}

const SIZE_SCALE: Record<LogoMarkSize, { vw: number; vh: number; scale: number }> = {
  20: { vw: 28, vh: 20, scale: 0.714 },
  28: { vw: 28, vh: 20, scale: 1.000 },
  40: { vw: 28, vh: 20, scale: 1.429 },
  56: { vw: 28, vh: 20, scale: 2.000 },
  80: { vw: 28, vh: 20, scale: 2.857 },
}

export function LogoMark({
  variant = 'default',
  size = 28,
  className,
  'aria-hidden': ariaHidden = true,
}: LogoMarkProps) {
  const { vw, vh, scale } = SIZE_SCALE[size]

  const horizonColor =
    variant === 'on-primary' ? 'white'
    : variant === 'mono' ? 'currentColor'
    : 'var(--text)'

  const gapColor =
    variant === 'on-primary' ? 'var(--primary)'
    : variant === 'mono' ? 'var(--bg)'
    : 'var(--bg)'

  const sunColor =
    variant === 'mono' ? 'currentColor'
    : 'var(--accent)'

  const dotColor =
    variant === 'mono' ? 'currentColor'
    : 'var(--primary)'

  return (
    <svg
      width={vw * scale}
      height={vh * scale}
      viewBox={`0 0 ${vw} ${vh}`}
      fill="none"
      aria-hidden={ariaHidden}
      className={cn(className)}
    >
      {/* Horizon line */}
      <line
        x1="2"
        y1="14"
        x2="26"
        y2="14"
        stroke={horizonColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Gap in horizon (nomad passes through) */}
      <line
        x1="11"
        y1="14"
        x2="17"
        y2="14"
        stroke={gapColor}
        strokeWidth="2"
      />
      {/* Sun half-circle */}
      <path
        d="M10 14 A4 4 0 0 1 18 14"
        fill={sunColor}
        stroke="none"
      />
      {/* Sun dot — primary */}
      <circle cx="14" cy="10" r="1.5" fill={dotColor} />
    </svg>
  )
}
