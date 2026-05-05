'use client'

/**
 * ToastTestButtons — Client Component that triggers each toast type.
 *
 * Used exclusively by the dev-only /__dev__/toast-test page and by
 * Playwright E2E tests (which navigate to that page and click these buttons).
 */

import { toast, toastError } from '@/lib/toast'

export function ToastTestButtons() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <button
        data-testid="trigger-success"
        onClick={() => toast.success('Job saved successfully')}
        className="rounded-md bg-[var(--success)] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Trigger success toast
      </button>

      <button
        data-testid="trigger-error"
        onClick={() => toastError(new Error('DB error — must not leak'), 'Failed to save job')}
        className="rounded-md bg-[var(--danger)] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Trigger error toast
      </button>

      <button
        data-testid="trigger-info"
        onClick={() => toast.info('Profile updated')}
        className="rounded-md bg-[var(--primary)] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Trigger info toast
      </button>

      <button
        data-testid="trigger-warning"
        onClick={() => toast.warning('You are approaching your daily limit')}
        className="rounded-md bg-[var(--warning)] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Trigger warning toast
      </button>

      <button
        data-testid="trigger-promise"
        onClick={() =>
          toast.promise(
            new Promise<string>(resolve => setTimeout(() => resolve('done'), 1500)),
            {
              loading: 'Saving…',
              success: 'Job saved via promise',
              error: 'Promise failed',
            }
          )
        }
        className="rounded-md bg-[var(--surface-tint)] border border-[var(--border)] text-[var(--text)] px-4 py-2 text-sm font-medium hover:bg-[var(--border)] transition-colors"
      >
        Trigger promise toast
      </button>
    </div>
  )
}
