/**
 * Env-leak guard — static analysis test
 *
 * Ensures that SUPABASE_SERVICE_ROLE_KEY is referenced ONLY in server-only files.
 * This is a defense-in-depth check that runs in CI alongside gitleaks.
 *
 * Rules enforced:
 * 1. `SUPABASE_SERVICE_ROLE_KEY` must appear in `src/lib/supabase/service.ts`
 *    (expected: used to initialise the service client)
 * 2. It must NOT appear in any file under `src/lib/supabase/client.ts`
 *    (the browser client — would expose it to the bundle)
 * 3. It must NOT appear in any `app/` file that imports from a client-side module
 *    (checked via a blocklist of known client-boundary files)
 *
 * When cron routes are added (app/api/cron/**), they are server-only route
 * handlers and are therefore allowed. This test does NOT block them.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../')
const SENSITIVE_KEY = 'SUPABASE_SERVICE_ROLE_KEY'

// Files that are strictly server-only — allowed to reference the service key
const ALLOWED_FILES = [
  'src/lib/supabase/service.ts',
  'src/lib/env.ts', // Zod schema definition (server-side env validation)
]

// Files / dirs that must NEVER reference the service key (client-accessible code)
const FORBIDDEN_FILES = [
  'src/lib/supabase/client.ts',
  'src/lib/supabase/server.ts', // Uses anon key only
  'app/auth/login/login-form.tsx',
  'app/auth/login/page.tsx',
  'app/page.tsx',
  'app/layout.tsx',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function fileExists(relativePath: string): boolean {
  try {
    statSync(join(ROOT, relativePath))
    return true
  } catch {
    return false
  }
}

function getAllTsFiles(dir: string, files: string[] = []): string[] {
  const fullDir = join(ROOT, dir)
  try {
    for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        // Skip node_modules, .next, test dirs
        if (!['node_modules', '.next', '__tests__', 'e2e'].includes(entry.name)) {
          getAllTsFiles(rel, files)
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(rel)
      }
    }
  } catch {
    // dir doesn't exist yet — not an error
  }
  return files
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('env-leak: SUPABASE_SERVICE_ROLE_KEY containment', () => {
  it('should be referenced in service.ts (expected usage)', () => {
    const content = readFile('src/lib/supabase/service.ts')
    expect(content).toContain(SENSITIVE_KEY)
  })

  it('should be referenced in env.ts (Zod schema — server-side validation only)', () => {
    const content = readFile('src/lib/env.ts')
    expect(content).toContain(SENSITIVE_KEY)
  })

  for (const file of FORBIDDEN_FILES) {
    it(`should NOT appear in ${file}`, () => {
      if (!fileExists(file)) return // File doesn't exist yet — skip
      const content = readFile(file)
      expect(content).not.toContain(SENSITIVE_KEY)
    })
  }

  it('should NOT appear in any Client Component file (use client directive)', () => {
    // Scan all .ts/.tsx files in app/ and src/ for files that have 'use client'
    // and also reference the service role key — that would be a leak
    const appFiles = getAllTsFiles('app')
    const srcFiles = getAllTsFiles('src/lib')
    const allFiles = [...appFiles, ...srcFiles]

    const leaks: string[] = []

    for (const file of allFiles) {
      // Skip explicitly allowed files
      if (ALLOWED_FILES.some((allowed) => file.endsWith(allowed.replace(/\//g, '/')) || file === allowed)) {
        continue
      }
      try {
        const content = readFile(file)
        if (content.includes("'use client'") && content.includes(SENSITIVE_KEY)) {
          leaks.push(file)
        }
      } catch {
        // File unreadable — skip
      }
    }

    expect(leaks).toHaveLength(0)
    if (leaks.length > 0) {
      console.error(
        `SECURITY: ${SENSITIVE_KEY} found in client component files:\n${leaks.join('\n')}`,
      )
    }
  })

  it('should NOT appear in any NEXT_PUBLIC_ env var declaration', () => {
    // Extra guard: the key name should never be assigned to a NEXT_PUBLIC_ variable
    // (that would inline it in the browser bundle)
    const allFiles = [
      ...getAllTsFiles('app'),
      ...getAllTsFiles('src'),
    ]

    const leaks: string[] = []
    const pattern = /NEXT_PUBLIC_[A-Z_]*=.*SUPABASE_SERVICE_ROLE_KEY/

    for (const file of allFiles) {
      try {
        const content = readFile(file)
        if (pattern.test(content)) {
          leaks.push(file)
        }
      } catch {
        // skip
      }
    }

    expect(leaks).toHaveLength(0)
  })
})
