/**
 * FeedFilters — filter panel for the job feed.
 *
 * Layout:
 *   Desktop: sticky left sidebar (shown via CSS at md+)
 *   Mobile:  Sheet (drawer) triggered by a "Filters" button
 *
 * Filters are submitted as URL query params via a plain <form> with
 * method="get" action="/feed" — no JS required for basic usage. This
 * keeps the feed fully server-rendered and sharable via URL.
 *
 * Active filter count badge shows on mobile trigger for discoverability.
 */

'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import type { FeedFilters } from '@/src/lib/feed/schemas'

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const CONTRACT_OPTIONS = [
  { value: 'contractor', label: 'Contractor / Freelance' },
  { value: 'employee', label: 'Employee (Full-time)' },
  { value: 'both', label: 'Either' },
]

const SENIORITY_OPTIONS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Principal' },
  { value: 'any', label: 'Any level' },
]

const GEO_OPTIONS = [
  { value: 'worldwide', label: 'Worldwide' },
  { value: 'specific_regions', label: 'Specific regions' },
  { value: 'specific_countries', label: 'Specific countries' },
]

const SALARY_PRESETS = [
  { value: 40000, label: '$40k+' },
  { value: 60000, label: '$60k+' },
  { value: 80000, label: '$80k+' },
  { value: 100000, label: '$100k+' },
  { value: 120000, label: '$120k+' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countActiveFilters(filters: FeedFilters): number {
  let n = 0
  if (filters.contract) n++
  if (filters.seniority) n++
  if (filters.geo_policy) n++
  if (filters.salary_min != null) n++
  return n
}

// ---------------------------------------------------------------------------
// Inner form (shared between sidebar + sheet)
// ---------------------------------------------------------------------------

interface FilterFormProps {
  filters: FeedFilters
}

function FilterForm({ filters }: FilterFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  function handleChange() {
    // Auto-submit on any filter change so the URL updates immediately.
    // The form's native serialisation handles everything — we just need to
    // reset to page 1 on filter change.
    if (!formRef.current) return
    const data = new FormData(formRef.current)
    const params = new URLSearchParams()
    for (const [k, v] of data.entries()) {
      if (typeof v === 'string' && v) params.set(k, v)
    }
    // Always reset to page 1 when filters change
    params.delete('page')
    router.push(`/feed?${params.toString()}`)
  }

  function handleReset() {
    router.push('/feed')
  }

  return (
    <form
      ref={formRef}
      method="get"
      action="/feed"
      className="flex flex-col gap-6"
      aria-label="Job filters"
    >
      {/* -- Contract type -------------------------------------------------- */}
      <fieldset className="flex flex-col gap-2 border-none p-0 m-0">
        <legend className="text-label-sm text-text font-medium mb-1">Contract type</legend>
        {CONTRACT_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-body-sm text-text-soft">
            <input
              type="radio"
              name="contract"
              value={opt.value}
              defaultChecked={filters.contract === opt.value}
              onChange={handleChange}
              className="accent-primary"
            />
            {opt.label}
          </label>
        ))}
        {filters.contract && (
          <button
            type="button"
            onClick={() => {
              if (formRef.current) {
                const radios = formRef.current.querySelectorAll<HTMLInputElement>('input[name="contract"]')
                radios.forEach(r => { r.checked = false })
              }
              handleChange()
            }}
            className="text-label-xs text-text-muted hover:text-text-soft transition-colors text-left mt-0.5"
          >
            Clear
          </button>
        )}
      </fieldset>

      {/* -- Seniority ------------------------------------------------------- */}
      <fieldset className="flex flex-col gap-2 border-none p-0 m-0">
        <legend className="text-label-sm text-text font-medium mb-1">Seniority</legend>
        {SENIORITY_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-body-sm text-text-soft">
            <input
              type="radio"
              name="seniority"
              value={opt.value}
              defaultChecked={filters.seniority === opt.value}
              onChange={handleChange}
              className="accent-primary"
            />
            {opt.label}
          </label>
        ))}
        {filters.seniority && (
          <button
            type="button"
            onClick={() => {
              if (formRef.current) {
                const radios = formRef.current.querySelectorAll<HTMLInputElement>('input[name="seniority"]')
                radios.forEach(r => { r.checked = false })
              }
              handleChange()
            }}
            className="text-label-xs text-text-muted hover:text-text-soft transition-colors text-left mt-0.5"
          >
            Clear
          </button>
        )}
      </fieldset>

      {/* -- Geo policy ------------------------------------------------------ */}
      <fieldset className="flex flex-col gap-2 border-none p-0 m-0">
        <legend className="text-label-sm text-text font-medium mb-1">Location policy</legend>
        {GEO_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-body-sm text-text-soft">
            <input
              type="radio"
              name="geo_policy"
              value={opt.value}
              defaultChecked={filters.geo_policy === opt.value}
              onChange={handleChange}
              className="accent-primary"
            />
            {opt.label}
          </label>
        ))}
        {filters.geo_policy && (
          <button
            type="button"
            onClick={() => {
              if (formRef.current) {
                const radios = formRef.current.querySelectorAll<HTMLInputElement>('input[name="geo_policy"]')
                radios.forEach(r => { r.checked = false })
              }
              handleChange()
            }}
            className="text-label-xs text-text-muted hover:text-text-soft transition-colors text-left mt-0.5"
          >
            Clear
          </button>
        )}
      </fieldset>

      {/* -- Minimum salary -------------------------------------------------- */}
      <fieldset className="flex flex-col gap-2 border-none p-0 m-0">
        <legend className="text-label-sm text-text font-medium mb-1">
          Minimum salary (USD / year)
        </legend>
        <Label htmlFor="salary_min" className="sr-only">Minimum salary preset</Label>
        <select
          id="salary_min"
          name="salary_min"
          defaultValue={filters.salary_min != null ? String(filters.salary_min) : ''}
          onChange={handleChange}
          className="w-full rounded-md border border-border bg-surface text-body-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">No minimum</option>
          {SALARY_PRESETS.map((p) => (
            <option key={p.value} value={String(p.value)}>
              {p.label}
            </option>
          ))}
        </select>
      </fieldset>

      {/* -- Reset all ------------------------------------------------------- */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleReset}
        className="w-full text-text-muted"
      >
        <X className="h-3.5 w-3.5 mr-1.5" aria-hidden />
        Reset all filters
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface FeedFiltersProps {
  filters: FeedFilters
}

export function FeedFilters({ filters }: FeedFiltersProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <>
      {/* -- Desktop sidebar (md+) ----------------------------------------- */}
      <aside
        className="hidden md:flex flex-col gap-2 w-56 shrink-0 sticky top-6 self-start"
        aria-label="Filter jobs"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-label-md text-text font-medium">Filters</span>
          {activeCount > 0 && (
            <Badge variant="secondary" size="sm">
              {activeCount}
            </Badge>
          )}
        </div>
        <FilterForm filters={filters} />
      </aside>

      {/* -- Mobile trigger (< md) ----------------------------------------- */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {activeCount > 0 && (
                <Badge variant="secondary" size="sm" className="ml-1">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>Filter jobs</SheetTitle>
            </SheetHeader>
            <FilterForm filters={filters} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
