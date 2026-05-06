import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { getUserWithProfile } from '@/src/lib/auth/get-user'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { EmptyState } from '@/components/states/empty-state'
import { SavedJobList } from '@/components/jobs/saved-job-list'

export const metadata: Metadata = {
  title: 'Saved jobs — JobNomad',
  description: 'Your bookmarked remote job listings.',
}

/**
 * /saved — Authenticated saved-jobs page (FM08).
 *
 * Guards: not authenticated → /auth/login, onboarding pending → /onboarding.
 *
 * Architecture:
 *  - Server Component: fetches saved_jobs JOIN jobs, passes data to
 *    SavedJobList (Client Component handles status updates + unsave).
 *  - RLS: only the authenticated user's rows are returned automatically.
 */
export default async function SavedPage() {
  const { user, profile, supabase } = await getUserWithProfile()

  if (!user) redirect('/auth/login')
  if (!profile?.onboarding_completed_at) redirect('/onboarding')

  // Fetch saved jobs with job details, newest first
  const { data: savedJobs, error } = await supabase
    .from('saved_jobs')
    .select(
      `
      id,
      job_id,
      status,
      saved_at,
      updated_at,
      jobs (
        id,
        title,
        company,
        source_url,
        salary_min,
        salary_max,
        salary_currency,
        salary_period,
        contract_type,
        skills_required,
        posted_at
      )
    `,
    )
    .order('saved_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[saved] fetch error:', error.code)
  }

  const items = (savedJobs ?? []).filter((row) => row.jobs !== null)

  return (
    <div className="flex flex-col flex-1 bg-bg text-text">
      <Header variant="app" userEmail={user.email} />

      <main id="main" className="flex flex-col flex-1 px-4 sm:px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-6">
            <h1 className="text-display-lg text-text">Saved jobs</h1>
            <p className="text-body-md text-text-soft mt-1">
              {items.length > 0
                ? `${items.length} saved job${items.length !== 1 ? 's' : ''}`
                : 'Jobs you bookmark appear here.'}
            </p>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              heading="No saved jobs yet"
              description="Bookmark jobs from your feed to review later."
              action={{ label: 'Browse jobs', href: '/feed' }}
            />
          ) : (
            <SavedJobList items={items as SavedJobItem[]} />
          )}
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}

// Re-export type so SavedJobList can import it
export type SavedJobItem = {
  id: string
  job_id: string
  status: string
  saved_at: string
  updated_at: string
  jobs: {
    id: string
    title: string
    company: string
    source_url: string
    salary_min: number | null
    salary_max: number | null
    salary_currency: string | null
    salary_period: string | null
    contract_type: string | null
    skills_required: string[]
    posted_at: string | null
  }
}
