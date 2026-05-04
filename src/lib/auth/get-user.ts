/**
 * Shared helper to get the authenticated user in Server Components and Actions.
 *
 * Uses supabase.auth.getUser() which validates the JWT server-side
 * (not just reading the cookie like getSession()).
 *
 * Returns { user } or { user: null } — never throws.
 */
import { createClient } from '@/src/lib/supabase/server'

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, supabase }
  }

  return { user, supabase }
}

/**
 * Get user and their profile in one call.
 * Returns { user, profile } — profile may be null if onboarding incomplete.
 */
export async function getUserWithProfile() {
  const { user, supabase } = await getUser()

  if (!user) {
    return { user: null, profile: null, supabase }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return { user, profile, supabase }
}
