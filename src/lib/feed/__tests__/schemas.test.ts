/**
 * Tests for src/lib/feed/schemas.ts
 *
 * Covers:
 *  - Valid filter combinations
 *  - Unknown / malformed values silently become undefined
 *  - page coercion + default
 *  - parseFeedFilters helper (array values, missing keys)
 */

import { describe, it, expect } from 'vitest'
import { feedFiltersSchema, parseFeedFilters } from '../schemas'

describe('feedFiltersSchema', () => {
  it('parses empty object to defaults', () => {
    const result = feedFiltersSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.contract).toBeUndefined()
    expect(result.seniority).toBeUndefined()
    expect(result.geo_policy).toBeUndefined()
    expect(result.salary_min).toBeUndefined()
  })

  it('parses valid filter values', () => {
    const result = feedFiltersSchema.parse({
      contract: 'contractor',
      seniority: 'senior',
      geo_policy: 'worldwide',
      salary_min: 80000,
      page: 3,
    })
    expect(result.contract).toBe('contractor')
    expect(result.seniority).toBe('senior')
    expect(result.geo_policy).toBe('worldwide')
    expect(result.salary_min).toBe(80000)
    expect(result.page).toBe(3)
  })

  it('silently coerces unknown contract value to undefined', () => {
    const result = feedFiltersSchema.parse({ contract: 'invalid_value' })
    expect(result.contract).toBeUndefined()
  })

  it('silently coerces unknown seniority value to undefined', () => {
    const result = feedFiltersSchema.parse({ seniority: 'executive' })
    expect(result.seniority).toBeUndefined()
  })

  it('silently coerces unknown geo_policy value to undefined', () => {
    const result = feedFiltersSchema.parse({ geo_policy: 'moon' })
    expect(result.geo_policy).toBeUndefined()
  })

  it('coerces string salary_min to number', () => {
    const result = feedFiltersSchema.parse({ salary_min: '60000' })
    expect(result.salary_min).toBe(60000)
  })

  it('silently sets salary_min to undefined for non-numeric string', () => {
    const result = feedFiltersSchema.parse({ salary_min: 'not-a-number' })
    expect(result.salary_min).toBeUndefined()
  })

  it('silently sets salary_min to undefined for negative value', () => {
    const result = feedFiltersSchema.parse({ salary_min: -100 })
    // negative fails min(0), catch returns undefined
    expect(result.salary_min).toBeUndefined()
  })

  it('coerces string page to number and defaults to 1 for invalid', () => {
    const result = feedFiltersSchema.parse({ page: 'abc' })
    expect(result.page).toBe(1)
  })

  it('defaults page to 1 when missing', () => {
    const result = feedFiltersSchema.parse({})
    expect(result.page).toBe(1)
  })

  it('clamps page < 1 to 1 via catch', () => {
    const result = feedFiltersSchema.parse({ page: 0 })
    expect(result.page).toBe(1)
  })
})

describe('parseFeedFilters', () => {
  it('parses flat string record', () => {
    const result = parseFeedFilters({
      contract: 'employee',
      seniority: 'mid',
      page: '2',
    })
    expect(result.contract).toBe('employee')
    expect(result.seniority).toBe('mid')
    expect(result.page).toBe(2)
  })

  it('flattens array values (takes first element)', () => {
    const result = parseFeedFilters({
      contract: ['contractor', 'employee'],
    })
    expect(result.contract).toBe('contractor')
  })

  it('ignores undefined values', () => {
    const result = parseFeedFilters({ contract: undefined })
    expect(result.contract).toBeUndefined()
  })

  it('handles empty object gracefully', () => {
    const result = parseFeedFilters({})
    expect(result.page).toBe(1)
  })

  it('silently drops XSS-like values', () => {
    const result = parseFeedFilters({ contract: '<script>alert(1)</script>' })
    expect(result.contract).toBeUndefined()
  })
})
