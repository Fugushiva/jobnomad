/**
 * OnboardingWizard — 4-step client-side state machine for FM02.
 *
 * State machine:
 *   step 1: Timezone  → saveStep1()  → advance to step 2
 *   step 2: Skills    → saveStep2()  → advance to step 3
 *   step 3: Contract  → saveStep3()  → advance to step 4
 *   step 4: Rate      → completeOnboarding() → redirect /feed (server-side)
 *
 * Persistence: each "Continue" fires a Server Action before advancing.
 * If the user closes the tab at step 2, the page.tsx resumes them there.
 *
 * Loading states:
 *  - Buttons disabled + spinner during action pending
 *  - useTransition for non-blocking submit
 *
 * Error handling:
 *  - Field-level errors rendered inline
 *  - Server errors surfaced via toastError()
 */

'use client'

import { useState, useTransition, useCallback } from 'react'
import { StepIndicator } from './step-indicator'
import { TimezoneSelect } from './timezone-select'
import { SkillsTagInput } from './skills-tag-input'
import { ContractRadio } from './contract-radio'
import { RateInput } from './rate-input'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/toast'
import {
  saveStep1,
  saveStep2,
  saveStep3,
  completeOnboarding,
} from '@/app/(protected)/onboarding/actions'
import type {
  ContractPreference,
  RatePeriod,
} from '@/app/(protected)/onboarding/_lib/schemas'
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type OnboardingStep = 1 | 2 | 3 | 4

interface InitialProfile {
  timezone?: string | null
  skills?: string[] | null
  contract_preference?: string | null
  min_rate_usd?: number | null
  rate_period?: string | null
}

interface OnboardingWizardProps {
  initialStep: OnboardingStep
  initialProfile: InitialProfile
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function OnboardingWizard({
  initialStep,
  initialProfile,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep)
  const [isPending, startTransition] = useTransition()

  // Step 1 state
  const [timezone, setTimezone] = useState(initialProfile.timezone ?? '')
  const [timezoneError, setTimezoneError] = useState<string>()

  // Step 2 state
  const [skills, setSkills] = useState<string[]>(initialProfile.skills ?? [])
  const [skillsError, setSkillsError] = useState<string>()

  // Step 3 state
  const [contractPreference, setContractPreference] = useState<
    ContractPreference | ''
  >((initialProfile.contract_preference as ContractPreference | null) ?? '')
  const [contractError, setContractError] = useState<string>()

  // Step 4 state
  const [rateAmount, setRateAmount] = useState<number | null>(
    initialProfile.min_rate_usd ?? null
  )
  const [ratePeriod, setRatePeriod] = useState<RatePeriod | null>(
    (initialProfile.rate_period as RatePeriod | null) ?? null
  )
  const [rateError, setRateError] = useState<string>()

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleStep1 = useCallback(() => {
    setTimezoneError(undefined)

    if (!timezone) {
      setTimezoneError('Please select a timezone.')
      return
    }

    startTransition(async () => {
      const result = await saveStep1({ timezone })
      if ('error' in result) {
        toastError(result.error)
        return
      }
      setCurrentStep(2)
    })
  }, [timezone])

  const handleStep2 = useCallback(() => {
    setSkillsError(undefined)

    if (skills.length === 0) {
      setSkillsError('Please add at least 1 skill.')
      return
    }

    startTransition(async () => {
      const result = await saveStep2({ skills })
      if ('error' in result) {
        toastError(result.error)
        return
      }
      setCurrentStep(3)
    })
  }, [skills])

  const handleStep3 = useCallback(() => {
    setContractError(undefined)

    if (!contractPreference) {
      setContractError('Please select a contract preference.')
      return
    }

    startTransition(async () => {
      const result = await saveStep3({ contract_preference: contractPreference })
      if ('error' in result) {
        toastError(result.error)
        return
      }
      setCurrentStep(4)
    })
  }, [contractPreference])

  const handleStep4 = useCallback(() => {
    setRateError(undefined)

    startTransition(async () => {
      const result = await completeOnboarding({
        min_rate_usd: rateAmount ?? null,
        rate_period: ratePeriod ?? null,
      })
      if (result && 'error' in result) {
        toastError(result.error)
      }
      // On success, server does redirect('/feed') — no client action needed
    })
  }, [rateAmount, ratePeriod])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as OnboardingStep)
    }
  }, [currentStep])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8">
      {/* Progress bar */}
      <StepIndicator currentStep={currentStep} />

      {/* Step panels */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-md">
        {currentStep === 1 && (
          <StepPanel
            title="Where are you based?"
            description="We use your timezone to filter jobs that match your working hours."
          >
            <TimezoneSelect
              value={timezone}
              onChange={setTimezone}
              error={timezoneError}
              disabled={isPending}
            />
          </StepPanel>
        )}

        {currentStep === 2 && (
          <StepPanel
            title="What are your skills?"
            description="Add the technologies and skills you want to work with. We'll match you to relevant roles."
          >
            <SkillsTagInput
              value={skills}
              onChange={setSkills}
              error={skillsError}
              disabled={isPending}
            />
          </StepPanel>
        )}

        {currentStep === 3 && (
          <StepPanel
            title="What type of work are you looking for?"
            description="This helps us filter out contract types that don't match your preferences."
          >
            <ContractRadio
              value={contractPreference}
              onChange={setContractPreference}
              error={contractError}
              disabled={isPending}
            />
          </StepPanel>
        )}

        {currentStep === 4 && (
          <StepPanel
            title="What's your minimum rate?"
            description="Optional. We'll hide jobs that don't meet your salary expectations."
          >
            <RateInput
              amount={rateAmount}
              period={ratePeriod}
              onAmountChange={setRateAmount}
              onPeriodChange={setRatePeriod}
              error={rateError}
              disabled={isPending}
            />
          </StepPanel>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {/* Back button */}
          {currentStep > 1 ? (
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={isPending}
              aria-label="Go back to previous step"
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back
            </Button>
          ) : (
            <span /> /* spacer */
          )}

          {/* Continue / Complete */}
          {currentStep < 4 ? (
            <Button
              onClick={
                currentStep === 1
                  ? handleStep1
                  : currentStep === 2
                  ? handleStep2
                  : handleStep3
              }
              disabled={isPending}
              aria-label={`Continue to step ${currentStep + 1}`}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" aria-hidden />
              )}
              {isPending ? 'Saving…' : 'Continue'}
            </Button>
          ) : (
            <Button
              onClick={handleStep4}
              disabled={isPending}
              aria-label="Complete profile setup"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
              )}
              {isPending ? 'Setting up your feed…' : 'Complete profile'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepPanel — wrapper for each step's content
// ---------------------------------------------------------------------------
function StepPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-display-md text-text">{title}</h2>
        <p className="mt-1 text-body-md text-text-soft">{description}</p>
      </div>
      {children}
    </div>
  )
}
