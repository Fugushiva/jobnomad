import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Check your email — JobNomad',
  description: 'A magic link has been sent to your email.',
}

/**
 * /auth/verify — Shown after magic link is sent.
 *
 * This is a standalone page for cases where the user is redirected here
 * (e.g. from a deep link that requires auth). The login form already
 * shows an inline "check your email" state, but this page serves as
 * a fallback / bookmarkable confirmation.
 */
export default function VerifyPage() {
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
        {/* Mail icon */}
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full"
          style={{ backgroundColor: 'var(--primary-soft)' }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h1 className="text-display-md" style={{ color: 'var(--text)' }}>
          Check your email
        </h1>
        <p className="text-body-lg" style={{ color: 'var(--text-soft)' }}>
          We sent a magic link to your inbox. Click the link to sign in — no password needed.
        </p>
        <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
          Didn&apos;t receive it? Check your spam folder.
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
          Try again
        </a>
      </div>
    </div>
  )
}
