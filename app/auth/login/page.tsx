import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — JobNomad',
  description: 'Sign in to JobNomad with a magic link. No password needed.',
}

/**
 * /auth/login — Magic link login page.
 *
 * Minimal, centered layout with the logo and login form.
 * Matches the design system: warm surfaces, lagoon accent.
 */
export default function LoginPage() {
  return (
    <div
      className="flex flex-col flex-1 items-center justify-center px-6 py-12"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm flex flex-col items-center gap-8 p-8 border"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <svg
            width="28"
            height="20"
            viewBox="0 0 28 20"
            fill="none"
            aria-hidden="true"
          >
            <line
              x1="2" y1="14" x2="26" y2="14"
              stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round"
            />
            <line
              x1="11" y1="14" x2="17" y2="14"
              stroke="var(--surface)" strokeWidth="2"
            />
            <path d="M10 14 A4 4 0 0 1 18 14" fill="var(--accent)" />
            <circle cx="14" cy="10" r="1.5" fill="var(--primary)" />
          </svg>
          <span className="text-display-sm" style={{ letterSpacing: '-0.035em' }}>
            JobNomad<span style={{ color: 'var(--accent)' }}>.</span>
          </span>
        </Link>

        {/* Heading */}
        <div className="flex flex-col items-center text-center gap-2">
          <h1 className="text-display-md" style={{ color: 'var(--text)' }}>
            Sign in
          </h1>
          <p className="text-body-md" style={{ color: 'var(--text-soft)' }}>
            Enter your email to receive a magic link.
            <br />
            No password needed.
          </p>
        </div>

        {/* Form (client component) */}
        <LoginForm />
      </div>

      {/* Back to home */}
      <Link
        href="/"
        className="text-body-sm mt-6 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        &larr; Back to home
      </Link>
    </div>
  )
}
