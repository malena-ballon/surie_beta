"use client"

import React from "react"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Sidebar } from "@/components/layout/sidebar"
import { TopBar } from "@/components/layout/topbar"

/**
 * DashboardShell — client wrapper that owns sidebar collapse state.
 * The layout.tsx (server component) renders this so Next.js can still
 * stream the page content as a server component.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-surface-body">
        {/* Sidebar — shrinks/grows via internal CSS transition */}
        <Sidebar />

        {/* Main area — takes up the remaining flex space automatically */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />

          <main className="flex-1 overflow-y-auto bg-surface-body">
            <div className="max-w-[1280px] mx-auto px-6 py-5">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
