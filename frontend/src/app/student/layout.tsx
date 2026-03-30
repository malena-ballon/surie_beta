"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { StudentTopBar } from "@/components/layout/student-topbar"

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }
    if (user && user.role !== "student") {
      router.replace("/dashboard")
    }
  }, [isAuthenticated, isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || (user && user.role !== "student")) return null

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      <StudentTopBar userName={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
