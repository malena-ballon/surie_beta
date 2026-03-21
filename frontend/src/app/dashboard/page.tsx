"use client"

import {
  Users,
  Target,
  FileText,
  AlertTriangle,
  Plus,
  ChevronRight,
} from "lucide-react"

import { Button }     from "@/components/ui/button"
import { StatCard }   from "@/components/ui/stat-card"
import { DataCard }   from "@/components/ui/data-card"
import { MasteryBadge, StatusBadge } from "@/components/ui/mastery-badge"
import { PerformanceChart } from "@/app/dashboard/_components/performance-chart"

// ── Hardcoded data ─────────────────────────────────────────────

const RECENT_ASSESSMENTS = [
  {
    id: 1,
    title: "Midterm Exam — Cell Division",
    subject: "Biology",
    section: "Grade 10 — Section A",
    date: "Mar 19, 2026",
    avgScore: 74,
    status: "graded" as const,
  },
  {
    id: 2,
    title: "Quiz 3 — Newton's Laws",
    subject: "Physics",
    section: "Grade 9 — Section B",
    date: "Mar 17, 2026",
    avgScore: 61,
    status: "graded" as const,
  },
  {
    id: 3,
    title: "Long Test — Chemical Bonding",
    subject: "Chemistry",
    section: "Grade 10 — Section A",
    date: "Mar 14, 2026",
    avgScore: 48,
    status: "completed" as const,
  },
  {
    id: 4,
    title: "Unit Test — Scientific Method",
    subject: "Science",
    section: "Grade 8 — Section C",
    date: "Mar 11, 2026",
    avgScore: 55,
    status: "graded" as const,
  },
]

const RETEACH_TOPICS = [
  {
    id: 1,
    topic: "Chemical Bonding",
    avgScore: 42,
    level: "critical" as const,
    borderColor: "#DC3545",
    note: "58% of students confused ionic vs. covalent bonds.",
  },
  {
    id: 2,
    topic: "Cell Division",
    avgScore: 48,
    level: "critical" as const,
    borderColor: "#DC3545",
    note: "Confusion between Anaphase and Telophase phases.",
  },
  {
    id: 3,
    topic: "Scientific Method",
    avgScore: 55,
    level: "remedial" as const,
    borderColor: "#F5A623",
    note: "Students skip hypothesis formulation step.",
  },
]

// ── Score color helper ─────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 90) return "text-success-500"
  if (score >= 75) return "text-primary-500"
  if (score >= 60) return "text-warning-600"
  return "text-danger-500"
}

// ── Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div className="space-y-6">

      {/* ── 1. Welcome header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.875rem] font-bold text-ink-primary leading-tight">
            Good morning, Teacher Maria!
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            March 21, 2026
          </p>
        </div>
        <Button variant="gradient" size="default" className="shrink-0 mt-1">
          <Plus className="w-4 h-4" />
          Create Exam
        </Button>
      </div>

      {/* ── 2. Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 card-grid">
        <StatCard
          icon={Users}
          iconColor="text-primary-500"
          iconBg="bg-primary-50"
          label="Total Students"
          value="142"
          trend={{ value: "+12 this month", direction: "up" }}
        />
        <StatCard
          icon={Target}
          iconColor="text-accent-600"
          iconBg="bg-accent-50"
          label="Avg. Mastery Rate"
          value="62%"
          trend={{ value: "+2.1% vs last quarter", direction: "up" }}
        />
        <StatCard
          icon={FileText}
          iconColor="text-primary-500"
          iconBg="bg-primary-50"
          label="Exams This Quarter"
          value="8"
          subtitle="2 pending review"
        />
        <StatCard
          icon={AlertTriangle}
          iconColor="text-danger-500"
          iconBg="bg-danger-50"
          label="At-Risk Students"
          value="12"
          trend={{ value: "-3 from last exam", direction: "down" }}
        />
      </div>

      {/* ── 3. Two-column: Recent Assessments + Topics to Reteach ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 card-grid">

        {/* Recent Assessments — col-span-2 */}
        <DataCard
          title="Recent Assessments"
          action={{ label: "View All", onClick: () => {} }}
          className="lg:col-span-2"
        >
          <div className="divide-y divide-border-light -mt-1">
            {RECENT_ASSESSMENTS.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                {/* Row 1: title + subject badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-primary">
                    {item.title}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-secondary text-ink-secondary">
                    {item.subject}
                  </span>
                </div>
                {/* Row 2: section, date, score, status */}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-ink-secondary">{item.section}</span>
                  <span className="text-ink-tertiary text-xs">·</span>
                  <span className="text-xs text-ink-tertiary">{item.date}</span>
                  <span className="text-ink-tertiary text-xs">·</span>
                  <span className={`text-xs font-semibold ${scoreColor(item.avgScore)}`}>
                    {item.avgScore}% avg
                  </span>
                  <StatusBadge status={item.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        {/* Topics to Reteach — col-span-1 */}
        <DataCard title="Topics to Reteach">
          <div className="space-y-3">
            {RETEACH_TOPICS.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border-light p-3"
                style={{ borderLeftWidth: "3px", borderLeftColor: item.borderColor }}
              >
                {/* Topic + score badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-primary leading-snug">
                    {item.topic}
                  </span>
                  <MasteryBadge status={item.level} size="sm" showIcon={false} />
                </div>
                {/* Average */}
                <p className="text-xs text-ink-tertiary mt-0.5">
                  {item.avgScore}% class average
                </p>
                {/* Note */}
                <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                  {item.note}
                </p>
                {/* Action */}
                <a
                  href="#"
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-500 hover:text-primary-700 mt-2 transition-colors duration-[150ms]"
                >
                  View Lesson
                  <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
                </a>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* ── 4. Performance Trend chart — full width ── */}
      <div className="card-grid">
        <DataCard title="Class Performance Trend" subtitle="Mastery rate over time">
          <PerformanceChart />
        </DataCard>
      </div>

    </div>
  )
}
