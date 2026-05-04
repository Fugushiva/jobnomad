import type { Metadata } from 'next'
import Link from 'next/link'
import { User } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Complete your profile — JobNomad',
  description: 'Set up your profile to receive personalized remote job matches.',
}

/**
 * /onboarding — Profile setup page (stub).
 *
 * Refactored: uses Header, Footer, Card, Button, Lucide icon.
 * Full 4-step wizard implementation in a future issue (F-M03 spec).
 */
export default function OnboardingPage() {
  return (
    <div className="flex flex-col flex-1 bg-bg text-text">
      <Header variant="app" />

      <main
        id="main"
        className="flex flex-col flex-1 items-center justify-center px-6 py-12"
      >
        <Card className="w-full max-w-lg rounded-2xl shadow-md">
          <CardHeader className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent-soft">
              <User className="h-7 w-7 text-accent" aria-hidden />
            </div>
            <div>
              <h1 className="text-display-lg text-text">Complete your profile</h1>
              <p className="text-body-lg text-text-soft mt-2">
                Tell us about your skills, timezone, and preferences so we can
                match you with the right remote roles.
              </p>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-4 pt-0">
            <p className="text-body-md text-text-muted text-center">
              Profile setup form coming soon (4-step wizard).
            </p>

            <Button asChild>
              <Link href="/feed">Go to feed</Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}
