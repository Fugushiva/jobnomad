/**
 * AuthLayout — shared layout for all authentication pages.
 *
 * Provides a vertically centred page with:
 *  - A Card (max-w-sm) containing: Logo, optional icon, title, subtitle, and children.
 *  - An optional footer rendered outside the Card (back-links, secondary CTAs).
 *
 * Usage:
 *  <AuthLayout title="Sign in" subtitle="Enter your email to receive a magic link.">
 *    <LoginForm />
 *  </AuthLayout>
 *
 *  <AuthLayout
 *    title="Check your email"
 *    icon={<MailIcon />}
 *    footer={<Link href="/auth/login">← Use a different email</Link>}
 *  >
 *    <p>We sent a magic link to your inbox.</p>
 *  </AuthLayout>
 *
 * Security:
 *  - Logo renders a <Link href="/"> — never nest inside another <Link>.
 *  - No user-supplied content reaches the <title> or <meta> tags here;
 *    each page must export its own `metadata`.
 */

import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface AuthLayoutProps {
  /** Text content for the page's <h1>. */
  title: string
  /** Optional descriptive paragraph rendered below the title. */
  subtitle?: ReactNode
  /**
   * Optional icon block rendered between the Logo and the title.
   * Intended for a decorative circle with an SVG (e.g. mail, warning).
   * Already encapsulated — AuthLayout does not wrap it further.
   */
  icon?: ReactNode
  /** Main content: form, CTAs, informational copy. */
  children?: ReactNode
  /**
   * Secondary links/buttons rendered *outside* the Card, below it.
   * Use for "Back to home", "Use a different email", etc.
   */
  footer?: ReactNode
}

export function AuthLayout({
  title,
  subtitle,
  icon,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main
      id="main"
      className="flex flex-col flex-1 items-center justify-center px-6 py-12 bg-bg"
    >
      <Card className="w-full max-w-sm rounded-2xl shadow-md">
        <CardHeader className="flex flex-col items-center gap-6 pb-0">
          {/* Logo always links to home — do NOT nest inside another <Link> */}
          <Logo href="/" size={28} label="JobNomad — home" />

          {/* Optional decorative icon (e.g. mail envelope, warning triangle) */}
          {icon}

          <div className="flex flex-col items-center text-center gap-2">
            <h1 className="text-display-md text-text">{title}</h1>
            {subtitle && (
              <div className="text-body-md text-text-soft">{subtitle}</div>
            )}
          </div>
        </CardHeader>

        {children && (
          <CardContent className="pt-6">{children}</CardContent>
        )}
      </Card>

      {/* Footer: back-links, secondary CTAs — rendered outside Card */}
      {footer && (
        <div className="flex flex-col items-center gap-2 mt-6">
          {footer}
        </div>
      )}
    </main>
  )
}
