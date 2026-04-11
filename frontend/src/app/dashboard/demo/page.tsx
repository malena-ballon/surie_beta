"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  Target,
  FileText,
  Clock,
  Plus,
  ChevronRight,
  BookOpen,
  UserX,
  TrendingDown,
} from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { DataCard } from "@/components/ui/data-card"
import { MasteryBadge, StatusBadge } from "@/components/ui/mastery-badge"
import { PerformanceChart } from "@/app/dashboard/_components/performance-chart"
import type { ClassPerformanceTrend } from "@/lib/api"

// ── Helpers ────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return "text-success-500"
  if (score >= 75) return "text-primary-500"
  if (score >= 60) return "text-warning-600"
  return "text-danger-500"
}

function masteryColor(pct: number) {
  if (pct < 40) return "text-danger-500"
  if (pct < 60) return "text-warning-600"
  if (pct < 75) return "text-warning-500"
  if (pct < 90) return "text-primary-500"
  return "text-success-500"
}

function masteryLevel(pct: number): "critical" | "remedial" | "average" | "good" | "mastered" {
  if (pct < 40) return "critical"
  if (pct < 60) return "remedial"
  if (pct < 75) return "average"
  if (pct < 90) return "good"
  return "mastered"
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

const BORDER_COLOR: Record<string, string> = {
  critical: "#EF5350",
  remedial: "#FFA726",
  average:  "#FFCA28",
  good:     "#66BB6A",
  mastered: "#42A5F5",
}

// ── Hardcoded demo data ────────────────────────────────────────

const DEMO_CLASSES = [
  { id: "1", name: "Grade 9", section: "Rizal" },
  { id: "2", name: "Grade 9", section: "Bonifacio" },
  { id: "3", name: "Grade 10", section: "Luna" },
]

const DEMO_RECENT_ASSESSMENTS = [
  {
    id: "a1",
    title: "Fractions & Decimals",
    class_name: "Grade 9 — Rizal",
    subject: "Math",
    grade_level: "Grade 9",
    status: "published" as const,
    difficulty: "easy" as const,
    question_count: 30,
    created_at: "2025-03-12T08:00:00Z",
    avg_score: 81,
    submitted_count: 28,
    total_enrolled: 30,
  },
  {
    id: "a2",
    title: "Reading Comprehension Quiz",
    class_name: "Grade 9 — Bonifacio",
    subject: "English",
    grade_level: "Grade 9",
    status: "published" as const,
    difficulty: "medium" as const,
    question_count: 25,
    created_at: "2025-03-08T08:00:00Z",
    avg_score: 76,
    submitted_count: 25,
    total_enrolled: 30,
  },
  {
    id: "a3",
    title: "Chemical Reactions Lab Exam",
    class_name: "Grade 10 — Luna",
    subject: "Science",
    grade_level: "Grade 10",
    status: "published" as const,
    difficulty: "hard" as const,
    question_count: 40,
    created_at: "2025-03-05T08:00:00Z",
    avg_score: 68,
    submitted_count: 32,
    total_enrolled: 35,
  },
  {
    id: "a4",
    title: "Philippine History Unit Test",
    class_name: "Grade 9 — Rizal",
    subject: "Araling Panlipunan",
    grade_level: "Grade 9",
    status: "draft" as const,
    difficulty: "medium" as const,
    question_count: 35,
    created_at: "2025-02-28T08:00:00Z",
    avg_score: null,
    submitted_count: 0,
    total_enrolled: 30,
  },
  {
    id: "a5",
    title: "Algebra Equations",
    class_name: "Grade 10 — Luna",
    subject: "Math",
    grade_level: "Grade 10",
    status: "closed" as const,
    difficulty: "medium" as const,
    question_count: 30,
    created_at: "2025-02-22T08:00:00Z",
    avg_score: 91,
    submitted_count: 35,
    total_enrolled: 35,
  },
]

const DEMO_RETEACH = [
  { id: "a3", title: "Chemical Reactions Lab Exam", class_name: "Grade 10 — Luna", mastery_rate: 58 },
  { id: "a2", title: "Reading Comprehension Quiz", class_name: "Grade 9 — Bonifacio", mastery_rate: 63 },
  { id: "a1", title: "Fractions & Decimals", class_name: "Grade 9 — Rizal", mastery_rate: 71 },
]

const DEMO_AT_RISK = [
  { student_id: "s1", name: "Maria Santos",   section: "Grade 9 — Rizal",      mastery_pct: 32, status: "critical" as const },
  { student_id: "s2", name: "Juan dela Cruz", section: "Grade 10 — Luna",       mastery_pct: 38, status: "critical" as const },
  { student_id: "s3", name: "Ana Reyes",      section: "Grade 9 — Bonifacio",  mastery_pct: 41, status: "remedial" as const },
  { student_id: "s4", name: "Carlos Mendoza", section: "Grade 10 — Luna",       mastery_pct: 44, status: "remedial" as const },
  { student_id: "s5", name: "Liza Garcia",   section: "Grade 9 — Rizal",       mastery_pct: 47, status: "remedial" as const },
  { student_id: "s6", name: "Miguel Torres", section: "Grade 9 — Bonifacio",   mastery_pct: 51, status: "remedial" as const },
]

const DEMO_TREND: ClassPerformanceTrend[] = [
  {
    class_id: "1",
    class_name: "Grade 9 — Rizal",
    data: [
      { date: "2024-10-01", label: "Oct", mastery: 62, title: "Q1 Exam", assessment_id: "t1a" },
      { date: "2024-11-01", label: "Nov", mastery: 65, title: "Q1 Long Test", assessment_id: "t1b" },
      { date: "2024-12-01", label: "Dec", mastery: 68, title: "Q2 Midterms", assessment_id: "t1c" },
      { date: "2025-01-01", label: "Jan", mastery: 71, title: "Q3 Quiz", assessment_id: "t1d" },
      { date: "2025-02-01", label: "Feb", mastery: 73, title: "Q3 Exam", assessment_id: "t1e" },
      { date: "2025-03-01", label: "Mar", mastery: 74, title: "Q4 Quiz", assessment_id: "t1f" },
    ],
  },
  {
    class_id: "2",
    class_name: "Grade 9 — Bonifacio",
    data: [
      { date: "2024-10-01", label: "Oct", mastery: 58, title: "Q1 Exam", assessment_id: "t2a" },
      { date: "2024-11-01", label: "Nov", mastery: 61, title: "Q1 Long Test", assessment_id: "t2b" },
      { date: "2024-12-01", label: "Dec", mastery: 64, title: "Q2 Midterms", assessment_id: "t2c" },
      { date: "2025-01-01", label: "Jan", mastery: 67, title: "Q3 Quiz", assessment_id: "t2d" },
      { date: "2025-02-01", label: "Feb", mastery: 69, title: "Q3 Exam", assessment_id: "t2e" },
      { date: "2025-03-01", label: "Mar", mastery: 72, title: "Q4 Quiz", assessment_id: "t2f" },
    ],
  },
  {
    class_id: "3",
    class_name: "Grade 10 — Luna",
    data: [
      { date: "2024-10-01", label: "Oct", mastery: 70, title: "Q1 Exam", assessment_id: "t3a" },
      { date: "2024-11-01", label: "Nov", mastery: 72, title: "Q1 Long Test", assessment_id: "t3b" },
      { date: "2024-12-01", label: "Dec", mastery: 74, title: "Q2 Midterms", assessment_id: "t3c" },
      { date: "2025-01-01", label: "Jan", mastery: 76, title: "Q3 Quiz", assessment_id: "t3d" },
      { date: "2025-02-01", label: "Feb", mastery: 78, title: "Q3 Exam", assessment_id: "t3e" },
      { date: "2025-03-01", label: "Mar", mastery: 80, title: "Q4 Quiz", assessment_id: "t3f" },
    ],
  },
]

// ── Page ───────────────────────────────────────────────────────

export default function DemoDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [classId, setClassId] = useState("")

  const todayStr = new Date().toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  })

  return (
    <div className="space-y-6">

      {/* ── 1. Welcome header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[1.875rem] font-bold text-ink-primary leading-tight">
            {greeting()}{user ? `, ${user.first_name}!` : "!"}
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">{todayStr}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-1 flex-wrap">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 py-0 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-[160px]"
          >
            <option value="">All Sections</option>
            {DEMO_CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` — ${c.section}` : ""}
              </option>
            ))}
          </select>
          <Button variant="gradient" size="default">
            <Plus className="w-4 h-4" />
            Create Exam
          </Button>
        </div>
      </div>

      {/* ── 2. Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 card-grid">
        <StatCard
          icon={Users}
          iconColor="text-primary-500"
          iconBg="bg-primary-50"
          label="Total Students"
          value="87"
        />
        <StatCard
          icon={Target}
          iconColor="text-accent-600"
          iconBg="bg-accent-50"
          label="Avg. Mastery Rate"
          value="74%"
        />
        <StatCard
          icon={FileText}
          iconColor="text-primary-500"
          iconBg="bg-primary-50"
          label="Total Exams"
          value="14"
          subtitle="3 active classes"
        />
        <StatCard
          icon={Clock}
          iconColor="text-warning-600"
          iconBg="bg-warning-50"
          label="Pending Review"
          value="5"
          subtitle="submissions"
        />
      </div>

      {/* ── 3. Action Items ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 card-grid">
        <button className="flex items-center gap-4 rounded-[14px] border border-border-light bg-surface-primary px-4 py-4 text-left hover:shadow-md transition-shadow">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-50">
            <Clock className="w-5 h-5 text-warning-600" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.375rem] font-bold text-ink-primary leading-none">5</p>
            <p className="mt-0.5 text-xs text-ink-secondary">submissions pending review</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-tertiary ml-auto shrink-0" />
        </button>

        <button className="flex items-center gap-4 rounded-[14px] border border-border-light bg-surface-primary px-4 py-4 text-left hover:shadow-md transition-shadow">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
            <BookOpen className="w-5 h-5 text-primary-500" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.375rem] font-bold text-ink-primary leading-none">2</p>
            <p className="mt-0.5 text-xs text-ink-secondary">draft exams to publish</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-tertiary ml-auto shrink-0" />
        </button>

        <button
          onClick={() => router.push("/dashboard/demo/report")}
          className="flex items-center gap-4 rounded-[14px] border border-border-light bg-surface-primary px-4 py-4 text-left hover:shadow-md transition-shadow"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50">
            <UserX className="w-5 h-5 text-danger-500" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.375rem] font-bold text-ink-primary leading-none">8</p>
            <p className="mt-0.5 text-xs text-ink-secondary">students below mastery threshold</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-tertiary ml-auto shrink-0" />
        </button>
      </div>

      {/* ── 4. Recent Assessments + Topics to Reteach ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 card-grid">

        <DataCard
          title="Recent Assessments"
          action={{ label: "View All", onClick: () => {} }}
          className="lg:col-span-2"
        >
          <div className="divide-y divide-border-light -mt-1">
            {DEMO_RECENT_ASSESSMENTS.map((item) => (
              <DemoAssessmentRow key={item.id} item={item} />
            ))}
          </div>
        </DataCard>

        <DataCard
          title="Topics to Reteach"
          action={{ label: "View Reports", onClick: () => router.push("/dashboard/demo/report") }}
        >
          <div className="space-y-3">
            {DEMO_RETEACH.map((item) => {
              const level = masteryLevel(item.mastery_rate)
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border-light p-3 cursor-pointer hover:shadow-sm transition-shadow"
                  style={{ borderLeftWidth: "3px", borderLeftColor: BORDER_COLOR[level] }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-primary leading-snug truncate">
                      {item.title}
                    </span>
                    <MasteryBadge status={level} size="sm" showIcon={false} />
                  </div>
                  <p className="text-xs text-ink-tertiary mt-0.5">{item.class_name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-ink-secondary">{item.mastery_rate}% mastery rate</p>
                    <ChevronRight className="w-3 h-3 text-ink-tertiary" />
                  </div>
                </div>
              )
            })}
          </div>
        </DataCard>
      </div>

      {/* ── 5. Students Needing Attention + Performance Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 card-grid">

        <DataCard
          title="Students Needing Attention"
          action={{ label: "View All", onClick: () => router.push("/dashboard/demo/report") }}
        >
          <div className="space-y-2">
            {DEMO_AT_RISK.map((s) => (
              <div
                key={s.student_id}
                className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-primary truncate">{s.name}</p>
                  <p className="text-xs text-ink-tertiary truncate">{s.section}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <TrendingDown className="w-3.5 h-3.5 text-danger-500" />
                  <span className={`text-sm font-bold ${masteryColor(s.mastery_pct)}`}>
                    {s.mastery_pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard
          title="Class Performance Trend"
          subtitle="Mastery rate over time"
          className="lg:col-span-2"
        >
          <PerformanceChart trend={DEMO_TREND} />
        </DataCard>
      </div>

    </div>
  )
}

// ── Assessment row ─────────────────────────────────────────────

function DemoAssessmentRow({ item }: {
  item: typeof DEMO_RECENT_ASSESSMENTS[number]
}) {
  const completionText =
    item.total_enrolled > 0
      ? `${item.submitted_count}/${item.total_enrolled} submitted`
      : null

  const quickAction =
    item.status === "draft"
      ? { label: "Publish", color: "text-primary-500 bg-primary-50 hover:bg-primary-100" }
      : item.status === "published" && item.submitted_count > 0
      ? { label: "Review", color: "text-warning-600 bg-warning-50 hover:bg-warning-100" }
      : null

  const dateStr = new Date(item.created_at).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  })

  return (
    <div className="py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-surface-secondary -mx-1 px-1 rounded transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink-primary truncate max-w-[220px]">
              {item.title}
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-secondary text-ink-secondary shrink-0">
              {item.subject}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-ink-secondary">{item.class_name}</span>
            <span className="text-ink-tertiary text-xs">·</span>
            <span className="text-xs text-ink-tertiary">{dateStr}</span>
            {completionText && (
              <>
                <span className="text-ink-tertiary text-xs">·</span>
                <span className="text-xs text-ink-secondary">{completionText}</span>
              </>
            )}
            {item.avg_score !== null && (
              <>
                <span className="text-ink-tertiary text-xs">·</span>
                <span className={`text-xs font-semibold ${scoreColor(item.avg_score)}`}>
                  {item.avg_score}% avg
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <StatusBadge status={item.status} size="sm" />
          {quickAction && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${quickAction.color}`}>
              {quickAction.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
