import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'

export const metadata: Metadata = {
  title: 'Check your email — JobNomad',
  description: 'A magic link has been sent to your email.',
}

/**
 * /auth/verify — Shown after a magic link is sent.
 *
 * This is a standalone confirmation page for cases where the user is
 * redirected here (e.g. from a deep link that requires auth). The login
 * form also shows an inline "check your email" state for the common flow.
 *
 * Security:
 *  - Purely static — no user input accepted, no Server Action exposed.
 *  - The "Use a different email" link simply redirects to /auth/login;
 *    there is no email stored or sent from this page.
 *  - No query params are read or reflected in the DOM.
 */

/** Mail envelope icon — rendered inside the decorative circle. */
function MailIcon() {
  return (
    /**
     * Decorative circle with a subtle pulse animation.
     * The animation is suppressed when the user prefers reduced motion
     * via the `motion-safe:` Tailwind variant, which applies the class only
     * under `@media (prefers-reduced-motion: no-preference)`.
     */
    <div
      className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-soft motion-safe:animate-pulse"
      aria-hidden="true"
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
  )
}

export default function VerifyPage() {
  return (
    <AuthLayout
      title="Check your email"
      subtitle="We sent a magic link to your inbox. Click the link to sign in — no password needed."
      icon={<MailIcon />}
      footer={
        <>
          <Link
            href="/auth/login"
            className="text-body-sm text-text-soft transition-colors hover:text-text"
          >
            &larr; Use a different email
          </Link>
          <Link
            href="/"
            className="text-body-sm text-text-muted transition-colors hover:text-text-soft"
          >
            &larr; Back to home
          </Link>
        </>
      }
    >
      <p className="text-body-sm text-text-muted text-center">
        Didn&apos;t receive it? Check your spam folder, or use the link below
        to try with a different email address.
      </p>
    </AuthLayout>
  )
}
