/**
 * ContractRadio — Radio group for contract preference selection.
 *
 * Options: Contractor / Employee / Both
 * Renders as visual cards with icons for scannability.
 *
 * Accessibility:
 *  - radiogroup role with aria-labelledby
 *  - Each option is a native radio input (keyboard nav, screen reader)
 *  - Selected state visible via border highlight + aria-checked on label
 */

'use client'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ContractPreference } from '@/app/(protected)/onboarding/_lib/schemas'
import { Briefcase, UserCheck, Users } from 'lucide-react'

interface ContractOption {
  value: ContractPreference
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const CONTRACT_OPTIONS: ContractOption[] = [
  {
    value: 'contractor',
    label: 'Freelance / Contractor',
    description: 'Fixed-term contracts, project-based work, B2B invoicing.',
    icon: Briefcase,
  },
  {
    value: 'employee',
    label: 'Full-time Employee',
    description: 'Long-term employment with benefits and payroll.',
    icon: UserCheck,
  },
  {
    value: 'both',
    label: 'Open to both',
    description: "I'm flexible — show me all matching opportunities.",
    icon: Users,
  },
]

interface ContractRadioProps {
  value: ContractPreference | ''
  onChange: (v: ContractPreference) => void
  error?: string
  disabled?: boolean
}

export function ContractRadio({
  value,
  onChange,
  error,
  disabled,
}: ContractRadioProps) {
  const errorId = 'contract-error'

  return (
    <div className="flex flex-col gap-2">
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ContractPreference)}
        aria-label="Contract preference"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        className="flex flex-col gap-3"
        disabled={disabled}
      >
        {CONTRACT_OPTIONS.map(({ value: optVal, label, description, icon: Icon }) => {
          const isSelected = value === optVal

          return (
            <div key={optVal}>
              <RadioGroupItem
                value={optVal}
                id={`contract-${optVal}`}
                className="peer sr-only"
              />
              <Label
                htmlFor={`contract-${optVal}`}
                className={cn(
                  'flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all',
                  'hover:border-primary/50 hover:bg-surface',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-ring'
                    : 'border-border bg-bg',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    isSelected ? 'bg-primary/10 text-primary' : 'bg-surface text-text-muted'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-text">{label}</span>
                  <span className="text-sm text-text-muted">{description}</span>
                </div>
              </Label>
            </div>
          )
        })}
      </RadioGroup>

      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
