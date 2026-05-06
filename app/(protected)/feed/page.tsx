import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { getUserWithProfile } from '@/src/lib/auth/get-user'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { EmptyState } from '@/components/states/empty-state'

export const metadata: Metadata = {
  title: 'Your feed — JobNomad',
  description: 'Personalized remote job matches for your profile.',
}

/**
 * /feed — Authenticated feed page.
 *
 * Guards:
 *  - Not authenticated → /auth/login (layout handles this, we add belt+braces)
 *  - Onboarding incomplete → /onboarding
 *
 * Full feed implementation in issue #9 (F-M05/F-M06).
 */
export default async function FeedPage() {
  const { user, profile } = await getUserWithProfile()

  if (!user) redirect('/auth/login')

  // Onboarding guard — must complete wizard before accessing feed
  if (!profile?.onboarding_completed_at) redirect('/onboarding')

  return (
    <div className="flex flex-col flex-1 bg-bg text-text">
      <Header variant="app" userEmail={user.email} />

      <main id="main" className="flex flex-col flex-1 px-6 py-12">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-8">
            <h1 className="text-display-lg text-text">Your feed</h1>
            <p className="text-body-lg text-text-soft mt-1">
              Signed in as{' '}
              <span className="text-mono-sm text-primary">{user.email}</span>
            </p>
          </div>

          {/* Feed placeholder — replace with real DB query in issue #9 (F-M05) */}
          <EmptyState
            icon={Bookmark}
            heading="Jobs are loading"
            description="Your personalized feed is almost ready. Come back in a minute or refresh."
            action={{ label: 'Refresh feed', href: '/feed' }}
          />
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}
