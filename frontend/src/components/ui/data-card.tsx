import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DataCardProps {
  title?: string
  subtitle?: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: "default" | "highlighted" | "alert"
  className?: string
  children: React.ReactNode
}

const variantStyles: Record<NonNullable<DataCardProps["variant"]>, string> = {
  default:     "bg-white",
  highlighted: "bg-brand-gradient-subtle",
  alert:       "bg-danger-50",
}

export function DataCard({
  title,
  subtitle,
  action,
  variant = "default",
  className,
  children,
}: DataCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-light shadow-card",
        "transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        variantStyles[variant],
        className
      )}
    >
      {/* Header — only rendered when title is provided */}
      {title && (
        <>
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div className="min-w-0">
              <h3 className="font-display text-[1.25rem] font-semibold leading-snug text-ink-primary truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-0.5 text-sm text-ink-secondary leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
            {action && (
              <Button
                variant="ghost"
                size="sm"
                onClick={action.onClick}
                className="shrink-0 -mr-1"
              >
                {action.label}
              </Button>
            )}
          </div>
          {/* Divider */}
          <div className="h-px bg-border-light" />
        </>
      )}

      {/* Body */}
      <div className="p-5">{children}</div>
    </div>
  )
}
