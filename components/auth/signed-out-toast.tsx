'use client'

/**
 * SignedOutToast — displays a confirmation toast after successful sign-out.
 *
 * How it works:
 *   1. The signOut Server Action redirects to `/?signed_out=1`.
 *   2. app/page.tsx (Server Component) reads `searchParams.signed_out`
 *      and passes `show={true}` when the flag is present.
 *   3. This Client Component fires `toast.success()` on mount and then
 *      removes the query param from the URL (so a page reload doesn't
 *      re-show the toast).
 *
 * Security:
 *   - `signed_out=1` is a boolean UI flag only — it is never reflected
 *     back into the DOM as text content (no XSS surface).
 *   - router.replace() removes the param from the browser history
 *     so it doesn't appear in back-navigation or shared URLs.
 *
 * @example
 *   // In app/page.tsx
 *   <SignedOutToast show={searchParams.signed_out === '1'} />
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

interface SignedOutToastProps {
  /** When true, fires a success toast and cleans the URL on mount. */
  show: boolean
}

export function SignedOutToast({ show }: SignedOutToastProps) {
  const router = useRouter()
  // Use a ref to ensure the toast fires at most once per page visit,
  // even if the component re-renders with show=true multiple times.
  const firedRef = useRef(false)

  useEffect(() => {
    if (!show || firedRef.current) return

    firedRef.current = true

    // Show the confirmation toast
    toast.success('You have been signed out.')

    // Remove the ?signed_out=1 param so it doesn't persist in history
    // or get accidentally copied in shared URLs.
    router.replace('/')
  }, [show, router])

  // This component renders nothing — it is a side-effect-only component.
  return null
}
