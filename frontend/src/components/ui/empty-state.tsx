import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-secondary mb-4">
        <Icon className="w-8 h-8 text-ink-tertiary" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className="font-display text-[1.25rem] font-semibold text-ink-primary leading-snug">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-2 text-sm text-ink-secondary leading-relaxed max-w-sm">
        {description}
      </p>

      {/* Optional CTA */}
      {actionLabel && onAction && (
        <Button
          variant="gradient"
          size="default"
          onClick={onAction}
          className="mt-6"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
