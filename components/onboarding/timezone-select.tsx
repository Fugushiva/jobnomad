/**
 * TimezoneSelect — Combobox for selecting an IANA timezone.
 *
 * UX:
 *  - Starts with the APAC-relevant list (15 timezones shown immediately)
 *  - "Other timezone…" item expands to the full IANA list (searchable)
 *  - Browser default is pre-detected and offered as a hint
 *  - Keyboard accessible: Arrow keys navigate, Enter selects, Escape closes
 *
 * Accessibility:
 *  - Uses Radix Popover + shadcn Command (cmdk) under the hood
 *  - aria-expanded, aria-controls on the trigger
 *  - role="combobox" + role="listbox" pair
 */

'use client'

import { useState, useCallback } from 'react'
import { Check, ChevronsUpDown, Globe } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  APAC_TIMEZONES,
  getAllTimezones,
  formatTimezoneLabel,
} from '@/app/(protected)/onboarding/_lib/timezones'

interface TimezoneSelectProps {
  value: string
  onChange: (tz: string) => void
  error?: string
  disabled?: boolean
}

export function TimezoneSelect({
  value,
  onChange,
  error,
  disabled,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Detect browser timezone for the hint
  const browserTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null

  const allTimezones = getAllTimezones()
  const displayedTimezones = showAll ? allTimezones : APAC_TIMEZONES

  const handleSelect = useCallback(
    (tz: string) => {
      onChange(tz)
      setOpen(false)
    },
    [onChange]
  )

  const displayLabel = value ? formatTimezoneLabel(value) : 'Select your timezone…'

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={value ? `Selected timezone: ${displayLabel}` : 'Select timezone'}
            aria-invalid={!!error}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-text-muted',
              error && 'border-red-500 focus-visible:ring-red-500'
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <Globe className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <span className="truncate">{displayLabel}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search timezone…" autoFocus />
            <CommandList>
              <CommandEmpty>No timezone found.</CommandEmpty>

              {/* Browser detected timezone suggestion */}
              {browserTz && !value && (
                <>
                  <CommandGroup heading="Suggested">
                    <CommandItem
                      value={browserTz}
                      onSelect={() => handleSelect(browserTz)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === browserTz ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {formatTimezoneLabel(browserTz)}
                      <span className="ml-auto text-xs text-text-muted">
                        Browser default
                      </span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* APAC / All timezones */}
              <CommandGroup heading={showAll ? 'All timezones' : 'APAC (common)'}>
                {displayedTimezones.map((tz) => (
                  <CommandItem
                    key={tz}
                    value={tz}
                    onSelect={() => handleSelect(tz)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === tz ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {formatTimezoneLabel(tz)}
                  </CommandItem>
                ))}
              </CommandGroup>

              {/* Expand to all */}
              {!showAll && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => setShowAll(true)}
                      className="text-primary"
                    >
                      <ChevronsUpDown className="mr-2 h-4 w-4" aria-hidden />
                      Other timezone…
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
