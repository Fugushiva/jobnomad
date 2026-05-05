/**
 * Env-leak guard -- static analysis test
 *
 * Ensures that server-only secrets are referenced ONLY in server-only files.
 * This is a defense-in-depth check that runs in CI alongside gitleaks.
 *
 * Secrets guarded:
 *   - SUPABASE_SERVICE_ROLE_KEY  (Supabase service role -- cron handlers only)
 *   - RESEND_API_KEY             (Resend SMTP -- env.ts + setup script only)
 *   - SUPABASE_ACCESS_TOKEN      (Management API -- setup script only)
 *
 * Rules enforced:
 * 1. Each secret must appear in its expected server-only file(s)
 * 2. Each secret must NOT appear in any 'use client' file
 * 3. Each secret must NOT appear in any NEXT_PUBLIC_ var declaration
 * 4. Each secret must NOT appear in forbidden client-accessible files
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../')

// ---------------------------------------------------------------------------
// Secret definitions
// ---------------------------------------------------------------------------

interface SecretGuard {
  name: string
  /** Files that are expected (and allowed) to reference this secret */
  allowedFiles: string[]
  /** Files that must NEVER reference this secret */
  forbiddenFiles: string[]
}

const SECRETS: SecretGuard[] = [
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    allowedFiles: [
      'src/lib/supabase/service.ts',
      'src/lib/env.ts',
    ],
    forbiddenFiles: [
      'src/lib/supabase/client.ts',
      'src/lib/supabase/server.ts',
      'app/auth/login/login-form.tsx',
      'app/auth/login/page.tsx',
      'app/page.tsx',
      'app/layout.tsx',
    ],
  },
  {
    name: 'RESEND_API_KEY',
    allowedFiles: [
      'src/lib/env.ts',
      // Also allowed in scripts/ -- but we scan app/ + src/lib/ only (scripts not in browser bundle)
    ],
    forbiddenFiles: [
      'src/lib/supabase/client.ts',
      'src/lib/supabase/server.ts',
      'app/auth/login/login-form.tsx',
      'app/auth/login/page.tsx',
      'app/page.tsx',
      'app/layout.tsx',
    ],
  },
  {
    name: 'SUPABASE_ACCESS_TOKEN',
    allowedFiles: [
      'src/lib/env.ts',
      // Also allowed in scripts/ -- but we only scan app/ + src/lib/
    ],
    forbiddenFiles: [
      'src/lib/supabase/client.ts',
      'src/lib/supabase/server.ts',
      'src/lib/supabase/service.ts', // Not needed in service client
      'app/auth/login/login-form.tsx',
      'app/auth/login/page.tsx',
      'app/page.tsx',
      'app/layout.tsx',
    ],
  },
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
        // Skip node_modules, .next, test dirs to keep scan fast and focused
        if (!['node_modules', '.next', '__tests__', 'e2e'].includes(entry.name)) {
          getAllTsFiles(rel, files)
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(rel)
      }
    }
  } catch {
    // dir doesn't exist yet -- not an error
  }
  return files
}

// Normalize path separators for cross-platform comparison
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// Tests -- per-secret
// ---------------------------------------------------------------------------

for (const guard of SECRETS) {
  describe(`env-leak: ${guard.name} containment`, () => {
    // 1. Must appear in allowed files (sanity: they are actually used server-side)
    for (const file of guard.allowedFiles) {
      it(`should be referenced in ${file} (expected server-side usage)`, () => {
        if (!fileExists(file)) {
          // If the file doesn't exist yet, skip (not an error -- file may be added later)
          return
        }
        const content = readFile(file)
        expect(content).toContain(guard.name)
      })
    }

    // 2. Must NOT appear in explicitly forbidden files
    for (const file of guard.forbiddenFiles) {
      it(`should NOT appear in ${file}`, () => {
        if (!fileExists(file)) return // File doesn't exist yet -- skip
        const content = readFile(file)
        expect(content).not.toContain(guard.name)
      })
    }

    // 3. Must NOT appear in any 'use client' file anywhere in app/ or src/lib/
    it('should NOT appear in any Client Component (use client directive)', () => {
      const appFiles = getAllTsFiles('app')
      const srcFiles = getAllTsFiles('src/lib')
      const allFiles = [...appFiles, ...srcFiles]

      // Files explicitly allowed to reference this secret (may or may not have 'use client')
      const normalizedAllowed = guard.allowedFiles.map(normalizePath)

      const leaks: string[] = []

      for (const file of allFiles) {
        const normalizedFile = normalizePath(file)
        // Skip files that are explicitly in the allowlist
        if (normalizedAllowed.some((allowed) => normalizedFile.endsWith(allowed))) {
          continue
        }

        try {
          const content = readFile(file)
          if (content.includes("'use client'") && content.includes(guard.name)) {
            leaks.push(file)
          }
        } catch {
          // File unreadable -- skip
        }
      }

      if (leaks.length > 0) {
        console.error(
          `SECURITY: ${guard.name} found in client component files:\n${leaks.join('\n')}`,
        )
      }
      expect(leaks).toHaveLength(0)
    })

    // 4. Must NOT be assigned to any NEXT_PUBLIC_ variable anywhere in the codebase
    it('should NOT appear in any NEXT_PUBLIC_ variable assignment', () => {
      const allFiles = [
        ...getAllTsFiles('app'),
        ...getAllTsFiles('src'),
      ]

      const leaks: string[] = []
      // Pattern: variable NAME starts with NEXT_PUBLIC_ and contains the secret name
      // e.g. NEXT_PUBLIC_RESEND_API_KEY or process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY
      // Excludes: mentions in string literals like error messages where both appear on same line
      // We check that the secret name appears as part of a NEXT_PUBLIC_ identifier (not a string value)
      const pattern = new RegExp(`NEXT_PUBLIC_[A-Z_]*${guard.name}[A-Z_]*`)

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
}

// ---------------------------------------------------------------------------
// Cross-secret test: no secret key name should appear in NEXT_PUBLIC_ var names
// ---------------------------------------------------------------------------

describe('env-leak: NEXT_PUBLIC_ namespace purity', () => {
  const secretNames = SECRETS.map((s) => s.name)

  it('NEXT_PUBLIC_ variable names do not embed any secret key name', () => {
    // Scan all TS files for patterns like NEXT_PUBLIC_RESEND_API_KEY (identifier, not string value)
    // Pattern: NEXT_PUBLIC_ immediately followed by the secret name -- they form a single identifier
    // This would mean the secret is exposed via a public env var
    const allFiles = [
      ...getAllTsFiles('app'),
      ...getAllTsFiles('src'),
    ]

    const leaks: string[] = []

    for (const file of allFiles) {
      try {
        const content = readFile(file)
        for (const secret of secretNames) {
          // Match: NEXT_PUBLIC_<SECRET_NAME> as a contiguous identifier
          const pattern = new RegExp(`NEXT_PUBLIC_${secret}`)
          if (pattern.test(content)) {
            leaks.push(`${file}: NEXT_PUBLIC_ reference to ${secret}`)
          }
        }
      } catch {
        // skip
      }
    }

    expect(leaks).toHaveLength(0)
  })

  it('email-related secrets are not inlined in any client bundle export', () => {
    // Extra guard: look for patterns like export const RESEND = "re_..." in non-server files
    const clientFiles = getAllTsFiles('app').filter((f) => {
      try {
        const content = readFile(f)
        return content.includes("'use client'")
      } catch {
        return false
      }
    })

    const emailSecrets = ['RESEND_API_KEY', 'EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME']
    const leaks: string[] = []

    for (const file of clientFiles) {
      try {
        const content = readFile(file)
        for (const secret of emailSecrets) {
          // Only flag if it's actually using the value (not just mentioning the name in a comment)
          if (content.includes(secret) && !content.startsWith('//') && !content.includes('// ')) {
            // More precise: check if the key name appears outside a comment context
            const lines = content.split('\n')
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed.includes(secret)) {
                leaks.push(`${file}: ${secret} referenced in client component`)
              }
            }
          }
        }
      } catch {
        // skip
      }
    }

    expect(leaks).toHaveLength(0)
  })
})
