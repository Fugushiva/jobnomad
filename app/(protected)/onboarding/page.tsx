import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Complete your profile — JobNomad',
  description: 'Set up your profile to receive personalized remote job matches.',
}

/**
 * /onboarding — Profile setup page (stub).
 *
 * Will collect: preferred_title, skills, timezone, salary_range,
 * work_style preferences. For now: placeholder with auth confirmation.
 */
export default function OnboardingPage() {
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
          style={{ backgroundColor: 'var(--accent-soft)' }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>

        <h1 className="text-display-lg" style={{ color: 'var(--text)' }}>
          Complete your profile
        </h1>
        <p className="text-body-lg" style={{ color: 'var(--text-soft)' }}>
          Tell us about your skills, timezone, and preferences so we can match
          you with the right remote roles.
        </p>
        <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>
          Profile setup form coming soon.
        </p>

        <a
          href="/feed"
          className="text-label-md px-4 py-2 transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Go to feed
        </a>
      </div>
    </div>
  )
}
