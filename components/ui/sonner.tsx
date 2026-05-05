"use client"

/**
 * Toaster — JobNomad's global toast provider, built on Sonner + shadcn/ui.
 *
 * Configuration:
 *   position    → "top-right" on desktop (≥768 px), "top-center" on mobile
 *   duration    → 4 000 ms (as per issue #39)
 *   theme       → follows next-themes: dark / light / system
 *   richColors  → false — we drive colours via design-system CSS vars (globals.css)
 *   icons       → lucide-react, consistent with the rest of the icon library
 *
 * Usage:
 *   Mount <Toaster /> once in app/layout.tsx (inside <ThemeProvider>).
 *   Trigger toasts from any Client Component via @/lib/toast.
 *
 * Security note:
 *   Never call toast.error(error.message) directly.
 *   Always use the toastError() helper from @/lib/toast to avoid leaking
 *   server-side error details (stack traces, SQL messages, file paths).
 */

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useMediaQuery } from "@/hooks/use-media-query"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isDesktop ? "top-right" : "top-center"}
      duration={4000}
      richColors={false}
      icons={{
        success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
        info: <InfoIcon className="size-4" aria-hidden="true" />,
        warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
        error: <OctagonXIcon className="size-4" aria-hidden="true" />,
        loading: <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast: [
            "group/toast",
            "flex items-start gap-2",
            "rounded-[var(--radius-md)]",
            "border",
            "px-4 py-3",
            "shadow-md",
            "text-sm font-medium",
            "transition-all",
          ].join(" "),
          title: "font-semibold",
          description: "text-[var(--text-soft)] font-normal",
          // Per-type colour overrides — mapped to JobNomad design tokens
          success: [
            "bg-[var(--success-soft)]",
            "text-[var(--text)]",
            "border-[var(--success)]",
          ].join(" "),
          error: [
            "bg-[var(--danger-soft)]",
            "text-[var(--text)]",
            "border-[var(--danger)]",
          ].join(" "),
          info: [
            "bg-[var(--surface)]",
            "text-[var(--text)]",
            "border-[var(--border)]",
          ].join(" "),
          warning: [
            "bg-[var(--warning-soft)]",
            "text-[var(--text)]",
            "border-[var(--warning)]",
          ].join(" "),
          // Loading inherits info styling
          loading: [
            "bg-[var(--surface)]",
            "text-[var(--text)]",
            "border-[var(--border)]",
          ].join(" "),
          // Close button
          closeButton: [
            "rounded-[var(--radius-sm)]",
            "border-[var(--border)]",
            "bg-[var(--surface)]",
            "text-[var(--text-muted)]",
            "hover:text-[var(--text)]",
            "transition-colors",
          ].join(" "),
          // Action button
          actionButton: [
            "bg-[var(--primary)]",
            "text-white",
            "rounded-[var(--radius-sm)]",
            "px-2 py-1",
            "text-xs font-medium",
            "hover:bg-[var(--primary-hover)]",
            "transition-colors",
          ].join(" "),
          cancelButton: [
            "bg-[var(--surface-tint)]",
            "text-[var(--text-soft)]",
            "rounded-[var(--radius-sm)]",
            "px-2 py-1",
            "text-xs font-medium",
            "hover:bg-[var(--border)]",
            "transition-colors",
          ].join(" "),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
