'use client'

/**
 * LoginForm — client component for the magic link login flow.
 *
 * Uses React 19 useActionState for progressive enhancement.
 * Shows a "check your email" confirmation on success.
 */
import { useActionState } from 'react'
import { sendMagicLink, type SendMagicLinkResult } from './actions'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<
    SendMagicLinkResult | null,
    FormData
  >(sendMagicLink, null)

  // Success state — show confirmation
  if (state?.success) {
    return (
      <div className="flex flex-col items-center text-center gap-4">
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

        <h2 className="text-display-md" style={{ color: 'var(--text)' }}>
          Check your email
        </h2>
        <p className="text-body-lg max-w-sm" style={{ color: 'var(--text-soft)' }}>
          We sent a magic link to your inbox. Click the link to sign in — no password needed.
        </p>
        <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  // Error message
  const errorMessage =
    state && !state.success ? state.message : null

  return (
    <form action={formAction} className="flex flex-col gap-5 w-full">
      {/* Email field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-label-md"
          style={{ color: 'var(--text)' }}
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          aria-describedby={errorMessage ? 'email-error' : undefined}
          aria-invalid={errorMessage ? true : undefined}
          className="w-full px-3.5 py-2.5 text-body-lg border outline-none transition-all"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: errorMessage ? 'var(--danger)' : 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.boxShadow = 'var(--shadow-ring)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = errorMessage
              ? 'var(--danger)'
              : 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        {errorMessage && (
          <p
            id="email-error"
            role="alert"
            className="text-body-sm"
            style={{ color: 'var(--danger)' }}
          >
            {errorMessage}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="text-label-md px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--primary)',
          color: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={(e) => {
          if (!isPending) {
            e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--primary)'
        }}
      >
        {isPending ? 'Sending link...' : 'Send magic link'}
      </button>
    </form>
  )
}
