/**
 * Unit tests for onboarding Zod schemas (FM02).
 *
 * Validates:
 *  - Happy path for all 4 step schemas
 *  - Edge cases: invalid IANA timezone, too many/few skills,
 *    HTML injection in skill name, rate range bounds, period required logic
 *  - completeProfileSchema cross-field validation
 */

import { describe, it, expect } from 'vitest'
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  completeProfileSchema,
} from '../_lib/schemas'

// ---------------------------------------------------------------------------
// Step 1 — Timezone
// ---------------------------------------------------------------------------
describe('step1Schema', () => {
  it('accepts a valid IANA timezone', () => {
    const result = step1Schema.safeParse({ timezone: 'Asia/Singapore' })
    expect(result.success).toBe(true)
  })

  it('accepts UTC', () => {
    const result = step1Schema.safeParse({ timezone: 'UTC' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = step1Schema.safeParse({ timezone: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a made-up timezone', () => {
    const result = step1Schema.safeParse({ timezone: 'Narnia/Somewhere' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Invalid timezone')
    }
  })

  it('rejects a made-up region/city that Intl cannot resolve', () => {
    const result = step1Schema.safeParse({ timezone: 'Narnia/SomeCity' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Step 2 — Skills
// ---------------------------------------------------------------------------
describe('step2Schema', () => {
  it('accepts a valid skill list', () => {
    const result = step2Schema.safeParse({ skills: ['React', 'TypeScript'] })
    expect(result.success).toBe(true)
  })

  it('deduplicates case-insensitively', () => {
    const result = step2Schema.safeParse({ skills: ['React', 'react', 'REACT'] })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.skills).toHaveLength(1)
      expect(result.data.skills[0]).toBe('React')
    }
  })

  it('rejects empty array', () => {
    const result = step2Schema.safeParse({ skills: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('at least 1 skill')
    }
  })

  it('rejects more than 20 skills', () => {
    const skills = Array.from({ length: 21 }, (_, i) => `Skill${i}`)
    const result = step2Schema.safeParse({ skills })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('at most 20')
    }
  })

  it('rejects a skill shorter than 2 chars', () => {
    const result = step2Schema.safeParse({ skills: ['X'] })
    expect(result.success).toBe(false)
  })

  it('rejects a skill longer than 50 chars', () => {
    const result = step2Schema.safeParse({ skills: ['X'.repeat(51)] })
    expect(result.success).toBe(false)
  })

  it('rejects HTML injection in a skill name', () => {
    const result = step2Schema.safeParse({ skills: ['<script>alert(1)</script>'] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Invalid skill name')
    }
  })
})

// ---------------------------------------------------------------------------
// Step 3 — Contract preference
// ---------------------------------------------------------------------------
describe('step3Schema', () => {
  it.each(['contractor', 'employee', 'both'] as const)(
    'accepts "%s"',
    (value) => {
      const result = step3Schema.safeParse({ contract_preference: value })
      expect(result.success).toBe(true)
    }
  )

  it('rejects an unlisted value', () => {
    const result = step3Schema.safeParse({ contract_preference: 'freelance' })
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = step3Schema.safeParse({ contract_preference: '' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Step 4 — Rate
// ---------------------------------------------------------------------------
describe('step4Schema', () => {
  it('accepts null amount (skipped)', () => {
    const result = step4Schema.safeParse({ min_rate_usd: null, rate_period: null })
    expect(result.success).toBe(true)
  })

  it('accepts a valid amount + period', () => {
    const result = step4Schema.safeParse({ min_rate_usd: 5000, rate_period: 'month' })
    expect(result.success).toBe(true)
  })

  it('requires rate_period when min_rate_usd > 0', () => {
    const result = step4Schema.safeParse({ min_rate_usd: 5000, rate_period: null })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('rate_period')
    }
  })

  it('allows missing period when amount is 0', () => {
    const result = step4Schema.safeParse({ min_rate_usd: 0, rate_period: null })
    expect(result.success).toBe(true)
  })

  it('rejects negative amount', () => {
    const result = step4Schema.safeParse({ min_rate_usd: -1, rate_period: 'hour' })
    expect(result.success).toBe(false)
  })

  it('rejects amount > 1_000_000', () => {
    const result = step4Schema.safeParse({
      min_rate_usd: 1_000_001,
      rate_period: 'year',
    })
    expect(result.success).toBe(false)
  })

  it.each(['hour', 'day', 'month', 'year'] as const)(
    'accepts rate_period "%s"',
    (period) => {
      const result = step4Schema.safeParse({ min_rate_usd: 100, rate_period: period })
      expect(result.success).toBe(true)
    }
  )

  it('rejects invalid rate_period', () => {
    const result = step4Schema.safeParse({ min_rate_usd: 100, rate_period: 'week' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Complete profile schema
// ---------------------------------------------------------------------------
describe('completeProfileSchema', () => {
  it('accepts a complete valid profile', () => {
    const result = completeProfileSchema.safeParse({
      timezone: 'Asia/Tokyo',
      skills: ['React', 'TypeScript'],
      contract_preference: 'contractor',
      min_rate_usd: 8000,
      rate_period: 'month',
    })
    expect(result.success).toBe(true)
  })

  it('accepts with null rate (optional)', () => {
    const result = completeProfileSchema.safeParse({
      timezone: 'Asia/Singapore',
      skills: ['Go'],
      contract_preference: 'employee',
      min_rate_usd: null,
      rate_period: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects when timezone is invalid', () => {
    const result = completeProfileSchema.safeParse({
      timezone: 'Invalid/Zone',
      skills: ['React'],
      contract_preference: 'both',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when skills array is empty', () => {
    const result = completeProfileSchema.safeParse({
      timezone: 'Asia/Singapore',
      skills: [],
      contract_preference: 'both',
    })
    expect(result.success).toBe(false)
  })
})
