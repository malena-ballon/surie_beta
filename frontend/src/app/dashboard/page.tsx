"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Users,
  Target,
  FileText,
  Clock,
  Plus,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  UserX,
  TrendingDown,
} from "lucide-react"
import { toast } from "sonner"
import {
  api,
  type DashboardData,
  type DashboardRecentAssessment,
} from "@/lib/api"
import { useAuth } from "@/providers/auth-provider"
import { Button }     from "@/components/ui/button"
import { StatCard }   from "@/components/ui/stat-card"
import { DataCard }   from "@/components/ui/data-card"
import { MasteryBadge, StatusBadge } from "@/components/ui/mastery-badge"
import { Skeleton }   from "@/components/ui/skeleton"
import { PerformanceChart } from "@/app/dashboard/_components/performance-chart"

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function masteryLevel(pct: number): "critical" | "remedial" | "average" | "good" | "mastered" {
  if (pct < 40) return "critical"
  if (pct < 60) return "remedial"
  if (pct < 75) return "average"
  if (pct < 90) return "good"
  return "mastered"
}

const BORDER_COLOR: Record<string, string> = {
  critical: "#EF5350",
  remedial: "#FFA726",
  average:  "#FFCA28",
  good:     "#66BB6A",
  mastered: "#42A5F5",
}

// ── Skeleton loaders ───────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 card-grid">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[100px] rounded-[14px]" />)}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [data, setData]         = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [classId, setClassId]   = useState<string>(searchParams.get("class_id") ?? "")

  const load = useCallback((cid: string) => {
    setLoading(true)
    api.getDashboard(cid || undefined)
      .then(setData)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(classId) }, [classId, load])

  function handleClassChange(val: string) {
    setClassId(val)
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set("class_id", val)
    else params.delete("class_id")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const todayStr = new Date().toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  })

  const atRiskCount = data?.at_risk_students?.length ?? 0

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
          {/* Class filter dropdown */}
          <select
            value={classId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 py-0 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-primary-200 min-w-[160px]"
          >
            <option value="">All Sections</option>
            {(data?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` — ${c.section}` : ""}
              </option>
            ))}
          </select>
          <Button
            variant="gradient"
            size="default"
            onClick={() => router.push("/dashboard/exams/create")}
          >
            <Plus className="w-4 h-4" />
            Create Exam
          </Button>
        </div>
      </div>

      {/* ── 2. Stat cards ── */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 card-grid">
          <StatCard
            icon={Users}
            iconColor="text-primary-500"
            iconBg="bg-primary-50"
            label="Total Students"
            value={String(data?.total_students ?? 0)}
          />
          <StatCard
            icon={Target}
            iconColor="text-accent-600"
            iconBg="bg-accent-50"
            label="Avg. Mastery Rate"
            value={data?.avg_mastery_rate != null ? `${data.avg_mastery_rate}%` : "—"}
          />
          <StatCard
            icon={FileText}
            iconColor="text-primary-500"
            iconBg="bg-primary-50"
            label="Total Exams"
            value={String(data?.total_exams ?? 0)}
            subtitle={`${data?.total_classes ?? 0} active classes`}
          />
          <StatCard
            icon={Clock}
            iconColor="text-warning-600"
            iconBg="bg-warning-50"
            label="Pending Review"
            value={String(data?.pending_review ?? 0)}
            subtitle="submissions"
          />
        </div>
      )}

      {/* ── 3. Action Items ── */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 card-grid">
          {/* Pending review */}
          <button
            onClick={() => router.push("/dashboard/exams?status=pending_review")}
            className="flex items-center gap-4 rounded-[14px] border border-border-light bg-surface-primary px-4 py-4 text-left hover:shadow-md transition-shadow"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-50">
              <Clock className="w-5 h-5 text-warning-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[1.375rem] font-bold text-ink-primary leading-none">
                {data?.pending_review ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">submissions pending review</p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-tertiary ml-auto shrink-0" />
          </button>

          {/* Draft exams */}
          <button
            onClick={() => router.push("/dashboard/exams?status=draft")}
            className="flex items-center gap-4 rounded-[14px] border border-border-light bg-surface-primary px-4 py-4 text-left hover:shadow-md transition-shadow"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
              <BookOpen className="w-5 h-5 text-primary-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[1.375rem] font-bold text-ink-primary leading-none">
                {data?.draft_exams ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">draft exams to publish</p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-tertiary ml-auto shrink-0" />
          </button>

          {/* At-risk students */}
          <button
            onClick={() => router.push("/dashboard/reports")}
            className="flex items-center gap-4 rounded-[14px] border border-border-light bg-surface-primary px-4 py-4 text-left hover:shadow-md transition-shadow"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50">
              <UserX className="w-5 h-5 text-danger-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[1.375rem] font-bold text-ink-primary leading-none">
                {atRiskCount}
              </p>
              <p className="mt-0.5 text-xs text-ink-secondary">students below mastery threshold</p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-tertiary ml-auto shrink-0" />
          </button>
        </div>
      )}

      {/* ── 4. Recent Assessments + Topics to Reteach ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 card-grid">

        {/* Recent Assessments — col-span-2 */}
        <DataCard
          title="Recent Assessments"
          action={{ label: "View All", onClick: () => router.push("/dashboard/exams") }}
          className="lg:col-span-2"
        >
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : !data || data.recent_assessments.length === 0 ? (
            <p className="text-sm font-body text-ink-tertiary py-4 text-center">
              No assessments yet.{" "}
              <button
                onClick={() => router.push("/dashboard/exams/create")}
                className="text-primary-500 font-medium hover:underline"
              >
                Create one
              </button>
            </p>
          ) : (
            <div className="divide-y divide-border-light -mt-1">
              {data.recent_assessments.map((item) => (
                <AssessmentRow
                  key={item.id}
                  item={item}
                  onNavigate={() => router.push(`/dashboard/assessments/${item.id}`)}
                />
              ))}
            </div>
          )}
        </DataCard>

        {/* Topics to Reteach — col-span-1 */}
        <DataCard
          title="Topics to Reteach"
          action={
            (data?.reteach_assessments?.length ?? 0) > 0
              ? { label: "View Reports", onClick: () => router.push("/dashboard/reports") }
              : undefined
          }
        >
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (data?.reteach_assessments?.length ?? 0) === 0 ? (
            <p className="text-sm font-body text-ink-tertiary py-4 text-center">
              {(data?.recent_assessments.length ?? 0) === 0
                ? "Run an assessment to see reteach topics."
                : "No topics below mastery threshold — great work!"}
            </p>
          ) : (
            <div className="space-y-3">
              {data!.reteach_assessments.map((item) => {
                const level = masteryLevel(item.mastery_rate)
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border-light p-3 cursor-pointer hover:shadow-sm transition-shadow"
                    style={{ borderLeftWidth: "3px", borderLeftColor: BORDER_COLOR[level] }}
                    onClick={() => router.push(`/dashboard/assessments/${item.id}`)}
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
          )}
        </DataCard>
      </div>

      {/* ── 5. Students Needing Attention + Performance Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 card-grid">

        {/* Students Needing Attention — col-span-1 */}
        <DataCard
          title="Students Needing Attention"
          action={
            (data?.at_risk_students?.length ?? 0) > 0
              ? { label: "View All", onClick: () => router.push("/dashboard/reports") }
              : undefined
          }
        >
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (data?.at_risk_students?.length ?? 0) === 0 ? (
            <p className="text-sm font-body text-ink-tertiary py-4 text-center">
              No at-risk students identified yet.
            </p>
          ) : (
            <div className="space-y-2">
              {data!.at_risk_students.map((s) => (
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
          )}
        </DataCard>

        {/* Performance Trend chart — col-span-2 */}
        <DataCard
          title="Class Performance Trend"
          subtitle="Mastery rate over time"
          className="lg:col-span-2"
        >
          {loading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <PerformanceChart trend={data?.performance_trend ?? []} />
          )}
        </DataCard>
      </div>

    </div>
  )
}

// ── Assessment row sub-component ───────────────────────────────

function AssessmentRow({
  item,
  onNavigate,
}: {
  item: DashboardRecentAssessment
  onNavigate: () => void
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

  return (
    <div
      className="py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-surface-secondary -mx-1 px-1 rounded transition-colors"
      onClick={onNavigate}
    >
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
            <span className="text-xs text-ink-tertiary">{formatDate(item.created_at)}</span>
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
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${quickAction.color}`}
            >
              {quickAction.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
