/**
 * Footer — site footer with Privacy, Terms, Status links.
 *
 * Server component (no interactivity required).
 *
 * @example
 *   <Footer />
 *   <Footer variant="minimal" />
 */

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { Logo } from '@/components/brand/logo'
import { cn } from '@/lib/utils'

type FooterVariant = 'default' | 'minimal'

interface FooterProps {
  variant?: FooterVariant
  className?: string
}

const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/status', label: 'Status' },
] as const

export function Footer({ variant = 'default', className }: FooterProps) {
  const year = new Date().getFullYear()

  if (variant === 'minimal') {
    return (
      <footer
        className={cn('border-t border-border bg-surface px-6 py-4', className)}
        aria-label="Site footer"
      >
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <span className="text-caption text-text-muted">
            &copy; {year} jobnomad.app
          </span>
          <nav className="flex gap-4" aria-label="Footer navigation">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-caption text-text-muted transition-colors hover:text-text-soft"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn('border-t border-border bg-surface', className)}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* Top row: logo + tagline */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 mb-8">
          <div className="flex flex-col gap-2">
            <Logo variant="default" size={28} asDiv label="JobNomad" />
            <p className="text-body-sm text-text-muted max-w-xs">
              Curated remote jobs matched to your skills and timezone.
            </p>
          </div>

          {/* Navigation columns */}
          <nav
            className="flex flex-wrap gap-8"
            aria-label="Footer navigation"
          >
            <div className="flex flex-col gap-2">
              <span className="text-overline text-text-muted mb-1">Product</span>
              <Link
                href="/jobs"
                className="text-body-sm text-text-soft transition-colors hover:text-text"
              >
                Browse jobs
              </Link>
              <Link
                href="/auth/login"
                className="text-body-sm text-text-soft transition-colors hover:text-text"
              >
                Sign in
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-overline text-text-muted mb-1">Legal</span>
              {FOOTER_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-body-sm text-text-soft transition-colors hover:text-text"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <Separator className="mb-6" />

        {/* Bottom row: copyright */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-caption text-text-muted">
            &copy; {year} jobnomad.app &middot; Foundations v0.1
          </span>
          <span className="text-caption text-text-muted">
            Built for remote professionals worldwide
          </span>
        </div>
      </div>
    </footer>
  )
}
