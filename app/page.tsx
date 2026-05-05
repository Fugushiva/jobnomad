import Link from 'next/link'
import type { Metadata } from 'next'

import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { JobCard, type JobCardData } from '@/components/jobs/job-card'
import { Button } from '@/components/ui/button'
import { SignedOutToast } from '@/components/auth/signed-out-toast'

export const metadata: Metadata = {
  title: 'JobNomad — Remote jobs for digital nomads',
  description:
    'Curated remote jobs matched to your skills and timezone. Apply only to positions that truly fit.',
}

/** Sample data for the landing page preview (no PII, no auth required) */
const SAMPLE_JOBS: JobCardData[] = [
  {
    id: '1',
    company: 'Async-First Co.',
    title: 'Senior Full-Stack Engineer',
    timezone: 'UTC±4',
    type: 'contractor',
    posted: '2h ago',
    salary: '$120–150k',
    score: 92,
    tags: ['TypeScript', 'Next.js', 'Postgres'],
    applyUrl: 'https://remoteok.com',
  },
  {
    id: '2',
    company: 'Remote Platform Inc.',
    title: 'Product Designer',
    timezone: 'UTC±6',
    type: 'full-time',
    posted: '5h ago',
    salary: '$90–110k',
    score: 74,
    tags: ['Figma', 'Design systems', 'B2B'],
    applyUrl: 'https://remoteok.com',
  },
  {
    id: '3',
    company: 'Distributed Labs',
    title: 'DevOps Engineer',
    timezone: 'UTC±8',
    type: 'contract',
    posted: '14h ago',
    salary: '$100–130k',
    score: 41,
    tags: ['Kubernetes', 'AWS', 'Terraform'],
    applyUrl: 'https://remoteok.com',
  },
]

/**
 * Next.js 16: searchParams is a Promise — must be awaited.
 * The `signed_out` param is set by the signOut Server Action redirect.
 * It is a boolean UI signal only — never reflected as raw text content.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ signed_out?: string }>
}) {
  const params = await searchParams
  const showSignedOutToast = params.signed_out === '1'

  return (
    <div className="flex flex-col flex-1 bg-bg text-text">
      {/* Fires a confirmation toast and removes ?signed_out=1 from the URL */}
      <SignedOutToast show={showSignedOutToast} />
      <Header variant="public" />

      <main id="main" className="flex flex-col flex-1">
        {/* -- Hero --------------------------------------------------------- */}
        <section
          className="flex flex-col items-center text-center px-6 pt-20 pb-16 bg-bg"
          aria-labelledby="hero-heading"
        >
          {/* Eyebrow */}
          <p className="text-overline text-primary mb-4">
            Direction &middot; Sable lumineux
          </p>

          {/* Display headline */}
          <h1
            id="hero-heading"
            className="text-display-2xl max-w-3xl mb-6 text-text"
          >
            Remote jobs for a{' '}
            <em className="text-primary not-italic" style={{ fontStyle: 'italic' }}>
              calm,
            </em>{' '}
            focused workday.
          </h1>

          {/* Sub */}
          <p className="text-body-xl max-w-xl mb-10 text-text-soft">
            JobNomad matches your skills and timezone to real remote roles —
            no noise, no spray-and-pray.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/auth/login">Start for free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/jobs">Browse jobs</Link>
            </Button>
          </div>
        </section>

        {/* -- Sample job cards ------------------------------------------- */}
        <section
          className="flex-1 px-6 py-16 bg-bg-tint"
          aria-labelledby="sample-jobs-heading"
        >
          <div className="mx-auto max-w-4xl">
            <h2
              id="sample-jobs-heading"
              className="text-display-lg text-text mb-2"
            >
              Today&apos;s real remote.
            </h2>
            <p className="text-body-lg text-text-soft mb-10">
              Positions updated every hour. Match score updates when you complete
              your profile.
            </p>

            {/* Card list */}
            <ul className="flex flex-col gap-3 list-none p-0 m-0" role="list">
              {SAMPLE_JOBS.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
