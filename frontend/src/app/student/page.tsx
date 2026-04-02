"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/providers/auth-provider"
import { api, type StudentAssessmentItem } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatScore(score: number | null, max: number | null): string {
  if (score == null || max == null) return "—"
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  return `${score}/${max} (${pct}%)`
}

type ExamState =
  | "not_started_open"
  | "in_progress"
  | "submitted"
  | "graded"
  | "pending_review"
  | "missed"

function getExamState(item: StudentAssessmentItem): ExamState {
  const now = new Date()
  const isPastDue = item.end_at ? new Date(item.end_at) < now : false

  if (item.submission_status === "graded") return "graded"
  if (item.submission_status === "pending_review") return "pending_review"
  if (item.submission_status === "submitted") return "submitted"
  if (item.submission_status === "in_progress") return "in_progress"
  // no submission
  if (isPastDue) return "missed"
  return "not_started_open"
}

// ── Status badge ───────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ExamState,
  { label: string; bg: string; color: string }
> = {
  not_started_open: { label: "Not Started",    bg: "#F5F3EF", color: "#8E8E9E" },
  in_progress:      { label: "In Progress",    bg: "#FFF8E1", color: "#E6951A" },
  submitted:        { label: "Submitted",       bg: "#E8F1FA", color: "#0072C6" },
  graded:           { label: "Graded",          bg: "#E8F5E9", color: "#2D8A4E" },
  pending_review:   { label: "Pending Review",  bg: "#F3E8FF", color: "#7C3AED" },
  missed:           { label: "Missed",          bg: "#FFEBEE", color: "#E53935" },
}

function StatusBadge({ state }: { state: ExamState }) {
  const cfg = STATUS_CONFIG[state]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-body leading-none"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

// ── Action button / element ────────────────────────────────────

function ExamAction({
  item,
  state,
  onStart,
  starting,
}: {
  item: StudentAssessmentItem
  state: ExamState
  onStart: (id: string) => void
  starting: boolean
}) {
  if (state === "graded" || state === "pending_review" || state === "submitted") {
    return (
      <div className="flex items-center gap-3">
        <span className="font-display font-semibold text-sm text-ink-primary">
          {formatScore(item.total_score, item.max_score)}
        </span>
        {item.submission_id && (
          <Link
            href={`/exam/${item.id}?sub=${item.submission_id}`}
            className="text-[13px] font-medium text-primary-500 hover:text-primary-600 transition-colors"
          >
            Review
          </Link>
        )}
      </div>
    )
  }

  if (state === "in_progress" && item.submission_id) {
    return (
      <Link
        href={`/exam/${item.id}?sub=${item.submission_id}`}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold font-body",
          "bg-accent-500 text-white hover:bg-accent-600 transition-colors duration-[150ms]"
        )}
      >
        Continue
      </Link>
    )
  }

  if (state === "not_started_open") {
    return (
      <button
        onClick={() => onStart(item.id)}
        disabled={starting}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold font-body",
          "bg-gradient-to-r from-primary-500 to-accent-500 text-white",
          "hover:opacity-90 active:scale-[0.98] transition-all duration-[150ms]",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
      >
        {starting ? "Starting…" : "Start Exam"}
      </button>
    )
  }

  // missed
  return (
    <span className="text-[13px] font-medium text-ink-tertiary">Missed</span>
  )
}

// ── Assessment row ─────────────────────────────────────────────

function AssessmentRow({
  item,
  onStart,
  starting,
}: {
  item: StudentAssessmentItem
  onStart: (id: string) => void
  starting: boolean
}) {
  const state = getExamState(item)

  return (
    <div className="flex items-center gap-4 py-4 px-5 border-b border-border-light last:border-0">
      {/* Icon */}
      <div className="w-10 h-10 rounded-[10px] bg-primary-50 flex items-center justify-center shrink-0">
        <BookOpen className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-semibold text-[14px] text-ink-primary truncate">
            {item.title}
          </span>
          <StatusBadge state={state} />
        </div>
        <p className="font-body text-[12px] text-ink-secondary mt-0.5">
          {item.subject} &middot; {item.class_name}
          {item.end_at && (
            <span className="ml-2 inline-flex items-center gap-1 text-ink-tertiary">
              <Clock className="w-3 h-3" strokeWidth={1.75} />
              Due {formatDate(item.end_at)}
            </span>
          )}
        </p>
      </div>

      {/* Action */}
      <div className="shrink-0">
        <ExamAction item={item} state={state} onStart={onStart} starting={starting} />
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [assessments, setAssessments] = useState<StudentAssessmentItem[]>([])
  const [loading, setLoading] = useState(true)

  const firstName = user?.first_name ?? "Student"
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  useEffect(() => {
    api
      .getStudentAssessments()
      .then(setAssessments)
      .catch(() => toast.error("Failed to load assessments"))
      .finally(() => setLoading(false))
  }, [])

  const handleStart = (assessmentId: string) => {
    router.push(`/exam/${assessmentId}`)
  }

  // Partition into active (open / in-progress) and past
  const active = assessments.filter((a) => {
    const s = getExamState(a)
    return s === "not_started_open" || s === "in_progress"
  })
  const past = assessments.filter((a) => {
    const s = getExamState(a)
    return s !== "not_started_open" && s !== "in_progress"
  })

  const stats = {
    total: assessments.length,
    completed: assessments.filter((a) =>
      ["graded", "submitted", "pending_review"].includes(a.submission_status ?? "")
    ).length,
    missed: assessments.filter((a) => getExamState(a) === "missed").length,
  }

  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-[28px] text-ink-primary leading-tight">
          Hello, {firstName}!
        </h1>
        <p className="font-body text-sm text-ink-secondary mt-1">{today}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Exams", value: stats.total, icon: BookOpen,      color: "text-primary-500",  bg: "bg-primary-50" },
          { label: "Completed",   value: stats.completed, icon: CheckCircle2, color: "text-[#2D8A4E]", bg: "bg-[#E8F5E9]" },
          { label: "Missed",      value: stats.missed,    icon: XCircle,      color: "text-danger-500", bg: "bg-[#FFEBEE]" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-white rounded-[14px] border border-border-light shadow-card p-4 flex items-center gap-3"
          >
            <div className={cn("w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("w-5 h-5", color)} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-display font-bold text-xl text-ink-primary leading-none">{value}</p>
              <p className="font-body text-[11px] text-ink-tertiary mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active assessments */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-base text-ink-primary mb-3">
          My Assessments
        </h2>
        <div className="bg-white rounded-[16px] border border-border-light shadow-card overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[60px] rounded-[10px]" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary-400" strokeWidth={1.75} />
              </div>
              <p className="font-display font-semibold text-ink-primary">All caught up!</p>
              <p className="font-body text-sm text-ink-tertiary">
                No pending exams right now. Check back later.
              </p>
            </div>
          ) : (
            active.map((item) => (
              <AssessmentRow
                key={item.id}
                item={item}
                onStart={handleStart}
                starting={false}
              />
            ))
          )}
        </div>
      </section>

      {/* Past assessments */}
      {!loading && past.length > 0 && (
        <section>
          <h2 className="font-display font-semibold text-base text-ink-primary mb-3">
            Past Exams
          </h2>
          <div className="bg-white rounded-[16px] border border-border-light shadow-card overflow-hidden">
            {past.map((item) => (
              <AssessmentRow
                key={item.id}
                item={item}
                onStart={handleStart}
                starting={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state (no assessments at all) */}
      {!loading && assessments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-ink-tertiary" strokeWidth={1.5} />
          <p className="font-display font-semibold text-ink-secondary">No assessments assigned yet</p>
          <p className="font-body text-sm text-ink-tertiary max-w-[280px]">
            Your teacher hasn&apos;t published any exams for your class yet.
          </p>
        </div>
      )}
    </div>
  )
}
