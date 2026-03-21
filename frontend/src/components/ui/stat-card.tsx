import * as React from "react"
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendProps {
  value: string
  direction: "up" | "down" | "neutral"
}

interface StatCardProps {
  icon: LucideIcon
  iconColor: string       // e.g. "text-primary-500"
  iconBg: string          // e.g. "bg-primary-50"
  label: string
  value: string | number
  trend?: TrendProps
  subtitle?: string
  className?: string
}

export function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  trend,
  subtitle,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        // Card base — white surface on warm cream bg
        "bg-white rounded-lg border border-border-light p-5",
        "shadow-card transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:-translate-y-0.5 hover:shadow-card-hover",
        className
      )}
    >
      {/* Icon square */}
      <div
        className={cn(
          "w-10 h-10 rounded-md flex items-center justify-center",
          iconBg
        )}
      >
        <Icon className={cn("w-5 h-5", iconColor)} strokeWidth={1.75} />
      </div>

      {/* Label */}
      <p className="mt-3 text-xs font-medium text-ink-secondary leading-none tracking-wide">
        {label}
      </p>

      {/* Value */}
      <p className="mt-1 font-display text-[2rem] font-bold leading-tight text-ink-primary">
        {value}
      </p>

      {/* Trend / subtitle */}
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trend.direction === "up" && (
            <TrendingUp className="w-3.5 h-3.5 text-success-500" strokeWidth={2} />
          )}
          {trend.direction === "down" && (
            <TrendingDown className="w-3.5 h-3.5 text-danger-500" strokeWidth={2} />
          )}
          {trend.direction === "neutral" && (
            <Minus className="w-3.5 h-3.5 text-ink-tertiary" strokeWidth={2} />
          )}
          <span
            className={cn(
              "text-xs font-medium leading-none",
              trend.direction === "up"      && "text-success-500",
              trend.direction === "down"    && "text-danger-500",
              trend.direction === "neutral" && "text-ink-tertiary"
            )}
          >
            {trend.value}
          </span>
        </div>
      )}

      {subtitle && !trend && (
        <p className="mt-2 text-xs text-ink-tertiary leading-none">{subtitle}</p>
      )}
    </div>
  )
}
