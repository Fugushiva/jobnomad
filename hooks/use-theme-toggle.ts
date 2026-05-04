'use client'

/**
 * useThemeToggle — cycle through light / dark / system themes.
 *
 * Returns the current theme and a toggle function for the Header theme button.
 * Uses next-themes under the hood; safe to call in any client component.
 *
 * @example
 *   const { theme, toggle, label } = useThemeToggle()
 */
import { useTheme } from 'next-themes'
import { useCallback } from 'react'

const THEMES = ['dark', 'light', 'system'] as const
type Theme = (typeof THEMES)[number]

export function useThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const toggle = useCallback(() => {
    const current = theme as Theme
    const idx = THEMES.indexOf(current)
    const next = THEMES[(idx + 1) % THEMES.length]
    setTheme(next)
  }, [theme, setTheme])

  const label: Record<Theme, string> = {
    dark: 'Dark',
    light: 'Light',
    system: 'System',
  }

  return {
    theme: theme as Theme,
    resolvedTheme,
    toggle,
    label: label[theme as Theme] ?? 'Dark',
  }
}
