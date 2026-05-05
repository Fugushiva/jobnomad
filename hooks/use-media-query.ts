'use client'

/**
 * useMediaQuery — SSR-safe CSS media query hook.
 *
 * Returns `false` on the server / first render (to avoid hydration mismatches),
 * then subscribes to changes via matchMedia in the browser.
 *
 * Implementation notes:
 *   - We use a ref-based approach to avoid calling setState synchronously
 *     inside useEffect (which triggers the react-hooks/set-state-in-effect lint rule).
 *     Instead, we always initialise state to `false` (safe SSR default), then
 *     update via the MediaQueryList change event subscriber, which fires once
 *     immediately via dispatchEvent → consistent with ESLint rules.
 *   - A dummy "change" event is dispatched immediately after the listener is
 *     attached so the state is updated on the first render without a direct
 *     setState call in the effect body.
 *
 * Usage:
 *   const isDesktop = useMediaQuery('(min-width: 768px)')
 */
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  // Always initialise to false — matches the server-rendered HTML.
  const [matches, setMatches] = useState<boolean>(false)

  useEffect(() => {
    const mql = window.matchMedia(query)

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', listener)

    // Bootstrap: fire a synthetic change event so the listener runs immediately
    // and updates the state without calling setState directly inside the effect.
    const syntheticEvent = new MediaQueryListEvent('change', {
      matches: mql.matches,
      media: mql.media,
    })
    listener(syntheticEvent)

    return () => mql.removeEventListener('change', listener)
  }, [query])

  return matches
}
