"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await login(email, password)
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-body flex items-center justify-center p-4 relative">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/60 via-transparent to-accent-50/40 pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-[420px] bg-white rounded-[20px] shadow-xl p-8 space-y-6">

        {/* Brand */}
        <div className="text-center space-y-1">
          <h1 className="font-display font-bold text-[36px] leading-none bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent tracking-tight">
            SURIE
          </h1>
          <p className="font-body text-[11px] text-ink-tertiary tracking-wide">
            Teaching Smarter, Learning Better.
          </p>
        </div>

        {/* Heading */}
        <div>
          <h2 className="font-display font-semibold text-xl text-ink-primary">Welcome back</h2>
          <p className="font-body text-sm text-ink-secondary mt-0.5">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-[13px] text-danger-500 bg-[#FFEBEE] rounded-[10px] px-4 py-3 font-body">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu.ph"
              required
              className="w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-[42px] px-[14px] pr-11 text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm font-body text-ink-tertiary">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Register your school
          </Link>
        </p>
      </div>
    </div>
  )
}
