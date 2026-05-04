import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — JobNomad',
  description: 'Sign in to JobNomad with a magic link. No password needed.',
}

/**
 * /auth/login — Magic link login page.
 *
 * Refactored: uses Card + Logo components, eliminates all inline styles.
 */
export default function LoginPage() {
  return (
    <main
      id="main"
      className="flex flex-col flex-1 items-center justify-center px-6 py-12 bg-bg"
    >
      <Card className="w-full max-w-sm rounded-2xl shadow-md">
        <CardHeader className="flex flex-col items-center gap-6 pb-0">
          <Logo href="/" size={28} label="JobNomad — home" />

          <div className="flex flex-col items-center text-center gap-2">
            <h1 className="text-display-md text-text">Sign in</h1>
            <p className="text-body-md text-text-soft">
              Enter your email to receive a magic link.
              <br />
              No password needed.
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
      </Card>

      {/* Back to home */}
      <Link
        href="/"
        className="text-body-sm mt-6 text-text-muted transition-colors hover:text-text-soft"
      >
        &larr; Back to home
      </Link>
    </main>
  )
}
