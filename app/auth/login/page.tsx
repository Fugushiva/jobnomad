import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — JobNomad',
  description: 'Sign in to JobNomad with a magic link. No password needed.',
}

/**
 * /auth/login — Magic link login page.
 *
 * Uses the shared AuthLayout for consistent centering, Card, Logo, and footer.
 * Business logic lives entirely in LoginForm (client) and sendMagicLink (server action).
 */
export default function LoginPage() {
  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your email to receive a magic link. No password needed."
      footer={
        <Link
          href="/"
          className="text-body-sm text-text-muted transition-colors hover:text-text-soft"
        >
          &larr; Back to home
        </Link>
      }
    >
      <LoginForm />
    </AuthLayout>
  )
}
