"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Loader2, ArrowLeft } from "lucide-react"
import { registerStudent } from "@/lib/auth"
import { useAuth } from "@/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

function getStrength(pw: string): { score: number; label: string; color: string } {
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw)]
  const score = checks.filter(Boolean).length
  if (score <= 1) return { score, label: "Weak", color: "#DC3545" }
  if (score <= 3) return { score, label: "Medium", color: "#F5A623" }
  return { score, label: "Strong", color: "#2D8A4E" }
}

export default function StudentRegisterPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    joinCode: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const strength = getStrength(form.password)

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.joinCode.trim().length < 4) {
      setError("Please enter a valid join code")
      return
    }
    setError("")
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setError("")
    setIsLoading(true)
    try {
      await registerStudent({
        join_code: form.joinCode.trim().toUpperCase(),
        email: form.email,
        password: form.password,
        first_name: form.firstName,
        last_name: form.lastName,
      })
      // Sync auth context then navigate
      await login(form.email, form.password)
      router.replace("/student")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-body flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/60 via-transparent to-accent-50/40 pointer-events-none" />

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

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-body transition-all duration-200",
                  step > n
                    ? "bg-gradient-to-br from-primary-500 to-accent-500 text-white"
                    : step === n
                      ? "border-2 border-primary-500 text-primary-500"
                      : "border-2 border-border-default text-ink-tertiary"
                )}
              >
                {step > n ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span
                className={cn(
                  "text-[11px] font-body",
                  step === n ? "text-primary-500 font-medium" : "text-ink-tertiary"
                )}
              >
                {n === 1 ? "Join Code" : "Your Account"}
              </span>
              {n < 2 && <div className="w-8 h-[2px] bg-border-light mx-1" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-[13px] text-danger-500 bg-[#FFEBEE] rounded-[10px] px-4 py-3 font-body">
            {error}
          </div>
        )}

        {/* ── Step 1: Join Code ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold text-xl text-ink-primary">Join your class</h2>
              <p className="font-body text-sm text-ink-secondary mt-0.5">
                Enter the 6-character code your teacher shared with you
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">
                Class Join Code <span className="text-danger-500">*</span>
              </label>
              <input
                value={form.joinCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, joinCode: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. ABC123"
                maxLength={8}
                required
                className={cn(
                  inputCls,
                  "text-center font-mono tracking-[0.25em] text-lg uppercase font-semibold"
                )}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full mt-2">
              Continue
            </Button>
          </form>
        )}

        {/* ── Step 2: Account details ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold text-xl text-ink-primary">Create your account</h2>
              <p className="font-body text-sm text-ink-secondary mt-0.5">
                Joining with code{" "}
                <span className="font-mono font-semibold text-primary-500 tracking-wider">
                  {form.joinCode}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-ink-secondary font-body">
                  First Name <span className="text-danger-500">*</span>
                </label>
                <input
                  value={form.firstName}
                  onChange={set("firstName")}
                  placeholder="Maria"
                  required
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-ink-secondary font-body">
                  Last Name <span className="text-danger-500">*</span>
                </label>
                <input
                  value={form.lastName}
                  onChange={set("lastName")}
                  placeholder="Santos"
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">
                Email <span className="text-danger-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@school.edu.ph"
                required
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">
                Password <span className="text-danger-500">*</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                required
                className={inputCls}
              />
              {form.password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ backgroundColor: strength.score >= i ? strength.color : "#E8E6E1" }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] font-body" style={{ color: strength.color }}>
                    {strength.label} password
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">
                Confirm Password <span className="text-danger-500">*</span>
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="••••••••"
                required
                className={cn(
                  inputCls,
                  form.confirmPassword && form.confirmPassword !== form.password
                    ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20"
                    : ""
                )}
              />
            </div>

            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="gap-1.5"
                onClick={() => { setError(""); setStep(1) }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </div>
          </form>
        )}

        <p className="text-center text-sm font-body text-ink-tertiary">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
