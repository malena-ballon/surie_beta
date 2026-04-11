"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Search, Bell, ChevronDown, LogOut, Settings, HelpCircle, Menu, LayoutDashboard, BarChart3, FlaskConical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebar } from "@/components/layout/sidebar-context"
import { useAuth } from "@/providers/auth-provider"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────
export interface BreadcrumbItem {
  label: string
  href?: string
}

interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[]
  hasNotifications?: boolean
}

// ── Breadcrumb ─────────────────────────────────────────────────
function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={item.label}>
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary shrink-0" strokeWidth={2} />
            )}
            {isLast || !item.href ? (
              <span
                className={cn(
                  "text-sm font-medium leading-none truncate",
                  isLast ? "text-ink-primary" : "text-ink-tertiary"
                )}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-sm font-medium leading-none text-ink-tertiary hover:text-ink-primary transition-colors duration-[150ms] truncate"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ── Avatar ─────────────────────────────────────────────────────
function UserAvatar({ name, avatarUrl, size = 9 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`w-${size} h-${size} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-brand-gradient flex items-center justify-center shrink-0`}>
      <span className="text-xs font-semibold text-white font-display leading-none">{initials}</span>
    </div>
  )
}

// ── TopBar ─────────────────────────────────────────────────────
export function TopBar({
  breadcrumbs = [{ label: "Dashboard" }],
  hasNotifications = false,
}: TopBarProps) {
  const { user, logout } = useAuth()
  const { openMobile } = useSidebar()
  const router = useRouter()

  const displayName = user ? `${user.first_name} ${user.last_name}` : ""

  return (
    <header
      className="h-16 shrink-0 sticky top-0 z-40 flex items-center gap-3 px-4 md:px-6 border-b border-border-light topbar-glass"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={openMobile}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-[10px] text-ink-secondary hover:bg-surface-secondary transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" strokeWidth={1.75} />
      </button>

      {/* LEFT — Test Version dropdown + Breadcrumb */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Test Version dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-600 text-[11px] font-semibold hover:bg-primary-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <FlaskConical className="w-3 h-3" strokeWidth={2} />
              <span className="hidden sm:inline">Test Version</span>
              <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-40">
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => router.push("/dashboard/demo")}
            >
              <LayoutDashboard className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => router.push("/dashboard/demo/report")}
            >
              <BarChart3 className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
              Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Breadcrumb items={breadcrumbs} />
      </div>

      {/* CENTER — Search (hidden on mobile) */}
      <div className="hidden md:flex items-center relative w-full max-w-[320px]">
        <Search
          className="absolute left-3 w-4 h-4 text-ink-tertiary pointer-events-none"
          strokeWidth={1.75}
        />
        <input
          type="text"
          placeholder="Search assessments, students..."
          readOnly
          className={cn(
            "w-full h-9 pl-9 pr-4 text-sm",
            "bg-surface-secondary rounded-full border border-border-light",
            "text-ink-secondary placeholder:text-ink-tertiary",
            "cursor-default focus:outline-none",
            "transition-colors duration-[150ms]"
          )}
        />
      </div>

      {/* RIGHT — Notification + User */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notification bell */}
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-[10px] text-ink-secondary hover:bg-surface-secondary hover:text-ink-primary transition-colors duration-[150ms]"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" strokeWidth={1.75} />
          {hasNotifications && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500" />
          )}
        </button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-surface-secondary transition-colors duration-[150ms] outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <UserAvatar name={displayName || "U"} avatarUrl={user?.avatar_url} />
              <span className="hidden sm:block text-sm font-medium text-ink-primary leading-none max-w-[120px] truncate">
                {user?.first_name ?? ""}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-52">
            {/* User info header */}
            <div className="px-3 py-2.5 border-b border-border-light mb-1">
              <p className="text-[13px] font-semibold font-display text-ink-primary truncate">
                {displayName}
              </p>
              <p className="text-[11px] font-body text-ink-tertiary truncate mt-0.5">
                {user?.email ?? ""}
              </p>
            </div>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => router.push("/dashboard/settings")}
            >
              <Settings className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <HelpCircle className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
              Help
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-danger-500 focus:text-danger-500 focus:bg-danger-50"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
