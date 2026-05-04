import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border text-label-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-surface shadow-xs hover:bg-primary-hover",
        secondary:
          "border-transparent bg-bg-tint text-text-soft hover:bg-border",
        outline:
          "border-border text-text",
        destructive:
          "border-transparent bg-danger text-surface shadow-xs hover:bg-coral-700",
        /* -- JobNomad match score variants -- */
        "score-high":
          "border-transparent bg-score-high-soft text-score-high px-2 py-0.5 tabular-nums",
        "score-mid":
          "border-transparent bg-score-mid-soft text-score-mid px-2 py-0.5 tabular-nums",
        "score-low":
          "border-transparent bg-score-low-soft text-score-low px-2 py-0.5 tabular-nums",
        /* -- Red flag — coral, for warning signals on job listings -- */
        "red-flag":
          "border-transparent bg-danger-soft text-danger gap-1.5",
      },
      size: {
        default: "px-2.5 py-0.5",
        sm: "px-1.5 py-px",
        lg: "px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
