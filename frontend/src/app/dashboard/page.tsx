"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  Target,
  FileText,
  Clock,
  Plus,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { api, type DashboardData, type DashboardRecentAssessment } from "@/lib/api"
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

const LEVEL_MAP: Record<string, "critical" | "remedial" | "average" | "good" | "mastered"> = {
  critical: "critical",
  remedial: "remedial",
  average: "average",
  good: "good",
  mastered: "mastered",
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
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  const todayStr = new Date().toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  })

  // Topics to reteach from recent assessments that have mastery_rate
  const reteachItems = (data?.recent_assessments ?? [])
    .filter((a) => a.mastery_rate !== null && a.mastery_rate < 75)
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      topic: a.title,
      class_name: a.class_name,
      pct: a.mastery_rate!,
      level: masteryLevel(a.mastery_rate!),
    }))

  return (
    <div className="space-y-6">

      {/* ── 1. Welcome header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.875rem] font-bold text-ink-primary leading-tight">
            {greeting()}{user ? `, ${user.first_name}!` : "!"}
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">{todayStr}</p>
        </div>
        <Button
          variant="gradient"
          size="default"
          className="shrink-0 mt-1"
          onClick={() => router.push("/dashboard/exams/create")}
        >
          <Plus className="w-4 h-4" />
          Create Exam
        </Button>
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

      {/* ── 3. Two-column: Recent Assessments + Topics to Reteach ── */}
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
                <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-primary truncate max-w-[260px]">
                      {item.title}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-secondary text-ink-secondary shrink-0">
                      {item.subject}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-ink-secondary">{item.class_name}</span>
                    <span className="text-ink-tertiary text-xs">·</span>
                    <span className="text-xs text-ink-tertiary">{formatDate(item.created_at)}</span>
                    {item.avg_score !== null && (
                      <>
                        <span className="text-ink-tertiary text-xs">·</span>
                        <span className={`text-xs font-semibold ${scoreColor(item.avg_score)}`}>
                          {item.avg_score}% avg
                        </span>
                      </>
                    )}
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        {/* Topics to Reteach — col-span-1 */}
        <DataCard
          title="Topics to Reteach"
          action={reteachItems.length > 0 ? { label: "View Reports", onClick: () => router.push("/dashboard/reports") } : undefined}
        >
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : reteachItems.length === 0 ? (
            <p className="text-sm font-body text-ink-tertiary py-4 text-center">
              {data?.recent_assessments.length === 0
                ? "Run an assessment to see reteach topics."
                : "No topics below mastery threshold — great work!"}
            </p>
          ) : (
            <div className="space-y-3">
              {reteachItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border-light p-3 cursor-pointer hover:shadow-sm transition-shadow"
                  style={{ borderLeftWidth: "3px", borderLeftColor: BORDER_COLOR[item.level] }}
                  onClick={() => router.push(`/dashboard/assessments/${item.id}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-primary leading-snug truncate">
                      {item.topic}
                    </span>
                    <MasteryBadge status={item.level} size="sm" showIcon={false} />
                  </div>
                  <p className="text-xs text-ink-tertiary mt-0.5">{item.class_name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-ink-secondary">{item.pct}% mastery rate</p>
                    <ChevronRight className="w-3 h-3 text-ink-tertiary" />
                  </div>
                </div>
              ))}
            </div>
          )}
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
