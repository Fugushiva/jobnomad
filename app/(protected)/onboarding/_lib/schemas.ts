/**
 * Zod schemas for the 4-step onboarding wizard (FM02).
 *
 * Step 1 — Timezone
 * Step 2 — Skills
 * Step 3 — Contract preference
 * Step 4 — Minimum rate
 *
 * Each step schema is exported independently so Server Actions can validate
 * only the relevant fields. The combined schema is used in completeOnboarding.
 *
 * Zod v4 conventions used throughout (no errorMap → use 'error', no innerType).
 *
 * Security invariants enforced here (and re-checked server-side):
 *  - Timezone: must be a valid IANA string (validated via Intl.DateTimeFormat)
 *  - Skills: array of trimmed strings, each 2–50 chars, max 20 items, deduped
 *  - contract_preference: strict enum
 *  - min_rate_usd: integer 0–1_000_000
 *  - rate_period: strict enum, required only when min_rate_usd is provided
 */

import { z } from 'zod'
import { isValidIANATimezone } from './timezones'

// ---------------------------------------------------------------------------
// Step 1 — Timezone
// ---------------------------------------------------------------------------
export const step1Schema = z.object({
  timezone: z
    .string()
    .min(1, 'Please select a timezone.')
    .refine(isValidIANATimezone, 'Invalid timezone — please select from the list.'),
})

export type Step1Data = z.infer<typeof step1Schema>

// ---------------------------------------------------------------------------
// Step 2 — Skills
// ---------------------------------------------------------------------------
const skillStringSchema = z
  .string()
  .trim()
  .min(2, 'Skill must be at least 2 characters.')
  .max(50, 'Skill must be at most 50 characters.')
  .refine((s) => !/<[^>]+>/.test(s), 'Invalid skill name.')

export const step2Schema = z.object({
  skills: z
    .array(skillStringSchema)
    .min(1, 'Please add at least 1 skill.')
    .max(20, 'You can add at most 20 skills.')
    .transform((arr) => {
      const seen = new Set<string>()
      return arr.filter((s) => {
        const key = s.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }),
})

export type Step2Data = z.infer<typeof step2Schema>

// ---------------------------------------------------------------------------
// Step 3 — Contract preference
// ---------------------------------------------------------------------------
export const CONTRACT_PREFERENCE_VALUES = [
  'contractor',
  'employee',
  'both',
] as const

export type ContractPreference = (typeof CONTRACT_PREFERENCE_VALUES)[number]

export const step3Schema = z.object({
  contract_preference: z.enum(CONTRACT_PREFERENCE_VALUES, {
    error: 'Please select a contract preference.',
  }),
})

export type Step3Data = z.infer<typeof step3Schema>

// ---------------------------------------------------------------------------
// Step 4 — Minimum rate
// ---------------------------------------------------------------------------
export const RATE_PERIOD_VALUES = ['hour', 'day', 'month', 'year'] as const

export type RatePeriod = (typeof RATE_PERIOD_VALUES)[number]

export const step4Schema = z
  .object({
    min_rate_usd: z
      .number()
      .int('Rate must be a whole number.')
      .min(0, 'Rate cannot be negative.')
      .max(1_000_000, 'Rate is unrealistically high.')
      .nullable()
      .optional(),
    rate_period: z
      .enum(RATE_PERIOD_VALUES, {
        error: 'Please select a rate period.',
      })
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.min_rate_usd != null && data.min_rate_usd > 0) {
        return data.rate_period != null
      }
      return true
    },
    { message: 'Please select a rate period.', path: ['rate_period'] }
  )

export type Step4Data = z.infer<typeof step4Schema>

// ---------------------------------------------------------------------------
// Combined schema for completeOnboarding
// ---------------------------------------------------------------------------
export const completeProfileSchema = z.object({
  timezone: step1Schema.shape.timezone,
  skills: z.array(skillStringSchema).min(1).max(20),
  contract_preference: step3Schema.shape.contract_preference,
  min_rate_usd: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  rate_period: z
    .enum(RATE_PERIOD_VALUES)
    .nullable()
    .optional(),
})

export type CompleteProfileData = z.infer<typeof completeProfileSchema>
