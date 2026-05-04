import type { Metadata } from 'next'
import { Bookmark } from 'lucide-react'
import { getUser } from '@/src/lib/auth/get-user'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { EmptyState } from '@/components/states/empty-state'

export const metadata: Metadata = {
  title: 'Your feed — JobNomad',
  description: 'Personalized remote job matches for your profile.',
}

/**
 * /feed — Authenticated feed page (stub).
 *
 * Refactored: uses Header (app variant), Footer, EmptyState components.
 * Full implementation in a future issue (F-M05/F-M06 spec).
 */
export default async function FeedPage() {
  const { user } = await getUser()

  return (
    <div className="flex flex-col flex-1 bg-bg text-text">
      <Header variant="app" userEmail={user?.email} />

      <main id="main" className="flex flex-col flex-1 px-6 py-12">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-8">
            <h1 className="text-display-lg text-text">Your feed</h1>
            <p className="text-body-lg text-text-soft mt-1">
              Signed in as{' '}
              <span className="text-mono-sm text-primary">{user?.email}</span>
            </p>
          </div>

          {/* Feed placeholder — replace with real DB query in F-M05 */}
          <EmptyState
            icon={Bookmark}
            heading="Your feed is coming soon"
            description="Complete your profile to receive personalized remote job matches."
            action={{ label: 'Complete profile', href: '/onboarding' }}
          />
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}
