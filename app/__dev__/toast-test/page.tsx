/**
 * /__dev__/toast-test — Developer-only toast testing page.
 *
 * SECURITY: This page is ONLY available in development and test environments.
 * In production (NODE_ENV === 'production'), it returns a 404 via notFound().
 *
 * Purpose: Provides trigger buttons for all toast types so that:
 *   1. Developers can manually verify toast UI during local development.
 *   2. Playwright E2E tests can exercise the toast system end-to-end without
 *      needing to replicate an entire feature flow.
 *
 * This page does NOT appear in the app navigation or sitemap.
 */

import { notFound } from 'next/navigation'
import { ToastTestButtons } from './toast-test-buttons'

export default function ToastTestPage() {
  // Guard: hard block in production — returns Next.js 404 page.
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Toast system test page</h1>
      <p className="text-[var(--text-soft)] text-sm">
        Dev-only — not available in production.
      </p>
      <ToastTestButtons />
    </main>
  )
}
