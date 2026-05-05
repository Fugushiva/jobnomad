'use client'

/**
 * Header — site navigation header.
 *
 * Variants:
 *   public  -- landing / auth pages: Sign in + Get started CTAs
 *   app     -- authenticated feed/onboarding: user avatar + dropdown + sign out
 *
 * Features:
 *   - Skip link for keyboard/screen-reader users (a11y)
 *   - Sticky top with backdrop blur
 *   - MobileNav drawer (hamburger) for viewports < md (see mobile-nav.tsx)
 *   - ThemeToggle (dark/light/system) -- loaded client-only to avoid hydration mismatch
 *   - Keyboard navigable: Tab through all interactive elements
 *
 * Mobile navigation:
 *   The Sheet/drawer logic has been extracted into `./mobile-nav.tsx` for
 *   testability and single-responsibility. The burger trigger and all drawer
 *   content live there. Header only decides which variant + email to forward.
 *
 * Logout:
 *   The "Sign out" button invokes the `signOut` Server Action via a <form>.
 *   This is the only secure pattern for logout in Next.js App Router:
 *     - Server Action → CSRF-protected automatically (POST + origin check).
 *     - Session invalidated on the Supabase server (not just cookie-cleared).
 *     - No client-side fetch or router.push() needed.
 *   See src/lib/auth/actions.ts for the full security contract.
 *   The same contract is enforced inside MobileNav — see mobile-nav.tsx.
 *
 * @example
 *   <Header variant="public" />
 *   <Header variant="app" userEmail="user@example.com" />
 */

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { LogOut } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { signOut } from '@/src/lib/auth/actions'
import { NAV_LINKS_PUBLIC, NAV_LINKS_APP } from './nav-links'
import { MobileNav } from './mobile-nav'

/**
 * ThemeToggle is loaded with ssr:false to prevent hydration mismatch.
 *
 * next-themes reads the theme from localStorage (client-only). On the server
 * the theme is unknown, so any icon rendered SSR-side would mismatch the
 * resolved client icon. By disabling SSR for this component React never
 * attempts to reconcile the icon between server and client renders.
 *
 * The loading placeholder is a same-sized invisible button so the header
 * layout does not shift when the toggle appears after hydration.
 */
const ThemeToggle = dynamic(
  () => import('./theme-toggle').then((m) => m.ThemeToggle),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-9" aria-hidden="true" />
    ),
  }
)

type HeaderVariant = 'public' | 'app'

interface HeaderProps {
  variant?: HeaderVariant
  userEmail?: string
  className?: string
}

/**
 * UserMenu — desktop avatar dropdown for authenticated users.
 *
 * Exported for unit testing purposes (allows testing in isolation without
 * the full Header, including Radix portal interactions).
 *
 * The logout form uses a Server Action (`action={signOut}`) which is the
 * correct Next.js 16 App Router pattern. Passing a Server Action reference
 * from a Client Component to a <form action> is explicitly supported and
 * safe — Next.js serializes the action reference and the request is always
 * POST, CSRF-protected by the framework.
 */
export function UserMenu({ email }: { email: string }) {
  // Use first two characters of the email local part for initials.
  // If the email has a single character before @, we use that character twice.
  const localPart = email.split('@')[0] ?? email
  const initials = localPart.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label={`User menu for ${email}`}
        >
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-label-md leading-none">Account</p>
            <p className="text-caption leading-none text-text-muted truncate">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Sign out via Server Action — CSRF-safe, session invalidated server-side */}
        <DropdownMenuItem asChild>
          <form action={signOut} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-2 text-left text-danger"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ variant = 'public', userEmail, className }: HeaderProps) {
  const navLinks = variant === 'app' ? NAV_LINKS_APP : NAV_LINKS_PUBLIC

  return (
    <>
      {/* Skip link -- accessible keyboard shortcut to main content */}
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header
        className={cn(
          'sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm',
          className
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Logo variant="default" size={28} />

          {/* Desktop nav — hidden on mobile, visible from md breakpoint */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Main navigation"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-label-md px-3 py-1.5 rounded-md text-text-soft transition-colors hover:text-text hover:bg-bg-tint"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right actions — hidden on mobile, visible from md breakpoint */}
          <div className="hidden md:flex items-center gap-1">
            <ThemeToggle />

            {variant === 'public' ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/login">Get started</Link>
                </Button>
              </>
            ) : (
              userEmail && <UserMenu email={userEmail} />
            )}
          </div>

          {/*
           * Mobile area — visible below md breakpoint, hidden above.
           * ThemeToggle stays here (accessible without opening the drawer).
           * MobileNav renders the burger trigger + Sheet drawer.
           * All drawer logic (focus trap, ESC, links, sign out) lives in
           * components/layout/mobile-nav.tsx.
           */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <MobileNav variant={variant} userEmail={userEmail} />
          </div>
        </div>
      </header>
    </>
  )
}
