'use client'

/**
 * LoginForm — magic link login form.
 *
 * Migrated from manual state management to:
 *   - react-hook-form for client validation (immediate feedback)
 *   - React 19 useActionState for Server Action progressive enhancement
 *   - shadcn/ui Form, Input, Button, Label primitives
 *
 * The form still works without JS (progressive enhancement via formAction).
 */

import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { sendMagicLink, type SendMagicLinkResult } from './actions'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<
    SendMagicLinkResult | null,
    FormData
  >(sendMagicLink, null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  })

  // Sync server-side errors back into the form
  useEffect(() => {
    if (state && !state.success && state.message) {
      form.setError('email', { message: state.message })
    }
  }, [state, form])

  // Success state — show confirmation
  if (state?.success) {
    return (
      <div className="flex flex-col items-center text-center gap-4">
        {/* Mail icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-soft">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h2 className="text-display-md text-text">Check your email</h2>
        <p className="text-body-lg max-w-sm text-text-soft">
          We sent a magic link to your inbox. Click the link to sign in — no
          password needed.
        </p>
        <p className="text-body-sm text-text-muted">
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline transition-colors text-primary hover:text-primary-hover"
          >
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form action={formAction} className="flex flex-col gap-5 w-full">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? 'Sending link…' : 'Send magic link'}
        </Button>
      </form>
    </Form>
  )
}
