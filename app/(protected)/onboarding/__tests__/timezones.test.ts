/**
 * Unit tests for timezone utilities.
 */
import { describe, it, expect } from 'vitest'
import {
  APAC_TIMEZONES,
  getAllTimezones,
  isValidIANATimezone,
  formatTimezoneLabel,
  groupTimezonesByRegion,
} from '../_lib/timezones'

describe('APAC_TIMEZONES', () => {
  it('contains the expected key timezones', () => {
    expect(APAC_TIMEZONES).toContain('Asia/Singapore')
    expect(APAC_TIMEZONES).toContain('Asia/Tokyo')
    expect(APAC_TIMEZONES).toContain('Asia/Bangkok')
    expect(APAC_TIMEZONES).toContain('Australia/Sydney')
  })

  it('has at least 10 timezones', () => {
    expect(APAC_TIMEZONES.length).toBeGreaterThanOrEqual(10)
  })
})

describe('getAllTimezones', () => {
  it('returns an array of strings', () => {
    const tzs = getAllTimezones()
    expect(Array.isArray(tzs)).toBe(true)
    expect(tzs.length).toBeGreaterThan(0)
    expect(typeof tzs[0]).toBe('string')
  })

  it('includes Asia/Singapore', () => {
    const tzs = getAllTimezones()
    expect(tzs).toContain('Asia/Singapore')
  })
})

describe('isValidIANATimezone', () => {
  it.each([
    'Asia/Singapore',
    'Asia/Tokyo',
    'UTC',
    'America/New_York',
    'Europe/Paris',
    'Australia/Sydney',
  ])('returns true for valid timezone "%s"', (tz) => {
    expect(isValidIANATimezone(tz)).toBe(true)
  })

  it.each([
    '',
    'Invalid/Zone',
    'Narnia/SomeCity',
  ])('returns false for invalid timezone "%s"', (tz) => {
    expect(isValidIANATimezone(tz)).toBe(false)
  })

  it('returns false for non-string input', () => {
    expect(isValidIANATimezone(null as unknown as string)).toBe(false)
    expect(isValidIANATimezone(undefined as unknown as string)).toBe(false)
    expect(isValidIANATimezone(123 as unknown as string)).toBe(false)
  })
})

describe('formatTimezoneLabel', () => {
  it('replaces underscores with spaces', () => {
    const label = formatTimezoneLabel('Asia/Ho_Chi_Minh')
    expect(label).toContain('Ho Chi Minh')
  })

  it('replaces slashes with " / "', () => {
    const label = formatTimezoneLabel('Asia/Singapore')
    expect(label).toContain('Asia / Singapore')
  })

  it('returns the tz string as fallback for invalid input', () => {
    const label = formatTimezoneLabel('Invalid/Zone')
    expect(typeof label).toBe('string')
  })
})

describe('groupTimezonesByRegion', () => {
  it('groups timezones by the first path segment', () => {
    const grouped = groupTimezonesByRegion(['Asia/Singapore', 'Asia/Tokyo', 'UTC'])
    expect(grouped['Asia']).toBeDefined()
    expect(grouped['Asia']).toContain('Asia/Singapore')
    expect(grouped['Asia']).toContain('Asia/Tokyo')
    expect(grouped['UTC']).toBeDefined()
  })
})
