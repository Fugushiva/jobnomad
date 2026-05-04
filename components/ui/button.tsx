import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-surface shadow-sm hover:bg-primary-hover focus-visible:ring-ring",
        secondary:
          "bg-surface text-text shadow-xs border border-border hover:bg-bg focus-visible:ring-ring",
        outline:
          "border border-border-strong bg-transparent text-text shadow-xs hover:bg-bg-tint focus-visible:ring-ring",
        ghost:
          "text-text hover:bg-bg-tint focus-visible:ring-ring",
        destructive:
          "bg-danger text-surface shadow-xs hover:bg-coral-700 focus-visible:ring-danger",
        link:
          "text-primary underline-offset-4 hover:underline focus-visible:ring-ring",
      },
      size: {
        sm:  "h-8 rounded-md gap-1.5 px-3 text-label-sm",
        default: "h-9 px-4 py-2 rounded-md",
        lg:  "h-10 px-6 rounded-md text-body-lg",
        icon: "h-9 w-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
