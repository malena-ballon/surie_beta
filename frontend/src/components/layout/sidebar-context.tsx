"use client"

import React, { createContext, useContext, useState } from "react"

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    const stored = localStorage.getItem("surie-sidebar-collapsed")
    return stored !== null ? (JSON.parse(stored) as boolean) : false
  })

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("surie-sidebar-collapsed", JSON.stringify(next))
      return next
    })
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
