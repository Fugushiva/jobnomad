import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/src/lib/auth/get-user'
import { parseFeedFilters } from '@/src/lib/feed/schemas'
import { fetchFeedJobs } from '@/src/lib/feed/queries'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { FeedFilters } from '@/components/feed/feed-filters'
import { JobFeedList } from '@/components/feed/job-feed-list'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Your feed — JobNomad',
  description: 'Personalized remote job matches for your profile.',
}

/**
 * /feed — Authenticated feed page (Phase 1: plain SELECT, no scoring).
 *
 * Guards:
 *  - Not authenticated  → /auth/login  (layout handles this; belt+braces here)
 *  - Onboarding pending → /onboarding
 *
 * searchParams are async per Next.js 16 convention (see AGENTS.md).
 *
 * Architecture: this Server Component is the only place that fetches data.
 * FeedFilters + JobFeedList are pure presentational — they receive data as
 * props. No client-side fetching in Phase 1.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // -- Auth + onboarding guards --------------------------------------------
  const { user, profile, supabase: userSupabase } = await getUserWithProfile()

  if (!user) redirect('/auth/login')
  if (!profile?.onboarding_completed_at) redirect('/onboarding')

  // -- Parse + validate filters from URL query params ----------------------
  const rawParams = await searchParams
  const filters = parseFeedFilters(rawParams)

  // -- Fetch jobs ----------------------------------------------------------
  // We use the user-context client (row-level security active) so the
  // `jobs_select_active` policy applies automatically.
  let feedResult: Awaited<ReturnType<typeof fetchFeedJobs>> | null = null
  let fetchError: string | null = null

  try {
    feedResult = await fetchFeedJobs(userSupabase, filters, filters.page)
  } catch (err) {
    console.error('[feed] fetch failed', err)
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  // -- Render --------------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 bg-bg text-text">
      <Header variant="app" userEmail={user.email} />

      <main id="main" className="flex flex-col flex-1 px-4 sm:px-6 py-8">
        <div className="mx-auto w-full max-w-5xl">
          {/* -- Page header ----------------------------------------------- */}
          <div className="mb-6">
            <h1 className="text-display-lg text-text">Your feed</h1>
            <p className="text-body-md text-text-soft mt-1">
              Remote jobs sorted by date — newest first
            </p>
          </div>

          {/* -- Mobile filters trigger + content row ---------------------- */}
          <div className="flex flex-col gap-4">
            {/* Mobile: filters button above the list */}
            <div className="md:hidden">
              <FeedFilters filters={filters} />
            </div>

            {/* Desktop: sidebar + list side-by-side */}
            <div className="flex gap-8 items-start">
              {/* Desktop sidebar */}
              <FeedFilters filters={filters} />

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {fetchError ? (
                  <div
                    role="alert"
                    className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6"
                  >
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-danger-soft">
                      <AlertCircle className="h-6 w-6 text-danger" aria-hidden />
                    </div>
                    <div className="flex flex-col gap-1.5 max-w-xs">
                      <h3 className="text-display-sm text-text">Failed to load jobs</h3>
                      <p className="text-body-md text-text-soft">
                        Something went wrong fetching your feed. Please try refreshing.
                      </p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href="/feed">Refresh</Link>
                    </Button>
                  </div>
                ) : (
                  <JobFeedList
                    jobs={feedResult?.jobs ?? []}
                    total={feedResult?.total ?? 0}
                    page={filters.page}
                    filters={filters}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}
