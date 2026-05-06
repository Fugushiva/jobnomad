/**
 * POST /api/jobs/[id]/track-apply
 *
 * Inserts a job_views row with action='click_apply'.
 * Called via navigator.sendBeacon from ApplyButton — expects no body.
 *
 * Security:
 *  - Authenticates via Supabase session cookie (getUser).
 *  - Validates job id with Zod (UUID).
 *  - Uses user-context client (RLS applies: insert_own policy).
 *  - Rate-limited implicitly via RLS insert policy (no hard limit in Phase 1).
 *
 * Response:
 *  - 204 No Content on success (sendBeacon ignores response body).
 *  - 401 if not authenticated.
 *  - 400 if id is not a valid UUID.
 *  - 500 on DB error (logged, not surfaced to client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/src/lib/auth/get-user'
import { createClient } from '@/src/lib/supabase/server'

const jobIdSchema = z.string().uuid()

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // -- Auth ----------------------------------------------------------------
  const { user } = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // -- Validate params (Next.js 16: params is a Promise) -------------------
  const { id } = await params
  const parsed = jobIdSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 })
  }

  // -- Insert job_views row ------------------------------------------------
  const supabase = await createClient()
  const { error } = await supabase.from('job_views').insert({
    user_id: user.id,
    job_id: parsed.data,
    action: 'click_apply',
  })

  if (error) {
    // Log for observability but do not expose DB details to client
    console.error('[track-apply] DB error:', error.code, error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 204 No Content — sendBeacon ignores the response body anyway
  return new NextResponse(null, { status: 204 })
}
