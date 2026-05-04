/**
 * Layout for all protected routes (requires authentication).
 *
 * Auth guard lives here so every page in the (protected) group
 * automatically requires a valid session. No per-page boilerplate.
 *
 * Redirect target: /auth/login?next=<current-path>
 */
import { redirect } from 'next/navigation'
import { getUser } from '@/src/lib/auth/get-user'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await getUser()

  if (!user) {
    // Can't read the current path in a layout (no request object),
    // so we redirect to /auth/login without a next param.
    // The login form's success flow redirects to /feed by default.
    redirect('/auth/login')
  }

  return <>{children}</>
}
