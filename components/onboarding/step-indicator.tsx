/**
 * StepIndicator — accessible 4-step progress bar for the onboarding wizard.
 *
 * Accessibility:
 *  - nav[aria-label] wraps the whole bar
 *  - Each step has aria-current="step" when active
 *  - Completed steps carry aria-label including "completed" for screen readers
 *  - Keyboard-navigable (role="list" with listitems)
 */

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4
  totalSteps?: number
}

const STEP_LABELS: Record<number, string> = {
  1: 'Timezone',
  2: 'Skills',
  3: 'Contract',
  4: 'Rate',
}

export function StepIndicator({ currentStep, totalSteps = 4 }: StepIndicatorProps) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol
        role="list"
        className="flex items-center justify-center gap-2 sm:gap-4"
      >
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isCompleted = step < currentStep
          const isActive = step === currentStep
          const label = STEP_LABELS[step] ?? `Step ${step}`

          return (
            <li
              key={step}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              aria-label={
                isCompleted
                  ? `${label} — completed`
                  : isActive
                  ? `${label} — current step`
                  : `${label} — upcoming`
              }
              className="flex items-center gap-2"
            >
              {/* Step circle */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isActive &&
                    'border-primary bg-bg text-primary shadow-ring',
                  !isCompleted &&
                    !isActive &&
                    'border-border bg-bg text-text-muted'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <span aria-hidden>{step}</span>
                )}
              </div>

              {/* Step label — hidden on very small screens */}
              <span
                className={cn(
                  'hidden text-sm sm:inline',
                  isActive ? 'font-medium text-text' : 'text-text-muted'
                )}
                aria-hidden /* accessible name is on the li */
              >
                {label}
              </span>

              {/* Connector line (between steps) */}
              {step < totalSteps && (
                <div
                  aria-hidden
                  className={cn(
                    'h-0.5 w-6 sm:w-10 rounded-full transition-colors',
                    step < currentStep ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* Screen reader summary */}
      <p className="sr-only">
        Step {currentStep} of {totalSteps}: {STEP_LABELS[currentStep]}
      </p>
    </nav>
  )
}
