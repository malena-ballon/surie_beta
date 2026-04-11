"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────

const MASTERY_COLORS = {
  critical: { bg: "#FFEBEE", text: "#C62828", bar: "#EF5350" },
  remedial:  { bg: "#FFF3E0", text: "#E65100", bar: "#FFA726" },
  average:   { bg: "#FFF8E1", text: "#F57F17", bar: "#FFCA28" },
  good:      { bg: "#E8F5E9", text: "#2E7D32", bar: "#66BB6A" },
  mastered:  { bg: "#E3F2FD", text: "#1565C0", bar: "#42A5F5" },
}

function masteryLevel(pct: number) {
  if (pct < 40) return "critical" as const
  if (pct < 60) return "remedial" as const
  if (pct < 75) return "average" as const
  if (pct < 90) return "good" as const
  return "mastered" as const
}

function MasteryPill({ pct }: { pct: number }) {
  const level = masteryLevel(pct)
  const c = MASTERY_COLORS[level]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-body capitalize"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {pct}% · {level}
    </span>
  )
}

function MasteryBar({ pct }: { pct: number }) {
  const level = masteryLevel(pct)
  const c = MASTERY_COLORS[level]
  return (
    <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden w-24">
      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: c.bar }} />
    </div>
  )
}

const inputCls =
  "h-[38px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

function FilterSelect({ value, onChange, children, placeholder }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[38px] pl-3 pr-8 text-sm font-body text-ink-primary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
    </div>
  )
}

// ── Hardcoded demo data ────────────────────────────────────────

const DEMO_CLASSES = [
  { id: "1", name: "Grade 9 — Rizal" },
  { id: "2", name: "Grade 9 — Bonifacio" },
  { id: "3", name: "Grade 10 — Luna" },
]

interface DemoReport {
  id: string
  title: string
  class_name: string
  class_id: string
  subject: string
  date: string
  difficulty: string
  avg_score: number
  mastery_rate: number
  student_count: number
  type: "regular" | "reassessment"
}

const DEMO_REPORTS: DemoReport[] = [
  {
    id: "r1",
    title: "Algebra Equations",
    class_name: "Grade 10 — Luna",
    class_id: "3",
    subject: "Math",
    date: "2025-02-22T08:00:00Z",
    difficulty: "medium",
    avg_score: 91,
    mastery_rate: 88,
    student_count: 35,
    type: "regular",
  },
  {
    id: "r2",
    title: "Fractions & Decimals",
    class_name: "Grade 9 — Rizal",
    class_id: "1",
    subject: "Math",
    date: "2025-03-12T08:00:00Z",
    difficulty: "easy",
    avg_score: 81,
    mastery_rate: 71,
    student_count: 28,
    type: "regular",
  },
  {
    id: "r3",
    title: "Reading Comprehension Quiz",
    class_name: "Grade 9 — Bonifacio",
    class_id: "2",
    subject: "English",
    date: "2025-03-08T08:00:00Z",
    difficulty: "medium",
    avg_score: 76,
    mastery_rate: 63,
    student_count: 25,
    type: "regular",
  },
  {
    id: "r4",
    title: "Chemical Reactions Lab Exam",
    class_name: "Grade 10 — Luna",
    class_id: "3",
    subject: "Science",
    date: "2025-03-05T08:00:00Z",
    difficulty: "hard",
    avg_score: 68,
    mastery_rate: 58,
    student_count: 32,
    type: "regular",
  },
  {
    id: "r5",
    title: "Philippine History Unit Test",
    class_name: "Grade 9 — Rizal",
    class_id: "1",
    subject: "Araling Panlipunan",
    date: "2025-02-20T08:00:00Z",
    difficulty: "medium",
    avg_score: 73,
    mastery_rate: 66,
    student_count: 29,
    type: "regular",
  },
  {
    id: "r6",
    title: "Parts of Speech Review",
    class_name: "Grade 9 — Bonifacio",
    class_id: "2",
    subject: "English",
    date: "2025-02-15T08:00:00Z",
    difficulty: "easy",
    avg_score: 85,
    mastery_rate: 82,
    student_count: 30,
    type: "regular",
  },
  {
    id: "r7",
    title: "Re-assessment: Chemical Reactions",
    class_name: "Grade 10 — Luna",
    class_id: "3",
    subject: "Science",
    date: "2025-03-20T08:00:00Z",
    difficulty: "medium",
    avg_score: 79,
    mastery_rate: 74,
    student_count: 30,
    type: "reassessment",
  },
]

// ── Report row ─────────────────────────────────────────────────

function DemoReportRow({ report, onClick }: { report: DemoReport; onClick?: () => void }) {
  const dateStr = new Date(report.date).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  })

  return (
    <div onClick={onClick} className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-card-hover transition-shadow duration-[250ms] cursor-pointer">
      <div className="w-11 h-11 rounded-[12px] bg-primary-50 flex items-center justify-center shrink-0">
        <BarChart3 className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-[15px] text-ink-primary leading-tight truncate">
          {report.title}
        </h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[12px] font-body text-ink-secondary">{report.class_name}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-body bg-primary-50 text-primary-600">
            {report.subject}
          </span>
          <span className="text-[12px] font-body text-ink-tertiary">{dateStr}</span>
          <span className="text-[12px] font-body text-ink-tertiary capitalize">{report.difficulty}</span>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <div className="text-center">
          <p className="font-display font-bold text-xl text-ink-primary">{report.avg_score}%</p>
          <p className="text-[11px] font-body text-ink-tertiary">avg score</p>
        </div>
        <div className="text-center">
          <div className="flex flex-col items-center gap-1">
            <MasteryPill pct={report.mastery_rate} />
            <MasteryBar pct={report.mastery_rate} />
          </div>
          <p className="text-[11px] font-body text-ink-tertiary mt-1">mastery</p>
        </div>
        <div className="text-center">
          <p className="font-display font-bold text-xl text-ink-primary">{report.student_count}</p>
          <p className="text-[11px] font-body text-ink-tertiary">students</p>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-ink-tertiary shrink-0 hidden sm:block" />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function DemoReportPage() {
  const router = useRouter()
  const [filterClass, setFilterClass] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")

  const filtered = DEMO_REPORTS.filter((r) => {
    if (filterClass && r.class_id !== filterClass) return false
    if (filterType && r.type !== filterType) return false
    if (filterFrom && new Date(r.date) < new Date(filterFrom)) return false
    if (filterTo && new Date(r.date) > new Date(filterTo + "T23:59:59")) return false
    return true
  })

  const hasFilters = filterClass || filterType || filterFrom || filterTo
  const clearFilters = () => {
    setFilterClass(""); setFilterType(""); setFilterFrom(""); setFilterTo("")
  }

  // Summary stats from all reports (not filtered)
  const avgMastery = Math.round(
    DEMO_REPORTS.reduce((s, r) => s + r.mastery_rate, 0) / DEMO_REPORTS.length
  )
  const avgScore = Math.round(
    DEMO_REPORTS.reduce((s, r) => s + r.avg_score, 0) / DEMO_REPORTS.length
  )
  const totalSubmissions = DEMO_REPORTS.reduce((s, r) => s + r.student_count, 0)

  return (
    <div className="p-4 md:p-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="font-display font-bold text-[24px] md:text-[30px] text-ink-primary leading-tight">
          Reports
        </h1>
        <p className="font-body text-sm text-ink-secondary mt-1">
          Diagnostic results across all your published assessments
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-[12px] bg-primary-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">Avg Mastery</p>
            <p className="font-display font-bold text-2xl text-ink-primary">{avgMastery}%</p>
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-[12px] bg-accent-50 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-accent-600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">Avg Score</p>
            <p className="font-display font-bold text-2xl text-ink-primary">{avgScore}%</p>
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-[12px] bg-primary-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">Submissions</p>
            <p className="font-display font-bold text-2xl text-ink-primary">{totalSubmissions}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterSelect value={filterClass} onChange={setFilterClass} placeholder="All Classes">
          {DEMO_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterType} onChange={setFilterType} placeholder="All Types">
          <option value="regular">Regular</option>
          <option value="reassessment">Reassessment</option>
        </FilterSelect>
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className={cn(inputCls, "w-[150px] cursor-pointer")}
          title="From date"
        />
        <span className="text-[12px] text-ink-tertiary font-body">–</span>
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className={cn(inputCls, "w-[150px] cursor-pointer")}
          title="To date"
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-[12px] font-body font-medium text-ink-tertiary hover:text-danger-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
        <span className="text-[12px] font-body text-ink-tertiary ml-auto">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Report list */}
      <div className="space-y-4">
        {filtered.map((r) => (
          <DemoReportRow
            key={r.id}
            report={r}
            onClick={
              r.id === "r1" ? () => router.push("/dashboard/demo/assessment") :
              r.id === "r4" ? () => router.push("/dashboard/demo/chemistry") :
              undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
