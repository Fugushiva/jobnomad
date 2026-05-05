/**
 * SignedOutToast component tests.
 *
 * Tests verify:
 *  1. When show=true: toast.success is called with the confirmation message.
 *  2. When show=true: router.replace('/') is called to clean the URL.
 *  3. When show=false: neither toast nor router is called.
 *  4. The component renders nothing visible in the DOM.
 *  5. Show flag change from false -> true triggers the effect.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { SignedOutToast } from '../signed-out-toast'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

/**
 * Mock @/lib/toast to capture toast.success calls.
 * We use vi.hoisted so the mock is available before the module is imported.
 */
const { mockToastSuccess } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    success: mockToastSuccess,
    error: vi.fn(),
    info: vi.fn(),
  },
  toastError: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignedOutToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing visible (side-effect-only component)', () => {
    const { container } = render(<SignedOutToast show={false} />)
    // No visible DOM content — the component returns null
    expect(container.firstChild).toBeNull()
  })

  it('does NOT call toast.success when show=false', () => {
    render(<SignedOutToast show={false} />)
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('does NOT call router.replace when show=false', () => {
    render(<SignedOutToast show={false} />)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('calls toast.success with the sign-out confirmation message when show=true', async () => {
    await act(async () => {
      render(<SignedOutToast show={true} />)
    })
    expect(mockToastSuccess).toHaveBeenCalledOnce()
    expect(mockToastSuccess).toHaveBeenCalledWith('You have been signed out.')
  })

  it('calls router.replace("/") to clean the URL when show=true', async () => {
    await act(async () => {
      render(<SignedOutToast show={true} />)
    })
    expect(mockReplace).toHaveBeenCalledOnce()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('both toast and router.replace are called on show=true', async () => {
    await act(async () => {
      render(<SignedOutToast show={true} />)
    })
    expect(mockToastSuccess).toHaveBeenCalledOnce()
    expect(mockReplace).toHaveBeenCalledOnce()
  })

  it('does not call toast or router.replace more than once (no re-trigger on re-render)', async () => {
    const { rerender } = render(<SignedOutToast show={false} />)
    await act(async () => {
      rerender(<SignedOutToast show={true} />)
    })
    expect(mockToastSuccess).toHaveBeenCalledOnce()
    expect(mockReplace).toHaveBeenCalledOnce()

    // Re-render with same prop — must not fire again
    await act(async () => {
      rerender(<SignedOutToast show={true} />)
    })
    expect(mockToastSuccess).toHaveBeenCalledOnce()
    expect(mockReplace).toHaveBeenCalledOnce()
  })

  it('router.replace targets "/" — not a different URL (no open redirect)', async () => {
    await act(async () => {
      render(<SignedOutToast show={true} />)
    })
    const destination = mockReplace.mock.calls[0][0]
    expect(destination).toBe('/')
    // Ensure it's exactly '/' not something like '/?param' or '/other'
    expect(destination).not.toContain('signed_out')
    expect(destination).not.toMatch(/^https?:\/\//)
  })
})
