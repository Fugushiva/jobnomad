import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * cn — class name utility for shadcn/ui components.
 *
 * Merges clsx conditionals with tailwind-merge deduplication.
 * Always prefer this over manual string concatenation in components.
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
