/**
 * @/lib/toast — JobNomad's centralised toast API
 *
 * This module re-exports Sonner's `toast` object and adds a `toastError()`
 * helper that enforces safe error messaging.
 *
 * ─── USAGE ──────────────────────────────────────────────────────────────────
 *
 *   import { toast, toastError } from '@/lib/toast'
 *
 *   // Success
 *   toast.success('Job sauvegardé')
 *
 *   // Info
 *   toast.info('Profil mis à jour')
 *
 *   // Promise (loading → success/error auto)
 *   toast.promise(saveJob(id), {
 *     loading: 'Sauvegarde…',
 *     success: 'Job sauvegardé',
 *     error: 'Échec de la sauvegarde',
 *   })
 *
 *   // Error — ALWAYS use toastError, never toast.error(error.message) directly
 *   try {
 *     await saveJob(id)
 *   } catch (err) {
 *     toastError(err, 'Impossible de sauvegarder cette offre')
 *   }
 *
 * ─── SECURITY ───────────────────────────────────────────────────────────────
 *
 * `toastError()` exists for one reason: to prevent leaking server-side error
 * details to end users. A raw `Error.message` or `Error.stack` can expose:
 *   - SQL error messages with table/column names
 *   - File system paths (e.g. /var/lib/postgres/…)
 *   - Stack traces revealing internal logic
 *   - Third-party API responses with credentials in query strings
 *
 * Rule: never call `toast.error(error.message)` in production code.
 *       Always call `toastError(err, 'User-friendly message')`.
 *
 * In development (NODE_ENV !== 'production'), the original error is logged
 * to the browser console so developers can debug without losing information.
 */

export { toast } from 'sonner'

/**
 * toastError — safe error toast helper.
 *
 * @param input    - The caught value (Error, string, or unknown).
 * @param fallback - The user-facing message to display. Defaults to a generic
 *                   "Something went wrong" message.
 *
 * Behaviour:
 *   - If `input` is a plain string, it is displayed as-is (developer is
 *     responsible for ensuring it is safe for end users).
 *   - If `input` is an Error object, only `fallback` is shown (never
 *     error.message or error.stack).
 *   - If `input` is anything else (number, object, null, undefined),
 *     `fallback` is shown.
 *   - In development, the original value is always logged via console.error
 *     so developers can debug without seeing it in the UI.
 */
export function toastError(
  input: unknown,
  fallback = 'Something went wrong'
): void {
  // In development, always log the raw error for debugging.
  if (process.env.NODE_ENV !== 'production') {
    console.error('[toastError]', input)
  }

  // Determine the safe message to display.
  const message =
    typeof input === 'string'
      ? input // Developer-supplied string — their responsibility to keep clean.
      : fallback // Error objects or unknown values: always use the fallback.

  // Lazy import avoids pulling Sonner into server bundles via this helper.
  // (This file is imported only from Client Components anyway, but belt + braces.)
  import('sonner').then(({ toast }) => {
    toast.error(message)
  })
}
