"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  GraduationCap,
  FilePlus,
  Library,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/layout/sidebar-context"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ── Nav item definition ────────────────────────────────────────
interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",               icon: LayoutDashboard },
  { label: "My Classes",   href: "/dashboard/classes",       icon: GraduationCap  },
]

const NAV_ITEMS_2: NavItem[] = [
  { label: "Create Exam",  href: "/dashboard/exams/create",  icon: FilePlus       },
  { label: "Exam Library", href: "/dashboard/exams",         icon: Library        },
]

const NAV_ITEMS_3: NavItem[] = [
  { label: "Reports",      href: "/dashboard/reports",       icon: BarChart3      },
]

// ── Single nav item ────────────────────────────────────────────
function NavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem
  collapsed: boolean
  isActive: boolean
}) {
  const Icon = item.icon

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        // Base
        "flex items-center gap-3 rounded-[10px] mx-3 my-0.5",
        "transition-all duration-[150ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "border-l-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
        // Collapsed: centered icon only
        collapsed ? "justify-center px-0 py-2.5 w-12 mx-auto" : "px-4 py-2.5",
        // Active vs inactive
        isActive
          ? "border-primary-500 bg-brand-gradient-subtle text-primary-600"
          : "border-transparent text-ink-secondary hover:bg-surface-secondary hover:text-ink-primary"
      )}
    >
      <Icon
        className={cn(
          "shrink-0 w-5 h-5",
          isActive ? "text-primary-500" : "text-ink-tertiary group-hover:text-ink-primary"
        )}
        strokeWidth={1.75}
      />
      {!collapsed && (
        <span className="text-sm font-medium leading-none">{item.label}</span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

// ── Separator ──────────────────────────────────────────────────
function NavSeparator({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "my-2 h-px bg-border-light",
        collapsed ? "mx-4" : "mx-5"
      )}
    />
  )
}

// ── Sidebar ────────────────────────────────────────────────────
export function Sidebar() {
  const { collapsed, toggle } = useSidebar()
  const pathname = usePathname()

  // Match active: exact for /dashboard, prefix for nested
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-white border-r border-border-light",
          "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "shrink-0 overflow-hidden",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {/* ── Logo ── */}
        <div
          className={cn(
            "flex items-center h-16 shrink-0 border-b border-border-light",
            collapsed ? "justify-center px-0" : "px-4"
          )}
        >
          {!collapsed && (
            <div className="flex flex-col gap-0.5">
              <span className="font-display font-bold text-[22px] leading-none bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent tracking-tight">
                SURIE
              </span>
              <span className="font-body text-[11px] leading-none text-ink-tertiary tracking-wide">
                Teaching Smarter, Learning Better.
              </span>
            </div>
          )}
        </div>

        {/* ── Main nav ── */}
        <nav className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden py-3">
          {/* Group 1 */}
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
            />
          ))}

          <NavSeparator collapsed={collapsed} />

          {/* Group 2 */}
          {NAV_ITEMS_2.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
            />
          ))}

          <NavSeparator collapsed={collapsed} />

          {/* Group 3 */}
          {NAV_ITEMS_3.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
            />
          ))}

          {/* Push Settings + toggle to bottom */}
          <div className="flex-1" />

          <NavSeparator collapsed={collapsed} />

          {/* Settings */}
          <NavLink
            item={{ label: "Settings", href: "/dashboard/settings", icon: Settings }}
            collapsed={collapsed}
            isActive={isActive("/dashboard/settings")}
          />

          {/* Collapse toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] mx-3 my-0.5 py-2.5",
                  "border-l-[3px] border-transparent",
                  "text-ink-tertiary hover:bg-surface-secondary hover:text-ink-primary",
                  "transition-colors duration-[150ms]",
                  "w-[calc(100%-24px)]",
                  collapsed ? "justify-center px-0 w-12 mx-auto" : "px-4"
                )}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronsRight className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                ) : (
                  <>
                    <ChevronsLeft className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                    <span className="text-sm font-medium leading-none">Collapse</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" sideOffset={8}>
                Expand sidebar
              </TooltipContent>
            )}
          </Tooltip>

          <div className="pb-2" />
        </nav>
      </aside>
    </TooltipProvider>
  )
}
