import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication error — JobNomad',
  description: 'Something went wrong during authentication.',
}

/**
 * /auth/error — Shown when auth fails (expired link, bad code, etc.)
 *
 * Reads ?reason= to show a human-friendly message.
 * Never exposes internal error details.
 */

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

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const { title, body } = (reason && ERROR_MESSAGES[reason]) || DEFAULT_ERROR

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center px-6 py-12"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm flex flex-col items-center text-center gap-6 p-8 border"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Warning icon */}
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full"
          style={{ backgroundColor: 'var(--danger-soft)' }}
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

        <h1 className="text-display-md" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
        <p className="text-body-lg" style={{ color: 'var(--text-soft)' }}>
          {body}
        </p>

        <a
          href="/auth/login"
          className="text-label-md px-4 py-2 transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
