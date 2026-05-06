/**
 * Timezone utilities for the onboarding wizard.
 *
 * APAC-first list is shown in the primary combobox.
 * "Other" expands to all IANA timezones via Intl.supportedValuesOf('timeZone').
 * Server-side validation uses this same set to reject spoofed values.
 */

/** APAC timezones relevant for remote workers (primary list shown in combobox). */
export const APAC_TIMEZONES: ReadonlyArray<string> = [
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Taipei',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Asia/Kuala_Lumpur',
  'Asia/Hong_Kong',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Pacific/Auckland',
]

/**
 * Returns every IANA timezone string supported by the runtime.
 * Falls back to the APAC list if Intl.supportedValuesOf is unavailable
 * (e.g., older Node / edge runtimes).
 */
export function getAllTimezones(): ReadonlyArray<string> {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return Intl.supportedValuesOf('timeZone')
    }
  } catch {
    // noop — fall through to fallback
  }
  return APAC_TIMEZONES
}

/**
 * Validates that a given timezone string is a recognised IANA timezone.
 * Used server-side in Zod refinements.
 */
export function isValidIANATimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Format a timezone for display: "Asia/Singapore → Asia / Singapore (UTC+8)" */
export function formatTimezoneLabel(tz: string): string {
  try {
    const date = new Date()
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(date)
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    const label = tz.replace(/_/g, ' ').replace(/\//g, ' / ')
    return offset ? `${label} (${offset})` : label
  } catch {
    return tz
  }
}

/** Groups timezones by region prefix (Asia, Australia, Pacific, …). */
export function groupTimezonesByRegion(
  timezones: ReadonlyArray<string>
): Record<string, string[]> {
  return timezones.reduce<Record<string, string[]>>((acc, tz) => {
    const [region] = tz.split('/')
    if (region) {
      acc[region] = acc[region] ?? []
      acc[region].push(tz)
    }
    return acc
  }, {})
}
