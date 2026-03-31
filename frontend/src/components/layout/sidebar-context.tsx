"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      if (w >= 768 && w < 1024) {
        // Tablet: auto-collapse
        setCollapsed(true)
      } else if (w >= 1024) {
        // Desktop: restore user preference
        const stored = localStorage.getItem("surie-sidebar-collapsed")
        setCollapsed(stored ? (JSON.parse(stored) as boolean) : false)
      }
      // Close mobile overlay when resizing to tablet/desktop
      if (w >= 768) setMobileOpen(false)
    }

    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (typeof window !== "undefined" && window.innerWidth >= 1024) {
        localStorage.setItem("surie-sidebar-collapsed", JSON.stringify(next))
      }
      return next
    })
  }

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        mobileOpen,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
