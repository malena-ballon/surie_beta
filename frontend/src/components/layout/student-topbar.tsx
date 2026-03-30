"use client"

import { ChevronDown, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/providers/auth-provider"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function StudentTopBar({ userName }: { userName: string }) {
  const { logout } = useAuth()
  const initials = getInitials(userName || "S")

  return (
    <header
      className="h-16 shrink-0 sticky top-0 z-40 flex items-center justify-between px-6 border-b border-border-light bg-[#FAF8F5]/80"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {/* Logo */}
      <span className="font-display font-bold text-[22px] leading-none bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent tracking-tight select-none">
        SURIE
      </span>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-surface-secondary transition-colors duration-[150ms] outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-primary-600 font-display leading-none">
                {initials}
              </span>
            </div>
            <span className="hidden sm:block text-sm font-medium text-ink-primary leading-none">
              {userName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary" strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-44">
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
    </header>
  )
}
