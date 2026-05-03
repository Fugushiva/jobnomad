// Service-role client — bypasses ALL RLS policies.
// Use ONLY in:
//   - /app/api/cron/* route handlers
//   - /app/api/webhooks/stripe route handler
// NEVER import in Client Components or expose to browser.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. ' +
      'Service client must only be used server-side.',
    )
  }

  return createClient<Database>(url, key, {
    auth: {
      // Disable auto-refresh — service clients don't have sessions
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
