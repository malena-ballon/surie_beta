"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  ChevronRight,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { api, type AssessmentItem, type ClassItem, type DiagnosticReport } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
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

// ── Report row ─────────────────────────────────────────────────

function ReportRow({
  assessment,
  cls,
  report,
  onClick,
}: {
  assessment: AssessmentItem
  cls?: ClassItem
  report: DiagnosticReport | null
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-card-hover transition-shadow duration-[250ms] cursor-pointer"
    >
      {/* Icon */}
      <div className="w-11 h-11 rounded-[12px] bg-primary-50 flex items-center justify-center shrink-0">
        <BarChart3 className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-[15px] text-ink-primary leading-tight truncate">
          {assessment.title}
        </h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {cls && (
            <span className="text-[12px] font-body text-ink-secondary">{cls.name}</span>
          )}
          {cls && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-body bg-primary-50 text-primary-600">
              {cls.subject}
            </span>
          )}
          <span className="text-[12px] font-body text-ink-tertiary">{formatDate(assessment.created_at)}</span>
          <span className="text-[12px] font-body text-ink-tertiary capitalize">{assessment.difficulty}</span>
        </div>
      </div>

      {/* Stats */}
      {report ? (
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
            <p className="font-display font-bold text-xl text-ink-primary">
              {report.student_summaries.length}
            </p>
            <p className="text-[11px] font-body text-ink-tertiary">students</p>
          </div>
        </div>
      ) : (
        <span className="text-[12px] font-body text-ink-tertiary shrink-0">No report yet</span>
      )}

      <ChevronRight className="w-4 h-4 text-ink-tertiary shrink-0 hidden sm:block" />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [reports, setReports] = useState<Record<string, DiagnosticReport | null>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [aRes, cRes] = await Promise.all([
          api.getAssessments({ per_page: 100 }),
          api.getClasses({ per_page: 100 }),
        ])
        const published = aRes.items.filter(
          (a) => a.status === "published" || a.status === "closed"
        )
        setAssessments(published)
        setClasses(cRes.items)

        // Fetch diagnostics for each published assessment (in parallel)
        const reportEntries = await Promise.all(
          published.map(async (a) => {
            try {
              const r = await api.getDiagnostics(a.id)
              return [a.id, r] as const
            } catch {
              return [a.id, null] as const
            }
          })
        )
        setReports(Object.fromEntries(reportEntries))
      } catch {
        toast.error("Failed to load reports")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]))

  // Summary stats
  const withReports = Object.values(reports).filter(Boolean) as DiagnosticReport[]
  const avgMastery = withReports.length
    ? Math.round(withReports.reduce((s, r) => s + r.mastery_rate, 0) / withReports.length)
    : null
  const avgScore = withReports.length
    ? Math.round(withReports.reduce((s, r) => s + r.avg_score, 0) / withReports.length)
    : null
  const totalStudents = withReports.length
    ? withReports.reduce((s, r) => s + r.student_summaries.length, 0)
    : 0

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
      {!loading && withReports.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-[12px] bg-primary-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">Avg Mastery</p>
              <p className="font-display font-bold text-2xl text-ink-primary">
                {avgMastery !== null ? `${avgMastery}%` : "—"}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-[12px] bg-accent-50 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-accent-600" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">Avg Score</p>
              <p className="font-display font-bold text-2xl text-ink-primary">
                {avgScore !== null ? `${avgScore}%` : "—"}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-[12px] bg-primary-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">Submissions</p>
              <p className="font-display font-bold text-2xl text-ink-primary">{totalStudents}</p>
            </div>
          </div>
        </div>
      )}

      {/* Assessment list */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-[14px]" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No published assessments"
          description="Publish an assessment and generate a diagnostic report to see results here."
          actionLabel="Go to Exam Library"
          onAction={() => router.push("/dashboard/exams")}
        />
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => (
            <ReportRow
              key={a.id}
              assessment={a}
              cls={classMap[a.class_id]}
              report={reports[a.id] ?? null}
              onClick={() => router.push(`/dashboard/assessments/${a.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
