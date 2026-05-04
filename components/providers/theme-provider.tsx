'use client'

/**
 * ThemeProvider — wraps next-themes for class-based dark mode.
 *
 * Configuration:
 *   attribute="class"   → adds/removes "dark" class on <html>
 *   defaultTheme="dark" → dark mode forced by default (per issue #16)
 *   enableSystem        → user can still choose "system" in the toggle
 *   disableTransitionOnChange → prevents flash during theme switch
 *
 * Usage: wrap the app in <ThemeProvider> inside app/layout.tsx.
 * The theme preference is persisted in localStorage automatically.
 */
import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
