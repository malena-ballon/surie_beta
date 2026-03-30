"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { register as apiRegister } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Password strength ──────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw)]
  const score = checks.filter(Boolean).length
  if (score <= 1) return { score, label: "Weak", color: "#DC3545" }
  if (score <= 3) return { score, label: "Medium", color: "#F5A623" }
  return { score, label: "Strong", color: "#2D8A4E" }
}

// ── Progress indicator ─────────────────────────────────────────
const STEPS = ["School Info", "Your Account", "Confirm"]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = current > n
        const active = current === n
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold relative transition-all duration-300",
                  done
                    ? "bg-gradient-to-br from-primary-500 to-accent-500 text-white"
                    : active
                      ? "border-2 border-primary-500 text-primary-500"
                      : "border-2 border-border-default text-ink-tertiary"
                )}
              >
                {done ? <Check className="w-4 h-4" /> : n}
                {active && (
                  <span className="absolute inset-0 rounded-full border-2 border-primary-500 animate-ping opacity-30" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium font-body whitespace-nowrap",
                  active ? "text-primary-500" : done ? "text-ink-secondary" : "text-ink-tertiary"
                )}
              >
                {label}
              </span>
            </div>
            {i < 2 && (
              <div
                className={cn(
                  "h-[2px] w-14 mx-2 mb-5 transition-colors duration-300",
                  current > n ? "bg-primary-500" : "bg-border-light"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Input helper ───────────────────────────────────────────────
const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

// ── Main component ─────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    institutionName: "",
    institutionType: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const strength = getStrength(form.password)

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 2 && form.password !== form.confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setError("")
    setStep((s) => s + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await apiRegister({
        institution_name: form.institutionName,
        institution_type: form.institutionType,
        email: form.email,
        password: form.password,
        first_name: form.firstName,
        last_name: form.lastName,
      })
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const INSTITUTION_TYPE_LABELS: Record<string, string> = {
    private: "Private School",
    public: "Public School",
    review_center: "Review Center",
  }

  return (
    <div className="min-h-screen bg-body flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/60 via-transparent to-accent-50/40 pointer-events-none" />

      <div className="relative w-full max-w-[480px] bg-white rounded-[20px] shadow-xl p-8">
        {/* Brand */}
        <div className="text-center space-y-1 mb-6">
          <h1 className="font-display font-bold text-[36px] leading-none bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent tracking-tight">
            SURIE
          </h1>
          <p className="font-body text-[11px] text-ink-tertiary tracking-wide">
            Teaching Smarter, Learning Better.
          </p>
        </div>

        <StepIndicator current={step} />

        {error && (
          <div className="text-[13px] text-danger-500 bg-[#FFEBEE] rounded-[10px] px-4 py-3 font-body mb-4">
            {error}
          </div>
        )}

        {/* ── Step 1: School Info ── */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-ink-primary">School Information</h2>
              <p className="font-body text-sm text-ink-secondary mt-0.5">Tell us about your institution</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Institution Name</label>
              <input
                type="text"
                value={form.institutionName}
                onChange={set("institutionName")}
                placeholder="e.g. Ateneo de Manila University"
                required
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Institution Type</label>
              <select
                value={form.institutionType}
                onChange={set("institutionType")}
                required
                className={cn(inputCls, "cursor-pointer")}
              >
                <option value="" disabled>Select type…</option>
                <option value="private">Private School</option>
                <option value="public">Public School</option>
                <option value="review_center">Review Center</option>
              </select>
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full mt-2">
              Continue
            </Button>
          </form>
        )}

        {/* ── Step 2: Admin Account ── */}
        {step === 2 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-ink-primary">Your Account</h2>
              <p className="font-body text-sm text-ink-secondary mt-0.5">You'll be the school admin</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-ink-secondary font-body">First Name</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={set("firstName")}
                  placeholder="Maria"
                  required
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-ink-secondary font-body">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={set("lastName")}
                  placeholder="Santos"
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="admin@school.edu.ph"
                required
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Password</label>
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
              <label className="text-[13px] font-medium text-ink-secondary font-body">Confirm Password</label>
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
                className="flex-1"
                onClick={() => { setError(""); setStep(1) }}
              >
                Back
              </Button>
              <Button type="submit" variant="gradient" size="lg" className="flex-1">
                Continue
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-ink-primary">Review & Confirm</h2>
              <p className="font-body text-sm text-ink-secondary mt-0.5">Everything look right?</p>
            </div>

            <div className="bg-surface-secondary rounded-[14px] p-4 space-y-3 border border-border-light">
              <Row label="Institution" value={form.institutionName} />
              <Row label="Type" value={INSTITUTION_TYPE_LABELS[form.institutionType] ?? form.institutionType} />
              <div className="h-px bg-border-light" />
              <Row label="Name" value={`${form.firstName} ${form.lastName}`} />
              <Row label="Email" value={form.email} />
              <Row label="Role" value="Admin" />
            </div>

            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => { setError(""); setStep(2) }}
              >
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

        {step === 1 && (
          <p className="text-center text-sm font-body text-ink-tertiary mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] font-body text-ink-tertiary">{label}</span>
      <span className="text-[13px] font-medium font-body text-ink-primary">{value}</span>
    </div>
  )
}
