/**
 * Tests for components/ui/sonner.tsx — JobNomad's Toaster wrapper.
 *
 * Strategy:
 *   - Smoke test: <Toaster /> mounts without errors.
 *   - Theme integration: the wrapper reads the `theme` from next-themes and
 *     forwards it to Sonner; we verify the mock received the expected prop.
 *   - Position: useMediaQuery drives the position prop (top-right on desktop,
 *     top-center on mobile); we verify both branches via the mock.
 *   - Duration: verifies the default 4 000 ms duration prop is forwarded.
 *   - Prop override: any prop explicitly passed to <Toaster> wins over the
 *     defaults (standard spread behaviour).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Toaster } from '../sonner'

afterEach(() => cleanup())

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture props passed to the underlying Sonner <Toaster>
const mockSonnerToaster = vi.fn((_props: Record<string, unknown>) => <div data-testid="sonner-toaster" />)

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => mockSonnerToaster(props),
}))

// next-themes — control the theme value per test
const mockUseTheme = vi.fn(() => ({ theme: 'dark' }))
vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))

// useMediaQuery — control desktop / mobile per test
const mockUseMediaQuery = vi.fn(() => false) // default: mobile
vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: (_query: string) => mockUseMediaQuery(),
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Toaster (sonner wrapper)', () => {
  beforeEach(() => {
    mockSonnerToaster.mockClear()
    mockUseTheme.mockReturnValue({ theme: 'dark' })
    mockUseMediaQuery.mockReturnValue(false) // mobile by default
  })

  it('renders without throwing', () => {
    expect(() => render(<Toaster />)).not.toThrow()
  })

  it('renders the Sonner toaster into the DOM', () => {
    const { getByTestId } = render(<Toaster />)
    expect(getByTestId('sonner-toaster')).not.toBeNull()
  })

  it('forwards the theme from next-themes to Sonner', () => {
    mockUseTheme.mockReturnValue({ theme: 'light' })
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.theme).toBe('light')
  })

  it('defaults to "system" theme when next-themes returns undefined', () => {
    // next-themes can return undefined during SSR / first render
    mockUseTheme.mockReturnValue({ theme: undefined as unknown as string })
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.theme).toBe('system')
  })

  it('uses "top-center" position on mobile (< 768px)', () => {
    mockUseMediaQuery.mockReturnValue(false) // mobile
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.position).toBe('top-center')
  })

  it('uses "top-right" position on desktop (≥ 768px)', () => {
    mockUseMediaQuery.mockReturnValue(true) // desktop
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.position).toBe('top-right')
  })

  it('sets default duration to 4000 ms', () => {
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.duration).toBe(4000)
  })

  it('does not use richColors (we drive colours via CSS vars)', () => {
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.richColors).toBe(false)
  })

  it('allows prop overrides to take precedence', () => {
    render(<Toaster duration={8000} />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    expect(lastCall?.duration).toBe(8000)
  })

  it('forwards icon components (success, error, info, warning, loading)', () => {
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    const icons = lastCall?.icons as Record<string, unknown>
    expect(icons).toBeDefined()
    expect(icons?.success).toBeDefined()
    expect(icons?.error).toBeDefined()
    expect(icons?.info).toBeDefined()
    expect(icons?.warning).toBeDefined()
    expect(icons?.loading).toBeDefined()
  })

  it('provides toastOptions with classNames for all toast types', () => {
    render(<Toaster />)
    const lastCall = mockSonnerToaster.mock.calls.at(-1)?.[0]
    const classNames = (lastCall?.toastOptions as { classNames?: Record<string, string> })?.classNames
    expect(classNames).toBeDefined()
    expect(classNames?.success).toContain('var(--success-soft)')
    expect(classNames?.error).toContain('var(--danger-soft)')
    expect(classNames?.info).toContain('var(--surface)')
    expect(classNames?.warning).toContain('var(--warning-soft)')
  })
})
