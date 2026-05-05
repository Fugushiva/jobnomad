/**
 * Tests for normalize.ts — 100% branch coverage required.
 *
 * Key invariants:
 * - Same logical job from different sources → same hash (dedup works cross-source)
 * - Different jobs → different hash
 * - Edge cases: empty description, unicode, control chars, whitespace bombs
 */

import { describe, it, expect } from 'vitest'
import { normalize, sha256Hex, buildHashDedup, normalizeJob } from '../normalize'

// ---------------------------------------------------------------------------
// normalize()
// ---------------------------------------------------------------------------

describe('normalize()', () => {
  it('lowercases ASCII', () => {
    expect(normalize('Senior Dev')).toBe('senior dev')
  })

  it('normalizes NFC unicode (é forms)', () => {
    // é as single codepoint vs e + combining accent → must be equal
    const a = normalize('\u00E9')     // precomposed é
    const b = normalize('e\u0301')   // decomposed e + ́
    expect(a).toBe(b)
  })

  it('collapses whitespace sequences to single space', () => {
    expect(normalize('foo   bar\t\nbaz')).toBe('foo bar baz')
  })

  it('strips leading and trailing whitespace', () => {
    expect(normalize('  hello world  ')).toBe('hello world')
  })

  it('removes control characters', () => {
    expect(normalize('foo\u0000bar\u001Fbaz')).toBe('foo bar baz')
  })

  it('handles empty string', () => {
    expect(normalize('')).toBe('')
  })

  it('preserves dots in technology names (React.js != ReactJS would be equal — conservative)', () => {
    // We keep punctuation — this test documents the behavior
    expect(normalize('React.js')).toBe('react.js')
    expect(normalize('ReactJS')).toBe('reactjs')
    // These two are NOT equal (by design — conservative dedup)
    expect(normalize('React.js')).not.toBe(normalize('ReactJS'))
  })

  it('handles emoji and unusual unicode without throwing', () => {
    expect(() => normalize('Great job 🚀 in APAC 🌏')).not.toThrow()
    expect(normalize('Great job 🚀')).toBe('great job 🚀')
  })
})

// ---------------------------------------------------------------------------
// sha256Hex()
// ---------------------------------------------------------------------------

describe('sha256Hex()', () => {
  it('returns 64 hex chars', async () => {
    const hash = await sha256Hex('hello')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic', async () => {
    const a = await sha256Hex('test input')
    const b = await sha256Hex('test input')
    expect(a).toBe(b)
  })

  it('differs for different inputs', async () => {
    const a = await sha256Hex('hello')
    const b = await sha256Hex('world')
    expect(a).not.toBe(b)
  })

  it('matches known SHA-256 vector for empty string', async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hash = await sha256Hex('')
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

// ---------------------------------------------------------------------------
// buildHashDedup()
// ---------------------------------------------------------------------------

describe('buildHashDedup()', () => {
  const baseJob = {
    title: 'Senior React Developer',
    company: 'Acme Corp',
    description: 'We are looking for a senior React developer to join our team. Must have 5+ years experience.',
  }

  it('produces a 64-char hex hash', async () => {
    const hash = await buildHashDedup(baseJob)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic', async () => {
    const a = await buildHashDedup(baseJob)
    const b = await buildHashDedup(baseJob)
    expect(a).toBe(b)
  })

  it('is the same regardless of whitespace variations in title (dedup cross-source)', async () => {
    const variantA = { ...baseJob, title: 'Senior React Developer' }
    const variantB = { ...baseJob, title: 'senior  react  developer' }
    const hashA = await buildHashDedup(variantA)
    const hashB = await buildHashDedup(variantB)
    expect(hashA).toBe(hashB)
  })

  it('is the same for é written two ways (NFC normalization)', async () => {
    const variantA = { ...baseJob, company: 'Café Corp' }
    const variantB = { ...baseJob, company: 'Cafe\u0301 Corp' }
    const hashA = await buildHashDedup(variantA)
    const hashB = await buildHashDedup(variantB)
    expect(hashA).toBe(hashB)
  })

  it('differs when title differs', async () => {
    const a = await buildHashDedup({ ...baseJob, title: 'Junior React Developer' })
    const b = await buildHashDedup({ ...baseJob, title: 'Senior React Developer' })
    expect(a).not.toBe(b)
  })

  it('differs when company differs', async () => {
    const a = await buildHashDedup({ ...baseJob, company: 'Company A' })
    const b = await buildHashDedup({ ...baseJob, company: 'Company B' })
    expect(a).not.toBe(b)
  })

  it('only uses first 200 chars of description (long descriptions produce same hash)', async () => {
    const desc200 = 'x'.repeat(200)
    const descLong = desc200 + 'DIFFERENT SUFFIX THAT SHOULD NOT MATTER'
    const hashA = await buildHashDedup({ ...baseJob, description: desc200 })
    const hashB = await buildHashDedup({ ...baseJob, description: descLong })
    expect(hashA).toBe(hashB)
  })

  it('does NOT collide with separator trick (title/company boundaries)', async () => {
    // We use \x00 as field separator (stripped by normalize).
    // Boundary collision test: different field splits must produce different hashes.
    // Note: regular '|' IS normalized away (treated as non-whitespace char kept),
    // so we test with actual whitespace manipulation instead.
    const a = await buildHashDedup({ title: 'Senior Dev', company: 'Acme', description: 'desc' })
    const b = await buildHashDedup({ title: 'Senior', company: 'Dev Acme', description: 'desc' })
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// normalizeJob()
// ---------------------------------------------------------------------------

describe('normalizeJob()', () => {
  const rawJob = {
    source_id: 'job-123',
    source_url: 'https://remoteok.com/jobs/123',
    title: '  Senior Developer  ',
    company: '  Tech Corp  ',
    description: 'Great opportunity',
    posted_at: new Date('2026-05-01T00:00:00Z'),
    logo_url: 'https://remoteok.com/logo.png',
  }

  it('trims title and company', async () => {
    const normalized = await normalizeJob(rawJob, 'remoteok')
    expect(normalized.title).toBe('Senior Developer')
    expect(normalized.company).toBe('Tech Corp')
  })

  it('sets the correct source', async () => {
    const normalized = await normalizeJob(rawJob, 'remoteok')
    expect(normalized.source).toBe('remoteok')
  })

  it('includes a 64-char hash_dedup', async () => {
    const normalized = await normalizeJob(rawJob, 'remoteok')
    expect(normalized.hash_dedup).toHaveLength(64)
  })

  it('preserves original description without trimming (Gemini needs raw content in T4)', async () => {
    const normalized = await normalizeJob(rawJob, 'remoteok')
    expect(normalized.description).toBe(rawJob.description)
  })

  it('same logical job from two sources → same hash (cross-source dedup)', async () => {
    const fromRemoteOK = await normalizeJob({ ...rawJob, source_id: 'rok-999', source_url: 'https://remoteok.com/jobs/999' }, 'remoteok')
    const fromWWR = await normalizeJob({ ...rawJob, source_id: 'wwr-456', source_url: 'https://weworkremotely.com/jobs/456' }, 'wwr')
    expect(fromRemoteOK.hash_dedup).toBe(fromWWR.hash_dedup)
  })
})
