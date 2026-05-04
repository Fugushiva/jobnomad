/**
 * Logo — full brand lockup (mark + wordmark).
 *
 * Per style.pdf page 9–10:
 *   default     — mark + wordmark on light background
 *   dark        — mark + wordmark on dark background (same colors, dark theme)
 *   on-primary  — white wordmark for lagoon-colored backgrounds
 *   mono-positive — single color positive
 *   mono-inverse  — single color for dark backgrounds
 *
 * Wordmark: Newsreader italic 300, letter-spacing -0.035em
 * Final dot: accent (sun color) — brand signature
 * Protection space: ≥ one sun-diameter around the lockup
 *
 * @example
 *   <Logo />                    // default, 28px mark
 *   <Logo size={40} />          // larger
 *   <Logo variant="on-primary" /> // white on lagoon button
 */

import Link from 'next/link'
import { LogoMark, type LogoMarkProps } from './logo-mark'
import { cn } from '@/lib/utils'

type LogoVariant = 'default' | 'on-primary' | 'mono-positive' | 'mono-inverse'
type LogoSize = 20 | 28 | 40 | 56 | 80

// Re-export LogoMark variant type
export type { LogoMarkProps }

interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  href?: string
  className?: string
  /** Accessible label for the logo link/group */
  label?: string
  /** If true, renders a <div> instead of <Link> */
  asDiv?: boolean
}

const MARK_VARIANT: Record<LogoVariant, LogoMarkProps['variant']> = {
  'default':      'default',
  'on-primary':   'on-primary',
  'mono-positive': 'mono',
  'mono-inverse': 'mono',
}

const TEXT_COLOR: Record<LogoVariant, string> = {
  'default':      'text-text',
  'on-primary':   'text-surface',
  'mono-positive': 'text-text',
  'mono-inverse': 'text-surface',
}

const ACCENT_COLOR: Record<LogoVariant, string> = {
  'default':      'var(--accent)',
  'on-primary':   'white',
  'mono-positive': 'currentColor',
  'mono-inverse': 'currentColor',
}

/** Font size matched to mark size */
const TEXT_SIZE: Record<LogoSize, string> = {
  20: 'text-[0.8rem]',
  28: 'text-display-sm',
  40: 'text-display-md',
  56: 'text-display-lg',
  80: 'text-display-xl',
}

export function Logo({
  variant = 'default',
  size = 28,
  href = '/',
  className,
  label = 'JobNomad — home',
  asDiv = false,
}: LogoProps) {
  const content = (
    <>
      <LogoMark variant={MARK_VARIANT[variant]} size={size} aria-hidden />
      <span
        className={cn('font-display font-light', TEXT_SIZE[size], TEXT_COLOR[variant])}
        style={{ letterSpacing: '-0.035em' }}
      >
        JobNomad
        <span style={{ color: ACCENT_COLOR[variant] }}>.</span>
      </span>
    </>
  )

  const sharedClass = cn('flex items-center gap-2.5 no-underline select-none', className)

  if (asDiv) {
    return (
      <div className={sharedClass} role="img" aria-label={label}>
        {content}
      </div>
    )
  }

  return (
    <Link href={href} className={sharedClass} aria-label={label}>
      {content}
    </Link>
  )
}
