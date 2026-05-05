import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Authentication error — JobNomad',
  description: 'Something went wrong during authentication.',
}

/**
 * /auth/error — Shown when authentication fails (expired link, bad code, etc.)
 *
 * Reads ?reason= to show a human-friendly error message.
 *
 * Security:
 *  - The `reason` query param is mapped through a strict allowlist of keys.
 *    Unknown values fall back to the generic error — the raw value is NEVER
 *    rendered in the DOM, preventing reflected XSS via crafted URLs.
 *  - No internal error details, stack traces, or Supabase error messages
 *    are ever surfaced to the user.
 *  - searchParams is typed as Promise<{ reason?: string }> per Next.js 16
 *    (async params — see AGENTS.md).
 */

// ---------------------------------------------------------------------------
// Error message mapping — exhaustive allowlist
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  missing_code: {
    title: 'Invalid link',
    body: 'This sign-in link appears to be incomplete. Please request a new one.',
  },
  link_expired: {
    title: 'Link expired',
    body: 'This magic link has expired. They are valid for 1 hour. Please request a new one.',
  },
  exchange_failed: {
    title: 'Sign-in failed',
    body: 'We couldn\u2019t complete your sign-in. This can happen if the link was already used. Please request a new one.',
  },
  signout_failed: {
    title: 'Sign-out issue',
    body: 'We had trouble signing you out. You may already be signed out.',
  },
}

const DEFAULT_ERROR = {
  title: 'Something went wrong',
  body: 'An unexpected error occurred. Please try signing in again.',
}

// ---------------------------------------------------------------------------
// Warning icon
// ---------------------------------------------------------------------------

function WarningIcon() {
  return (
    <div
      className="flex items-center justify-center w-14 h-14 rounded-full bg-danger-soft"
      aria-hidden="true"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--danger)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  // Map through strict allowlist — raw `reason` value is NEVER used in JSX.
  const { title, body } =
    (reason && ERROR_MESSAGES[reason]) || DEFAULT_ERROR

  return (
    <AuthLayout
      title={title}
      subtitle={body}
      icon={<WarningIcon />}
      footer={
        <>
          {/* Primary CTA: try again → /auth/login */}
          <Button asChild className="w-full max-w-xs">
            <Link href="/auth/login">Try again</Link>
          </Button>

          {/* Secondary CTA: back to landing */}
          <Link
            href="/"
            className="text-body-sm text-text-muted transition-colors hover:text-text-soft"
          >
            &larr; Back to home
          </Link>
        </>
      }
    />
  )
}
