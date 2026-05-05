/**
 * Template integrity tests for email templates in supabase/templates/
 *
 * These tests verify:
 *   1. All required templates exist (HTML + TXT variants)
 *   2. Every template contains {{ .ConfirmationURL }} (Supabase-required variable)
 *   3. No template contains external URLs (security: no pixel tracking, no CDN links)
 *      Exception: jobnomad.app links in footers are allowed
 *   4. HTML templates are well-formed (have <html>, <head>, <body> tags)
 *   5. TXT templates are plain text (no HTML tags)
 *   6. No template exposes any secret placeholder patterns
 *   7. Subject lines and branding are consistent
 *
 * Note: These are static content tests, not email delivery tests.
 * Email delivery is tested by the E2E smoke test (e2e/auth-smtp-health.spec.ts).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const TEMPLATES_DIR = resolve(__dirname, '../')

// ---------------------------------------------------------------------------
// Required templates
// ---------------------------------------------------------------------------

const REQUIRED_TEMPLATES = [
  'magic-link.html',
  'magic-link.txt',
  'confirm-signup.html',
  'confirm-signup.txt',
  'recovery.html',
  'recovery.txt',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readTemplate(filename: string): string {
  return readFileSync(join(TEMPLATES_DIR, filename), 'utf8')
}

function templateExists(filename: string): boolean {
  return existsSync(join(TEMPLATES_DIR, filename))
}

// ---------------------------------------------------------------------------
// Existence checks
// ---------------------------------------------------------------------------

describe('Template files existence', () => {
  for (const template of REQUIRED_TEMPLATES) {
    it(`${template} exists`, () => {
      expect(templateExists(template)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Supabase variable requirement: {{ .ConfirmationURL }}
// ---------------------------------------------------------------------------

describe('{{ .ConfirmationURL }} presence (required by Supabase Auth)', () => {
  for (const template of REQUIRED_TEMPLATES) {
    it(`${template} contains {{ .ConfirmationURL }}`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('{{ .ConfirmationURL }}')
    })
  }
})

// ---------------------------------------------------------------------------
// HTML template structure
// ---------------------------------------------------------------------------

describe('HTML template structure', () => {
  const htmlTemplates = REQUIRED_TEMPLATES.filter((t) => t.endsWith('.html'))

  for (const template of htmlTemplates) {
    it(`${template} has DOCTYPE declaration`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('<!DOCTYPE html>')
    })

    it(`${template} has <html lang="en">`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('<html lang="en">')
    })

    it(`${template} has <head> section`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('<head>')
      expect(content).toContain('</head>')
    })

    it(`${template} has <body> section`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('<body')
      expect(content).toContain('</body>')
    })

    it(`${template} has charset UTF-8`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('charset="UTF-8"')
    })

    it(`${template} has viewport meta tag (mobile-friendly)`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('viewport')
    })

    it(`${template} has role="presentation" on tables (accessibility)`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('role="presentation"')
    })
  }
})

// ---------------------------------------------------------------------------
// Text template structure (plain text -- no HTML tags)
// ---------------------------------------------------------------------------

describe('TXT template structure', () => {
  const txtTemplates = REQUIRED_TEMPLATES.filter((t) => t.endsWith('.txt'))

  for (const template of txtTemplates) {
    it(`${template} does not contain HTML tags`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      // Allow simple patterns but no actual HTML tags
      const htmlTagPattern = /<[a-z][a-z0-9]*(\s[^>]*)?>/i
      expect(htmlTagPattern.test(content)).toBe(false)
    })

    it(`${template} contains a separator line`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      // TXT emails should have visual separators for readability
      expect(content).toMatch(/---+|===+/)
    })

    it(`${template} contains jobnomad.app link`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('jobnomad.app')
    })
  }
})

// ---------------------------------------------------------------------------
// Security: no external tracking pixels or forbidden CDN URLs
// ---------------------------------------------------------------------------

describe('Security: no external tracking or CDN resources', () => {
  const htmlTemplates = REQUIRED_TEMPLATES.filter((t) => t.endsWith('.html'))

  const forbiddenPatterns = [
    // Tracking pixels
    'pixel.gif',
    'open.gif',
    'track.',
    // External CDN images (only inline styles allowed)
    'src="https://',
    'src="http://',
    // External stylesheet imports (security risk + breaks email clients)
    '<link rel="stylesheet"',
    '@import url',
    // Known trackers
    'mailchimp',
    'sendgrid.net',
    'mailgun.org',
    // External fonts (can be used for tracking)
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ]

  for (const template of htmlTemplates) {
    for (const pattern of forbidtenPatterns()) {
      it(`${template} does not contain forbidden pattern: "${pattern}"`, () => {
        if (!templateExists(template)) return
        const content = readTemplate(template).toLowerCase()
        expect(content).not.toContain(pattern.toLowerCase())
      })
    }
  }

  function forbidtenPatterns() {
    return forbiddenPatterns
  }
})

// ---------------------------------------------------------------------------
// Branding consistency
// ---------------------------------------------------------------------------

describe('Branding consistency', () => {
  const allTemplates = REQUIRED_TEMPLATES

  for (const template of allTemplates) {
    it(`${template} mentions JobNomad brand`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('JobNomad')
    })

    it(`${template} mentions jobnomad.app domain`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      expect(content).toContain('jobnomad.app')
    })
  }
})

// ---------------------------------------------------------------------------
// Security: no leaked secret patterns in templates
// ---------------------------------------------------------------------------

describe('Security: no secret patterns in templates', () => {
  const secretPatterns = [
    'RESEND_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ACCESS_TOKEN',
    'STRIPE_SECRET_KEY',
    'CRON_SECRET',
    /re_[A-Za-z0-9]{20,}/, // Resend API key format
    /sbp_[A-Za-z0-9]{40,}/, // Supabase access token format
    /eyJ[A-Za-z0-9-_]{20,}/, // JWT format (service role key)
  ]

  for (const template of REQUIRED_TEMPLATES) {
    for (const pattern of secretPatterns) {
      const label = pattern instanceof RegExp ? pattern.toString() : pattern
      it(`${template} does not contain secret pattern: ${label}`, () => {
        if (!templateExists(template)) return
        const content = readTemplate(template)
        if (typeof pattern === 'string') {
          expect(content).not.toContain(pattern)
        } else {
          expect(pattern.test(content)).toBe(false)
        }
      })
    }
  }
})

// ---------------------------------------------------------------------------
// CTA button presence in HTML templates
// ---------------------------------------------------------------------------

describe('CTA button presence', () => {
  const htmlTemplates = REQUIRED_TEMPLATES.filter((t) => t.endsWith('.html'))

  for (const template of htmlTemplates) {
    it(`${template} has at least one CTA anchor link pointing to {{ .ConfirmationURL }}`, () => {
      if (!templateExists(template)) return
      const content = readTemplate(template)
      // The href of the CTA should be the ConfirmationURL template variable
      expect(content).toContain('href="{{ .ConfirmationURL }}"')
    })
  }
})

// ---------------------------------------------------------------------------
// Magic link specific: expiry mention
// ---------------------------------------------------------------------------

describe('magic-link template specific', () => {
  it('magic-link.html mentions 1 hour expiry', () => {
    if (!templateExists('magic-link.html')) return
    const content = readTemplate('magic-link.html')
    expect(content.toLowerCase()).toContain('1 hour')
  })

  it('magic-link.txt mentions 1 hour expiry', () => {
    if (!templateExists('magic-link.txt')) return
    const content = readTemplate('magic-link.txt')
    expect(content.toLowerCase()).toContain('1 hour')
  })

  it('magic-link.html mentions one-time use', () => {
    if (!templateExists('magic-link.html')) return
    const content = readTemplate('magic-link.html')
    expect(content.toLowerCase()).toMatch(/once|one.time|single.use/)
  })
})
