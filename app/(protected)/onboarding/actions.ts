'use server'

/**
 * Onboarding Server Actions (FM02).
 *
 * Security guarantees:
 *  1. Every action calls getUser() first — never trusts client-supplied user_id.
 *  2. All input validated by Zod before any DB write.
 *  3. DB writes use createClient() (user auth context) — RLS enforces user_id ownership.
 *  4. onboarding_completed_at is set ONLY by completeOnboarding, never by step actions.
 *
 * Strategy:
 *  - Step 1 uses upsert (creates the row if it doesn't exist yet).
 *    Provides default values for all NOT NULL columns.
 *  - Steps 2/3/4 use update().eq('user_id') — row was created in step 1.
 *  - completeOnboarding validates the full profile then sets onboarding_completed_at.
 *
 * Pattern: each action returns { success: true } | { error: string }.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  completeProfileSchema,
} from './_lib/schemas'
import { getUser } from '@/src/lib/auth/get-user'
import { createClient } from '@/src/lib/supabase/server'

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
// Step 1 — Save timezone (creates profile row if not exists)
// ---------------------------------------------------------------------------
export async function saveStep1(data: unknown): Promise<ActionResult> {
  const user = await getAuthenticatedUser()
  const parsed = step1Schema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid timezone.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: user.id,
      timezone: parsed.data.timezone,
      // Required NOT NULL columns — provide defaults so INSERT doesn't fail
      contract_preference: 'both',
      skills: [],
      excluded_regions: [],
      language: 'en',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
      // On conflict, only update timezone and updated_at (leave other cols as-is)
      ignoreDuplicates: false,
    }
  )

  if (error) {
    console.error('[onboarding/saveStep1] DB error:', error.code)
    return { error: 'Failed to save timezone. Please try again.' }
  }

  // If a row already existed, also update timezone explicitly
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ timezone: parsed.data.timezone, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[onboarding/saveStep1] Update error:', updateError.code)
    return { error: 'Failed to save timezone. Please try again.' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Step 2 — Save skills
// ---------------------------------------------------------------------------
export async function saveStep2(data: unknown): Promise<ActionResult> {
  const user = await getAuthenticatedUser()
  const parsed = step2Schema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid skills.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({
      skills: parsed.data.skills,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[onboarding/saveStep2] DB error:', error.code)
    return { error: 'Failed to save skills. Please try again.' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Step 3 — Save contract preference
// ---------------------------------------------------------------------------
export async function saveStep3(data: unknown): Promise<ActionResult> {
  const user = await getAuthenticatedUser()
  const parsed = step3Schema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid contract preference.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({
      contract_preference: parsed.data.contract_preference,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[onboarding/saveStep3] DB error:', error.code)
    return { error: 'Failed to save contract preference. Please try again.' }
  }

  revalidatePath('/onboarding')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Step 4 — Save rate + complete onboarding
// ---------------------------------------------------------------------------
export async function completeOnboarding(data: unknown): Promise<ActionResult> {
  const user = await getAuthenticatedUser()
  const rateParsed = step4Schema.safeParse(data)
  if (!rateParsed.success) {
    return { error: rateParsed.error.issues[0]?.message ?? 'Invalid rate.' }
  }

  const supabase = await createClient()

  // Fetch the profile to validate completeness before marking done
  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('timezone, skills, contract_preference')
    .eq('user_id', user.id)
    .single()

  if (fetchError || !profile) {
    return { error: 'Profile not found. Please start from step 1.' }
  }

  const fullData = {
    timezone: profile.timezone,
    skills: Array.isArray(profile.skills) ? profile.skills as string[] : [],
    contract_preference: profile.contract_preference,
    min_rate_usd: rateParsed.data.min_rate_usd ?? null,
    rate_period: rateParsed.data.rate_period ?? null,
  }

  const completeParsed = completeProfileSchema.safeParse(fullData)
  if (!completeParsed.success) {
    return {
      error: completeParsed.error.issues[0]?.message ?? 'Profile is incomplete.',
    }
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      min_rate_usd: completeParsed.data.min_rate_usd ?? null,
      rate_period: completeParsed.data.rate_period ?? null,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[onboarding/complete] DB error:', updateError.code)
    return { error: 'Failed to complete profile. Please try again.' }
  }

  revalidatePath('/feed')
  redirect('/feed')
}
