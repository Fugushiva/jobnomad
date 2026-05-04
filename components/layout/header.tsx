'use client'

/**
 * Header — site navigation header.
 *
 * Variants:
 *   public  — landing / auth pages: Sign in + Get started CTAs
 *   app     — authenticated feed/onboarding: user avatar + dropdown + sign out
 *
 * Features:
 *   - Skip link for keyboard/screen-reader users (a11y)
 *   - Sticky top with backdrop blur
 *   - Mobile Sheet (hamburger) for viewports < md
 *   - Theme toggle (dark/light/system) via DropdownMenu
 *   - Keyboard navigable: Tab → all interactive elements
 *
 * @example
 *   <Header variant="public" />
 *   <Header variant="app" userEmail="user@example.com" />
 */

import Link from 'next/link'
import { useState } from 'react'
import { Menu, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
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

type HeaderVariant = 'public' | 'app'

interface HeaderProps {
  variant?: HeaderVariant
  userEmail?: string
  className?: string
}

const NAV_LINKS_PUBLIC = [
  { href: '/jobs', label: 'Browse jobs' },
]

const NAV_LINKS_APP = [
  { href: '/feed', label: 'Feed' },
  { href: '/saved', label: 'Saved' },
]

/**
 * ThemeToggle — theme switcher with hydration-safe icon rendering.
 *
 * next-themes resolves the theme client-side (localStorage/cookie).
 * On the server, `theme` is undefined — the icon defaults to Monitor.
 * On the client after hydration, it resolves to 'dark'/'light'/'system'.
 *
 * The <span suppressHydrationWarning> tells React to skip reconciling its
 * children's attributes during hydration. This is the correct pattern for
 * values that intentionally differ between SSR and client first-render.
 * React only suppresses one level deep — the span itself is stable.
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const ThemeIcon =
    theme === 'dark' ? Moon
    : theme === 'light' ? Sun
    : Monitor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="text-text-muted hover:text-text"
        >
          {/*
           * suppressHydrationWarning on this span: the icon className
           * (lucide-moon vs lucide-monitor) differs between SSR and client.
           * React skips hydration comparison for this element's children.
           */}
          <span suppressHydrationWarning>
            <ThemeIcon className="h-4 w-4" aria-hidden />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn(theme === 'light' && 'text-primary font-medium')}
        >
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn(theme === 'dark' && 'text-primary font-medium')}
        >
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn(theme === 'system' && 'text-primary font-medium')}
        >
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase()

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
        <DropdownMenuItem asChild>
          <form action="/auth/signout" method="POST" className="w-full">
            <button type="submit" className="w-full text-left text-danger">
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ variant = 'public', userEmail, className }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navLinks = variant === 'app' ? NAV_LINKS_APP : NAV_LINKS_PUBLIC

  return (
    <>
      {/* Skip link — accessible keyboard shortcut to main content */}
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

          {/* Desktop nav */}
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

          {/* Desktop right actions */}
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

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle asChild>
                    <Logo variant="default" size={28} asDiv label="JobNomad" />
                  </SheetTitle>
                </SheetHeader>

                <nav
                  className="flex flex-col gap-1 mt-6"
                  aria-label="Mobile navigation"
                >
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-label-md px-3 py-2 rounded-md text-text-soft transition-colors hover:text-text hover:bg-bg-tint"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                {variant === 'public' && (
                  <div className="flex flex-col gap-2 mt-6 pt-6 border-t border-border">
                    <Button variant="outline" asChild className="w-full">
                      <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
                        Get started
                      </Link>
                    </Button>
                  </div>
                )}

                {variant === 'app' && userEmail && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-caption text-text-muted px-3 mb-2 truncate">{userEmail}</p>
                    <Link
                      href="/settings"
                      className="block text-label-md px-3 py-2 rounded-md text-text-soft transition-colors hover:text-text hover:bg-bg-tint"
                      onClick={() => setMobileOpen(false)}
                    >
                      Settings
                    </Link>
                    <form action="/auth/signout" method="POST" className="mt-1">
                      <button
                        type="submit"
                        className="w-full text-left text-label-md px-3 py-2 rounded-md text-danger transition-colors hover:bg-danger-soft"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  )
}
