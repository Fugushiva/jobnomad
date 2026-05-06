import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/src/lib/auth/get-user'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import type { OnboardingStep } from '@/components/onboarding/onboarding-wizard'

export const metadata: Metadata = {
  title: 'Complete your profile — JobNomad',
  description: 'Set up your profile to receive personalized remote job matches.',
}

/**
 * /onboarding — 4-step profile wizard (FM02).
 *
 * Server Component responsibilities:
 *  1. Auth check (belt + braces on top of the layout guard)
 *  2. If onboarding already complete → redirect /feed
 *  3. Determine which step the user left off at (reprise)
 *  4. Pass initial state to the client wizard
 *
 * Resume logic (no new DB column needed):
 *  - No profile row / no timezone → step 1
 *  - Timezone set, skills empty    → step 2
 *  - Skills present                → step 3 (safe: contract step is fast to redo)
 *  - contract_preference present   → step 4
 *  - onboarding_completed_at set   → redirect /feed
 */
export default async function OnboardingPage() {
  const { user, profile } = await getUserWithProfile()

  if (!user) redirect('/auth/login')
  if (profile?.onboarding_completed_at) redirect('/feed')

  const resumeStep = computeResumeStep(profile)

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <Header variant="app" userEmail={user.email} />

      <main
        id="main"
        className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6"
      >
        <div className="w-full max-w-xl">
          <div className="mb-8 text-center">
            <h1 className="text-display-lg text-text">Set up your profile</h1>
            <p className="mt-2 text-body-lg text-text-soft">
              Takes less than 3 minutes. We only ask for what we need to match
              you with the right remote jobs.
            </p>
          </div>

          <OnboardingWizard
            initialStep={resumeStep}
            initialProfile={{
              timezone: profile?.timezone ?? null,
              skills: profile?.skills as string[] | null,
              contract_preference: profile?.contract_preference ?? null,
              min_rate_usd: profile?.min_rate_usd ?? null,
              rate_period: profile?.rate_period ?? null,
            }}
          />
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resume step computation
// ---------------------------------------------------------------------------
function computeResumeStep(
  profile: {
    timezone?: string | null
    skills?: unknown
    contract_preference?: string | null
  } | null
): OnboardingStep {
  if (!profile || !profile.timezone) return 1

  const skillsArray = Array.isArray(profile.skills) ? profile.skills : []
  if (skillsArray.length === 0) return 2

  if (!profile.contract_preference) return 3

  return 4
}
