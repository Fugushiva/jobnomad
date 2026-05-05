'use client'

/**
 * useMediaQuery — SSR-safe CSS media query hook.
 *
 * Returns `false` on the server / first render (to avoid hydration mismatches),
 * then updates synchronously once the component is mounted in the browser.
 *
 * Usage:
 *   const isDesktop = useMediaQuery('(min-width: 768px)')
 */
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  // Default to false so the server-rendered HTML matches the initial client render.
  const [matches, setMatches] = useState<boolean>(false)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    // Set the value immediately on mount
    setMatches(mediaQueryList.matches)

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    mediaQueryList.addEventListener('change', listener)
    return () => mediaQueryList.removeEventListener('change', listener)
  }, [query])

  return matches
}
