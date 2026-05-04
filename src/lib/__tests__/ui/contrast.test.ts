/**
 * WCAG 2.1 AA Contrast tests — JobNomad design system
 *
 * Validates that critical color pairings from style.pdf (page 3) meet
 * the 4.5:1 contrast ratio required for normal text (WCAG AA) or
 * 3:1 for large text / UI components (WCAG AA).
 *
 * Color math: OKLCh → OKLab → XYZ (D65) → sRGB → linear → luminance
 * This is the accurate conversion; approximations failed for high-chroma hues.
 *
 * Known results from style.pdf page 3:
 *   ✓ Body text on bg:      ~12.38:1  (AA normal text)
 *   ✓ Body text on surface: ~12.74:1  (AA normal text)
 *   ⚠ Soft text on bg:      ~3.64:1   (large text / supporting UI only)
 *   ⚠ Text on primary:      ~3.77:1   (UI chrome — buttons, not body text)
 *   ✓ Text on accent:       ~5.89:1   (AA normal text)
 *   ⚠ Danger text:          ~2.81:1   (always paired with icon, not standalone)
 */

import { describe, it, expect } from 'vitest'

// ── Colour conversion: OKLCh → relative luminance ────────────────────────────

function oklchToOklab(l: number, c: number, h: number): [number, number, number] {
  const hRad = (h * Math.PI) / 180
  return [l, c * Math.cos(hRad), c * Math.sin(hRad)]
}

function oklabToLinearSRGB(L: number, a: number, b: number): [number, number, number] {
  // OKLab → LMS (cube)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  // LMS → linear sRGB
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

function linearToWcagChannel(c: number): number {
  const clamped = Math.max(0, Math.min(1, c))
  return clamped <= 0.04045
    ? clamped / 12.92
    : ((clamped + 0.055) / 1.055) ** 2.4
}

/**
 * Convert OKLCh to WCAG relative luminance.
 * Uses the precise OKLCh→OKLab→LMS→sRGB→linear→Y pipeline.
 */
function oklchLuminance(l: number, c: number, h: number): number {
  const [L, a, b] = oklchToOklab(l, c, h)
  const [r, g, blue] = oklabToLinearSRGB(L, a, b)
  const rLin = linearToWcagChannel(r)
  const gLin = linearToWcagChannel(g)
  const bLin = linearToWcagChannel(blue)
  // WCAG luminance formula
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Token values (must match globals.css) ────────────────────────────────────
// Format: [L, C, H] matching oklch(L C H) in CSS
const T = {
  light: {
    text:        [0.180, 0.014, 60]  as [number, number, number],
    'text-soft': [0.480, 0.018, 66]  as [number, number, number],
    bg:          [0.985, 0.006, 78]  as [number, number, number],
    surface:     [1.000, 0.000,  0]  as [number, number, number],
    primary:     [0.470, 0.092, 201] as [number, number, number],
    accent:      [0.660, 0.148, 52]  as [number, number, number],
    danger:      [0.560, 0.168, 28]  as [number, number, number],
    'surface-text': [0.180, 0.014, 60] as [number, number, number],
  },
  dark: {
    text:        [0.940, 0.008, 72]  as [number, number, number],
    'text-soft': [0.700, 0.016, 68]  as [number, number, number],
    bg:          [0.130, 0.010, 60]  as [number, number, number],
    surface:     [0.175, 0.012, 62]  as [number, number, number],
    primary:     [0.680, 0.110, 201] as [number, number, number],
    accent:      [0.720, 0.155, 52]  as [number, number, number],
    danger:      [0.640, 0.175, 28]  as [number, number, number],
    'primary-soft': [0.240, 0.045, 210] as [number, number, number],
    'danger-soft':  [0.220, 0.040, 26]  as [number, number, number],
    'score-mid-soft': [0.220, 0.050, 60] as [number, number, number],
  },
}

function lum(theme: 'light' | 'dark', token: keyof typeof T.light | keyof typeof T.dark): number {
  const t = (T[theme] as Record<string, [number, number, number]>)[token]
  return oklchLuminance(t[0], t[1], t[2])
}

function cr(theme: 'light' | 'dark', fg: string, bg: string): number {
  const tokens = T[theme] as Record<string, [number, number, number]>
  const fgL = oklchLuminance(...tokens[fg])
  const bgL = oklchLuminance(...tokens[bg])
  return contrastRatio(fgL, bgL)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WCAG 2.1 AA — contrast ratios (style.pdf pairings)', () => {
  describe('Light theme', () => {
    it('body text on bg: ≥4.5:1 (AA normal text, target ~12.38:1)', () => {
      expect(cr('light', 'text', 'bg')).toBeGreaterThanOrEqual(4.5)
    })

    it('body text on surface: ≥4.5:1 (AA normal text, target ~12.74:1)', () => {
      expect(cr('light', 'text', 'surface')).toBeGreaterThanOrEqual(4.5)
    })

    it('soft text on bg: ≥3.0:1 (AA large text / supporting UI only)', () => {
      // style.pdf documents ~3.64:1. Not used for body copy.
      expect(cr('light', 'text-soft', 'bg')).toBeGreaterThanOrEqual(3.0)
    })

    it('accent text on bg: ≥4.5:1 (AA normal text, target ~5.89:1)', () => {
      // Accent (sun) is a warm orange-brown at L=0.660 — passes 4.5:1
      expect(cr('light', 'accent', 'bg')).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('Dark theme', () => {
    it('body text on bg: ≥4.5:1 (AA normal text)', () => {
      expect(cr('dark', 'text', 'bg')).toBeGreaterThanOrEqual(4.5)
    })

    it('body text on surface: ≥4.5:1 (AA normal text)', () => {
      expect(cr('dark', 'text', 'surface')).toBeGreaterThanOrEqual(4.5)
    })

    it('primary (lagoon) on bg: ≥3.0:1 (UI chrome — buttons, not body text)', () => {
      // style.pdf documents ~3.77:1. Used for UI elements, not body text.
      expect(cr('dark', 'primary', 'bg')).toBeGreaterThanOrEqual(3.0)
    })

    it('accent (sun) on dark bg: ≥3.0:1 (UI emphasis)', () => {
      expect(cr('dark', 'accent', 'bg')).toBeGreaterThanOrEqual(3.0)
    })

    it('surface is visually distinct from bg in dark mode', () => {
      // Surface must be lighter than bg (prevents invisible borders)
      const surfaceLum = oklchLuminance(...T.dark.surface)
      const bgLum = oklchLuminance(...T.dark.bg)
      expect(surfaceLum).toBeGreaterThan(bgLum)
    })
  })

  describe('Score badge legibility (dark theme)', () => {
    it('score-high: primary text on primary-soft bg ≥3:1', () => {
      const textL = oklchLuminance(...T.dark.primary)
      const bgL = oklchLuminance(...T.dark['primary-soft'])
      expect(contrastRatio(textL, bgL)).toBeGreaterThanOrEqual(3.0)
    })

    it('score-low: danger text on danger-soft bg ≥3:1', () => {
      const textL = oklchLuminance(...T.dark.danger)
      const bgL = oklchLuminance(...T.dark['danger-soft'])
      expect(contrastRatio(textL, bgL)).toBeGreaterThanOrEqual(3.0)
    })

    it('score-mid: accent text on score-mid-soft bg ≥3:1', () => {
      const textL = oklchLuminance(...T.dark.accent)
      const bgL = oklchLuminance(...T.dark['score-mid-soft'])
      expect(contrastRatio(textL, bgL)).toBeGreaterThanOrEqual(3.0)
    })
  })
})
