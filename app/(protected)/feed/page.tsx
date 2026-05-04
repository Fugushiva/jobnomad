import type { Metadata } from 'next'
import { getUser } from '@/src/lib/auth/get-user'

export const metadata: Metadata = {
  title: 'Your feed — JobNomad',
  description: 'Personalized remote job matches for your profile.',
}

/**
 * /feed — Main authenticated page (stub).
 *
 * Will show personalized job matches once the scoring pipeline is built.
 * For now: confirms the user is authenticated and shows a placeholder.
 */
export default async function FeedPage() {
  const { user } = await getUser()

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center px-6 py-12"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-lg flex flex-col items-center text-center gap-6 p-8 border"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
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
            <path d="M12 20h9" />
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
          </svg>
        </div>

        <h1 className="text-display-lg" style={{ color: 'var(--text)' }}>
          Welcome back
        </h1>
        <p className="text-body-lg" style={{ color: 'var(--text-soft)' }}>
          Signed in as{' '}
          <span className="text-mono-sm" style={{ color: 'var(--primary)' }}>
            {user?.email}
          </span>
        </p>
        <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>
          Your personalized job feed is coming soon.
          Complete your profile to start receiving matches.
        </p>

        {/* Sign out form (POST for CSRF safety) */}
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="text-label-md px-4 py-2 border transition-colors"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--text)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface)',
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
