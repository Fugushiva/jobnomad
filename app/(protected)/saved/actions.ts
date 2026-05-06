'use server'

/**
 * Saved-jobs Server Actions (FM08).
 *
 * Security guarantees:
 *  1. Every action calls getUser() first — never trusts client-supplied user_id.
 *  2. Input validated with Zod before any DB write.
 *  3. DB writes use createClient() (user auth context) — RLS enforces ownership.
 *
 * Pattern: returns { success: true } | { error: string }.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getUser } from '@/src/lib/auth/get-user'
import { createClient } from '@/src/lib/supabase/server'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const jobIdSchema = z.string().uuid('Invalid job id.')

const savedJobStatusSchema = z.enum(
  ['saved', 'applied', 'rejected', 'interviewing', 'offered'],
  { error: 'Invalid status.' },
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const { user } = await getUser()
  if (!user) redirect('/auth/login')
  return user
}

// ---------------------------------------------------------------------------
// saveJob — INSERT saved_jobs row (idempotent via ON CONFLICT DO NOTHING)
// ---------------------------------------------------------------------------

export async function saveJob(jobId: unknown): Promise<ActionResult> {
  const user = await getAuthenticatedUser()

  const parsed = jobIdSchema.safeParse(jobId)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid job id.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('saved_jobs').upsert(
    {
      user_id: user.id,
      job_id: parsed.data,
      status: 'saved',
    },
    { onConflict: 'user_id,job_id', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[saved/saveJob] DB error:', error.code)
    return { error: 'Failed to save job. Please try again.' }
  }

  revalidatePath('/feed')
  revalidatePath('/saved')
  return { success: true }
}

// ---------------------------------------------------------------------------
// unsaveJob — DELETE saved_jobs row
// ---------------------------------------------------------------------------

export async function unsaveJob(jobId: unknown): Promise<ActionResult> {
  const user = await getAuthenticatedUser()

  const parsed = jobIdSchema.safeParse(jobId)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid job id.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('user_id', user.id)
    .eq('job_id', parsed.data)

  if (error) {
    console.error('[saved/unsaveJob] DB error:', error.code)
    return { error: 'Failed to remove bookmark. Please try again.' }
  }

  revalidatePath('/feed')
  revalidatePath('/saved')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateSavedJobStatus — UPDATE status on a saved row
// ---------------------------------------------------------------------------

export async function updateSavedJobStatus(
  jobId: unknown,
  status: unknown,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser()

  const parsedId = jobIdSchema.safeParse(jobId)
  if (!parsedId.success) {
    return { error: parsedId.error.issues[0]?.message ?? 'Invalid job id.' }
  }

  const parsedStatus = savedJobStatusSchema.safeParse(status)
  if (!parsedStatus.success) {
    return { error: parsedStatus.error.issues[0]?.message ?? 'Invalid status.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('saved_jobs')
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('job_id', parsedId.data)

  if (error) {
    console.error('[saved/updateStatus] DB error:', error.code)
    return { error: 'Failed to update status. Please try again.' }
  }

  revalidatePath('/saved')
  return { success: true }
}
