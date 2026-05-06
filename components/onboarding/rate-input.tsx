/**
 * RateInput — Numeric input for minimum rate + period selector.
 *
 * UX:
 *  - Amount field (USD only in phase 1)
 *  - Period select: hourly / daily / monthly / yearly
 *  - Both fields optional (user can skip)
 *  - Clear button resets both fields
 *
 * Accessibility:
 *  - Input group labeled via fieldset + legend
 *  - Amount and period are associated via aria-labelledby
 *  - Error announced via aria-live
 */

'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RatePeriod } from '@/app/(protected)/onboarding/_lib/schemas'
import { RATE_PERIOD_VALUES } from '@/app/(protected)/onboarding/_lib/schemas'
import { X } from 'lucide-react'

const PERIOD_LABELS: Record<RatePeriod, string> = {
  hour: 'per hour',
  day: 'per day',
  month: 'per month',
  year: 'per year',
}

interface RateInputProps {
  amount: number | null
  period: RatePeriod | null
  onAmountChange: (v: number | null) => void
  onPeriodChange: (v: RatePeriod | null) => void
  error?: string
  disabled?: boolean
}

export function RateInput({
  amount,
  period,
  onAmountChange,
  onPeriodChange,
  error,
  disabled,
}: RateInputProps) {
  const errorId = 'rate-error'
  const hasValues = amount != null || period != null

  const handleAmountChange = (raw: string) => {
    if (raw === '' || raw === undefined) {
      onAmountChange(null)
      return
    }
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1_000_000) {
      onAmountChange(parsed)
    }
  }

  const handleClear = () => {
    onAmountChange(null)
    onPeriodChange(null)
  }

  return (
    <fieldset className="flex flex-col gap-3 border-none p-0 m-0">
      <legend className="sr-only">Minimum rate</legend>

      <div className="flex items-start gap-2">
        {/* Currency prefix */}
        <div
          className="flex h-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm text-text-muted"
          aria-label="Currency: USD"
        >
          USD
        </div>

        {/* Amount */}
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={1_000_000}
          step={1}
          placeholder="0"
          value={amount ?? ''}
          onChange={(e) => handleAmountChange(e.target.value)}
          disabled={disabled}
          aria-label="Minimum rate amount in USD"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={cn(
            'w-32',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />

        {/* Period selector */}
        <Select
          value={period ?? ''}
          onValueChange={(v) =>
            onPeriodChange(v === '' ? null : (v as RatePeriod))
          }
          disabled={disabled}
        >
          <SelectTrigger
            aria-label="Rate period"
            className={cn(
              'w-36',
              error && !period && 'border-red-500 focus-visible:ring-red-500'
            )}
          >
            <SelectValue placeholder="per…" />
          </SelectTrigger>
          <SelectContent>
            {RATE_PERIOD_VALUES.map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear both */}
        {hasValues && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear rate"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>

      {/* Computed display */}
      {amount != null && period != null && (
        <p className="text-sm text-text-soft" aria-live="polite">
          Minimum: USD {amount.toLocaleString()} {PERIOD_LABELS[period]}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <p className="text-xs text-text-muted">
        This is optional. Leave blank to see all salary ranges.
      </p>
    </fieldset>
  )
}
