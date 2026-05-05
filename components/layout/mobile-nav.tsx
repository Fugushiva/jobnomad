'use client'

/**
 * MobileNav — slide-in navigation drawer for viewports < 768px (below `md`).
 *
 * Built on the shadcn `Sheet` component (Radix UI Dialog primitive), which
 * provides for free:
 *   - Focus trap: keyboard stays within the drawer while open
 *   - ESC closes the drawer (Radix Dialog keyboard handler)
 *   - Overlay clic closes the drawer (SheetOverlay click handler)
 *   - aria-modal, role="dialog", aria-labelledby wired automatically
 *
 * Variants:
 *   public  — landing / auth pages: Browse jobs + Sign in + Get started
 *   app     — authenticated pages: Feed + Saved + Settings + Sign out
 *
 * Security contract (MUST NOT be changed without audit):
 *   - Sign out is implemented as `<form action={signOut}>` (Server Action).
 *     This is the ONLY safe pattern in Next.js App Router:
 *       • POST request → not reproducible by a cross-site GET link click.
 *       • Origin check enforced by the Next.js framework automatically.
 *       • Session is invalidated on the Supabase server (not just cookie-cleared).
 *     Never replace with onClick + fetch or router.push('/api/signout').
 *   - userEmail is displayed with React's default JSX escaping — no XSS risk.
 *   - No prop exposes a callback that could leak the email to a parent.
 *   - No localStorage, no document.cookie access.
 *
 * Accessibility:
 *   - Burger trigger: aria-label="Open navigation menu"
 *   - Nav landmark: aria-label="Mobile navigation"
 *   - LogOut icon: aria-hidden (decorative, text label present)
 *   - SheetTitle rendered via Logo with screen-reader label
 *
 * @example
 *   // public variant (landing page header)
 *   <MobileNav variant="public" />
 *
 *   // app variant (authenticated feed header)
 *   <MobileNav variant="app" userEmail="alice@example.com" />
 */

import { useState } from 'react'
import Link from 'next/link'
import { Menu, LogOut } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { signOut } from '@/src/lib/auth/actions'
import { NAV_LINKS_PUBLIC, NAV_LINKS_APP } from './nav-links'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MobileNavVariant = 'public' | 'app'

export interface MobileNavProps {
  /** Controls which set of navigation links and actions are rendered. */
  variant?: MobileNavVariant
  /**
   * Authenticated user's email address.
   * Required to show the account section in `app` variant.
   * Ignored in `public` variant.
   */
  userEmail?: string
}

// ---------------------------------------------------------------------------
// MobileNavContent — testable interior (links + actions)
//
// Exported separately so unit tests can render the content in isolation
// without the Radix portal lifecycle (happy-dom doesn't simulate async
// pointer events needed to open a Dialog portal synchronously).
// See: components/layout/__tests__/mobile-nav.test.tsx
// ---------------------------------------------------------------------------

export interface MobileNavContentProps {
  variant: MobileNavVariant
  userEmail?: string
  onClose: () => void
}

export function MobileNavContent({ variant, userEmail, onClose }: MobileNavContentProps) {
  const navLinks = variant === 'app' ? NAV_LINKS_APP : NAV_LINKS_PUBLIC

  return (
    <>
      {/* Primary nav links */}
      <nav
        className="flex flex-col gap-1 mt-6"
        aria-label="Mobile navigation"
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-label-md px-3 py-2 rounded-md text-text-soft transition-colors hover:text-text hover:bg-bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onClose}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Public variant: auth CTAs */}
      {variant === 'public' && (
        <div className="flex flex-col gap-2 mt-6 pt-6 border-t border-border">
          <Button variant="outline" asChild className="w-full">
            <Link href="/auth/login" onClick={onClose}>
              Sign in
            </Link>
          </Button>
          <Button asChild className="w-full">
            <Link href="/auth/login" onClick={onClose}>
              Get started
            </Link>
          </Button>
        </div>
      )}

      {/* App variant: account section (settings + sign out) */}
      {variant === 'app' && userEmail && (
        <div className="mt-6 pt-6 border-t border-border">
          {/* Email display — truncated, no link, purely informational */}
          <p className="text-caption text-text-muted px-3 mb-2 truncate" title={userEmail}>
            {userEmail}
          </p>

          <Link
            href="/settings"
            className="block text-label-md px-3 py-2 rounded-md text-text-soft transition-colors hover:text-text hover:bg-bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onClose}
          >
            Settings
          </Link>

          {/*
           * Sign out — Server Action form (CSRF-safe, session invalidated server-side).
           * See security contract in JSDoc above. Do NOT change to onClick + fetch.
           */}
          <form action={signOut} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 text-left text-label-md px-3 py-2 rounded-md text-danger transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// MobileNav — full Sheet wrapper (trigger + content)
// ---------------------------------------------------------------------------

export function MobileNav({ variant = 'public', userEmail }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Burger trigger — visible only on mobile (positioning handled by parent Header) */}
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      {/*
       * SheetContent: Radix Dialog.Content inside a portal.
       * Provides focus trap, ESC handler, overlay click handler automatically.
       * w-[280px] sm:w-[320px] matches the original inline implementation.
       */}
      <SheetContent side="right" className="w-[280px] sm:w-[320px]">
        {/*
         * SheetHeader must contain SheetTitle (required by Radix for
         * aria-labelledby to be wired to the dialog element).
         * We render the Logo inside SheetTitle via asDiv to avoid nesting
         * an <a> inside a <h2> (Logo renders a link by default).
         */}
        <SheetHeader>
          <SheetTitle asChild>
            <Logo variant="default" size={28} asDiv label="JobNomad" />
          </SheetTitle>
        </SheetHeader>

        <MobileNavContent
          variant={variant}
          userEmail={userEmail}
          onClose={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
