/**
 * Tests for rss.ts — parseRss() and extractItemJob()
 *
 * Covers:
 * - Normal RSS 2.0 with CDATA descriptions (WWR fixture)
 * - Normal RSS 2.0 without CDATA (Himalayas fixture)
 * - Edge cases: empty XML, no items, missing required fields
 * - XXE attempt (entity injection — must not expand)
 * - Single item (not array) handling
 * - Various date formats (RFC822, ISO 8601)
 * - Missing optional fields (logo, date)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseRss, extractItemJob } from '../rss'

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', '__fixtures__')

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8')
}

// ---------------------------------------------------------------------------
// WWR fixture (CDATA descriptions)
// ---------------------------------------------------------------------------

describe('parseRss() — WWR fixture (CDATA)', () => {
  let result: ReturnType<typeof parseRss>

  beforeAll(() => {
    result = parseRss(fixture('wwr.rss'))
  })

  it('returns 2 valid jobs (1 item has empty title — skipped)', () => {
    expect(result.jobs).toHaveLength(2)
    expect(result.failedItems).toBe(1)
  })

  it('extracts title correctly from CDATA (real WWR format: "Company: Title")', () => {
    // Real WWR RSS has "Company: Title" in the <title> tag, no <company> field
    expect(result.jobs[0].title).toBe('AlphaTech Inc: Senior Backend Engineer')
  })

  it('has empty company (WWR encodes it in title — adapter splits it)', () => {
    // company is empty here; the wwr adapter post-processes to split title
    expect(result.jobs[0].company).toBe('')
  })

  it('extracts HTTPS source_url', () => {
    expect(result.jobs[0].source_url).toMatch(/^https:\/\/weworkremotely\.com/)
  })

  it('extracts description (CDATA content, trimmed)', () => {
    expect(result.jobs[0].description).toContain('Senior Backend Engineer')
    expect(result.jobs[0].description.length).toBeGreaterThan(50)
  })

  it('parses RFC822 pubDate correctly', () => {
    const date = result.jobs[0].posted_at
    expect(date).not.toBeNull()
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(4) // 0-indexed May
  })

  it('sets logo_url to null when absent in RSS', () => {
    expect(result.jobs[0].logo_url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Himalayas fixture (plain text descriptions, ISO 8601 dates)
// ---------------------------------------------------------------------------

describe('parseRss() — Himalayas fixture (plain text)', () => {
  let result: ReturnType<typeof parseRss>

  beforeAll(() => {
    result = parseRss(fixture('himalayas.rss'))
  })

  it('returns 3 valid jobs', () => {
    expect(result.jobs).toHaveLength(3)
    expect(result.failedItems).toBe(0)
  })

  it('extracts job title from CDATA (no company suffix)', () => {
    // Real Himalayas RSS: title is just the job title, company in himalayasJobs:companyName
    expect(result.jobs[0].title).toBe('Senior Full-Stack Engineer')
  })

  it('extracts company from himalayasJobs:companyName namespace', () => {
    expect(result.jobs[0].company).toBe('GammaCloud')
  })

  it('extracts logo_url from media:content @_url attribute', () => {
    expect(result.jobs[0].logo_url).toBe('https://cdn-images.himalayas.app/gammacloud-logo.jpg')
  })

  it('sets logo_url null when media:content absent', () => {
    // Third item (EpsilonDesign) has no media:content
    expect(result.jobs[2].logo_url).toBeNull()
  })

  it('parses RFC822 pubDate correctly', () => {
    const date = result.jobs[0].posted_at
    expect(date).not.toBeNull()
    expect(date?.getFullYear()).toBe(2026)
  })

  it('extracts source_url', () => {
    expect(result.jobs[0].source_url).toMatch(/^https:\/\/himalayas\.app/)
  })

  it('sets source_id from permaLink guid', () => {
    // isPermaLink="true" guid → the URL itself is the source_id
    expect(result.jobs[0].source_id).toMatch(/himalayas\.app/)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parseRss() — edge cases', () => {
  it('returns empty array for empty string', () => {
    const result = parseRss('')
    expect(result.jobs).toHaveLength(0)
    expect(result.failedItems).toBe(0)
  })

  it('returns empty array for whitespace-only string', () => {
    const result = parseRss('   \n  ')
    expect(result.jobs).toHaveLength(0)
  })

  it('returns empty array for Atom feed (unsupported)', () => {
    const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Job</title></entry>
</feed>`
    const result = parseRss(atom)
    expect(result.jobs).toHaveLength(0)
  })

  it('handles channel with no items', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`
    const result = parseRss(xml)
    expect(result.jobs).toHaveLength(0)
    expect(result.failedItems).toBe(0)
  })

  it('handles single item (not array) correctly', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Single Item Feed</title>
    <item>
      <title>Lone Job</title>
      <link>https://example.com/jobs/lone</link>
      <description>A lone job posting</description>
      <company>Lone Corp</company>
    </item>
  </channel>
</rss>`
    const result = parseRss(xml)
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].title).toBe('Lone Job')
  })

  it('uses defaultCompany fallback when <company> tag absent', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Developer Job</title>
      <link>https://example.com/jobs/dev</link>
      <description>Great dev job</description>
    </item>
  </channel>
</rss>`
    const result = parseRss(xml, 'FallbackCo')
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].company).toBe('FallbackCo')
  })

  it('skips item with missing title', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <link>https://example.com/jobs/notitle</link>
      <description>Job without title</description>
      <company>Corp</company>
    </item>
  </channel>
</rss>`
    const result = parseRss(xml)
    expect(result.jobs).toHaveLength(0)
    expect(result.failedItems).toBe(1)
  })

  it('skips item with http:// link (SSRF prevention)', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>HTTP Only Job</title>
      <link>http://example.com/jobs/http</link>
      <description>Job via HTTP link</description>
      <company>Corp</company>
    </item>
  </channel>
</rss>`
    const result = parseRss(xml)
    expect(result.jobs).toHaveLength(0)
    expect(result.failedItems).toBe(1)
  })

  it('handles null posted_at gracefully', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Undated Job</title>
      <link>https://example.com/jobs/nodate</link>
      <description>Job without a date</description>
      <company>NoCal Inc</company>
    </item>
  </channel>
</rss>`
    const result = parseRss(xml)
    expect(result.jobs[0].posted_at).toBeNull()
  })

  it('blocks XXE entity injection — throws with clear security message', () => {
    // An XXE attack uses SYSTEM entities to read local files.
    // fast-xml-parser actively throws on external entity declarations.
    // This is BETTER than silently ignoring — it surfaces the attack attempt.
    const xxeXml = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<rss version="2.0">
  <channel>
    <item>
      <title>&xxe;</title>
      <link>https://example.com/jobs/xxe</link>
      <description>XXE test</description>
      <company>EvilCorp</company>
    </item>
  </channel>
</rss>`
    // Parser MUST throw — external entities are rejected at parse time
    expect(() => parseRss(xxeXml)).toThrow(/XXE prevention|External entities/)
  })
})

// ---------------------------------------------------------------------------
// extractItemJob() directly
// ---------------------------------------------------------------------------

describe('extractItemJob()', () => {
  it('returns null when title is empty', () => {
    expect(extractItemJob({ title: '', link: 'https://example.com', description: 'desc', company: 'Corp' })).toBeNull()
  })

  it('returns null when link is missing', () => {
    expect(extractItemJob({ title: 'Job', description: 'desc', company: 'Corp' })).toBeNull()
  })

  it('returns null when description is empty', () => {
    expect(extractItemJob({ title: 'Job', link: 'https://example.com', description: '', company: 'Corp' })).toBeNull()
  })

  it('returns a job with empty company when company is missing (adapter responsible for filling it)', () => {
    // rss.ts allows empty company — some feeds (WWR) encode it in the title.
    // The adapter post-processes and splits it. Zod validation in the adapter rejects empty company.
    const job = extractItemJob({ title: 'Job', link: 'https://example.com', description: 'desc' })
    expect(job).not.toBeNull()
    expect(job?.company).toBe('')
  })

  it('returns a valid RawJob for complete data', () => {
    const job = extractItemJob({
      title: 'Dev',
      link: 'https://example.com/job',
      description: 'Full description',
      company: 'Corp',
      pubDate: '2026-05-01T00:00:00Z',
    })
    expect(job).not.toBeNull()
    expect(job?.title).toBe('Dev')
    expect(job?.company).toBe('Corp')
    expect(job?.source_url).toBe('https://example.com/job')
    expect(job?.posted_at?.getFullYear()).toBe(2026)
  })
})

// ---------------------------------------------------------------------------
// beforeAll import
// ---------------------------------------------------------------------------
import { beforeAll } from 'vitest'
