import * as React from "react"
import { Check, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Mastery Badge ──────────────────────────────────────────────

export type MasteryStatus =
  | "mastered"
  | "good"
  | "average"
  | "remedial"
  | "at-risk"
  | "critical"

interface MasteryBadgeProps {
  status: MasteryStatus
  showIcon?: boolean
  size?: "sm" | "default"
  className?: string
}

const masteryConfig: Record<
  MasteryStatus,
  {
    label: string
    bg: string
    text: string
    icon?: React.ReactNode
  }
> = {
  mastered: {
    label: "Mastered",
    bg:    "bg-success-50",
    text:  "text-success-500",
    icon:  <Check className="w-3 h-3" strokeWidth={2.5} />,
  },
  good: {
    label: "Good",
    bg:    "bg-primary-50",
    text:  "text-primary-600",
    icon:  null,
  },
  average: {
    label: "Average",
    bg:    "bg-warning-50",
    text:  "text-[#8B7500]",
    icon:  null,
  },
  remedial: {
    label: "Remedial",
    bg:    "bg-warning-100",
    text:  "text-warning-600",
    icon:  null,
  },
  "at-risk": {
    label: "At-Risk",
    bg:    "bg-danger-50",
    text:  "text-danger-500",
    icon:  <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />,
  },
  critical: {
    label: "Critical",
    bg:    "bg-danger-500",
    text:  "text-white",
    icon:  <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />,
  },
}

export function MasteryBadge({
  status,
  showIcon = true,
  size = "default",
  className,
}: MasteryBadgeProps) {
  const config = masteryConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        config.bg,
        config.text,
        size === "default" && "px-2.5 py-1 text-xs",
        size === "sm"      && "px-2   py-0.5 text-[11px]",
        className
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  )
}


// ── Status Badge ───────────────────────────────────────────────

export type AssessmentStatus =
  | "draft"
  | "published"
  | "completed"
  | "graded"
  | "closed"

interface StatusBadgeProps {
  status: AssessmentStatus
  size?: "sm" | "default"
  className?: string
}

const statusConfig: Record<
  AssessmentStatus,
  { label: string; bg: string; text: string }
> = {
  draft: {
    label: "Draft",
    bg:    "bg-[#F0EDE8]",
    text:  "text-ink-secondary",
  },
  published: {
    label: "Published",
    bg:    "bg-primary-50",
    text:  "text-primary-600",
  },
  completed: {
    label: "Completed",
    bg:    "bg-success-50",
    text:  "text-success-600",
  },
  graded: {
    label: "Graded",
    bg:    "bg-accent-50",
    text:  "text-accent-700",
  },
  closed: {
    label: "Closed",
    bg:    "bg-[#EAEAEA]",
    text:  "text-[#888]",
  },
}

export function StatusBadge({
  status,
  size = "default",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        config.bg,
        config.text,
        size === "default" && "px-2.5 py-1 text-xs",
        size === "sm"      && "px-2   py-0.5 text-[11px]",
        className
      )}
    >
      {config.label}
    </span>
  )
}
