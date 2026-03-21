import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base — shared across all variants
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-[250ms] cubic-bezier(0.4,0,0.2,1) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        // ── Gradient — primary CTA (pill, brand gradient) ──
        gradient: [
          "bg-brand-gradient text-white font-semibold font-display",
          "rounded-full shadow-brand-glow border-0",
          "hover:bg-brand-gradient-hover hover:shadow-[0_6px_20px_rgba(0,114,198,0.35)] hover:scale-[1.02]",
          "active:scale-[0.97]",
        ],

        // ── Secondary — outlined pill ──
        secondary: [
          "bg-transparent text-ink-primary font-body font-medium",
          "border border-[1.5px] border-border-default rounded-full",
          "hover:border-primary-500 hover:text-primary-500 hover:bg-primary-50",
        ],

        // ── Ghost — text-only, light hover ──
        ghost: [
          "bg-transparent text-primary-500 font-body",
          "rounded-md border-0",
          "hover:bg-primary-50",
        ],

        // ── Danger — solid destructive ──
        danger: [
          "bg-danger-500 text-white font-semibold font-display",
          "rounded-full border-0",
          "hover:bg-danger-600",
          "active:scale-[0.97]",
        ],

        // ── Shadcn defaults (kept for shadcn-internal usage) ──
        default:
          "bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground rounded-md shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },

      size: {
        sm:      "h-8  px-3  text-xs",
        default: "h-10 px-6  text-sm",
        lg:      "h-12 px-8  text-base",
        icon:    "h-9  w-9",
      },
    },
    defaultVariants: {
      variant: "gradient",
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
