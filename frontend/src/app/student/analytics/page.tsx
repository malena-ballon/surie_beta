"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts"
import {
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  ChevronDown,
  Filter,
  TrendingUp,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { api, type StudentAnalytics } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ── Design helpers ─────────────────────────────────────────────

type MasteryLevel = "mastered" | "good" | "average" | "remedial" | "critical"

const MASTERY_CONFIG: Record<MasteryLevel, { label: string; bg: string; text: string; bar: string }> = {
  mastered: { label: "Mastered",  bg: "#E3F2FD", text: "#1565C0", bar: "#42A5F5" },
  good:     { label: "Good",      bg: "#E8F5E9", text: "#2E7D32", bar: "#66BB6A" },
  average:  { label: "Average",   bg: "#FFF8E1", text: "#F57F17", bar: "#FFCA28" },
  remedial: { label: "Needs Work",bg: "#FFF3E0", text: "#E65100", bar: "#FFA726" },
  critical: { label: "Critical",  bg: "#FFEBEE", text: "#C62828", bar: "#EF5350" },
}

function masteryLevel(pct: number): MasteryLevel {
  if (pct >= 90) return "mastered"
  if (pct >= 75) return "good"
  if (pct >= 60) return "average"
  if (pct >= 40) return "remedial"
  return "critical"
}

function percentileLabel(p: number) {
  if (p >= 90) return "Top 10%"
  if (p >= 75) return "Top 25%"
  if (p >= 50) return "Above Average"
  if (p >= 25) return "Below Average"
  return "Bottom 25%"
}

function percentileColor(p: number) {
  if (p >= 75) return "text-[#2E7D32]"
  if (p >= 50) return "text-[#F57F17]"
  return "text-[#C62828]"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

// ── Select ─────────────────────────────────────────────────────

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8 pr-8 py-2 rounded-[10px] border border-border-default bg-white text-[13px] font-body text-ink-primary appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-6 h-6" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-body text-[11px] text-ink-tertiary uppercase tracking-wide">{label}</p>
        <p className="font-display font-bold text-2xl text-ink-primary leading-tight">{value}</p>
        {sub && <p className="font-body text-[11px] text-ink-tertiary mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────

function SubtopicTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border-light shadow-card rounded-xl px-4 py-3 text-[12px] font-body min-w-[160px]">
      <p className="font-semibold text-ink-primary mb-2 truncate max-w-[180px]">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-ink-primary">{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Trend sparkline ────────────────────────────────────────────

function TrendLine({ data }: { data: { score_pct: number; date: string; title: string }[] }) {
  if (data.length < 2) {
    return (
      <div className="w-24 h-8 flex items-center justify-center">
        <span className="text-[11px] text-ink-tertiary font-body">1 exam</span>
      </div>
    )
  }
  const chartData = data.map((d) => ({ v: d.score_pct }))
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke="#0072C6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function StudentAnalyticsPage() {
  const [data, setData] = useState<StudentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [classFilter, setClassFilter] = useState("")
  const [examFilter, setExamFilter] = useState("")

  useEffect(() => {
    api
      .getStudentAnalytics({ classId: classFilter || undefined, assessmentId: examFilter || undefined })
      .then(setData)
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false))
  }, [classFilter, examFilter])

  const exams = data?.exams ?? []
  const overallMastery = data?.overall_mastery ?? []
  const classes = data?.classes ?? []
  const allAssessments = data?.all_assessments ?? []

  // Summary stats
  const avgScore = useMemo(() => {
    const valid = exams.filter((e) => e.total_score_pct != null)
    if (!valid.length) return null
    return Math.round(valid.reduce((s, e) => s + (e.total_score_pct ?? 0), 0) / valid.length)
  }, [exams])

  const avgPercentile = useMemo(() => {
    if (!exams.length) return null
    return Math.round(exams.reduce((s, e) => s + e.percentile, 0) / exams.length)
  }, [exams])

  // For the subtopic chart: use first filtered exam (or aggregate all if no exam filter)
  const subtopicChartData = useMemo(() => {
    if (!exams.length) return []
    // If a specific exam is filtered, use its subtopics; otherwise aggregate across all
    const source = examFilter ? exams.slice(0, 1) : exams
    const agg: Record<string, { myTotal: number; classTotal: number; count: number }> = {}
    for (const exam of source) {
      for (const st of exam.subtopics) {
        if (!agg[st.name]) agg[st.name] = { myTotal: 0, classTotal: 0, count: 0 }
        agg[st.name].myTotal += st.student_score_pct
        agg[st.name].classTotal += st.class_avg_pct
        agg[st.name].count += 1
      }
    }
    return Object.entries(agg)
      .map(([name, d]) => ({
        name: name.length > 20 ? name.slice(0, 18) + "…" : name,
        fullName: name,
        "My Score": Math.round(d.myTotal / d.count),
        "Class Avg": Math.round(d.classTotal / d.count),
      }))
      .sort((a, b) => b["My Score"] - a["My Score"])
  }, [exams, examFilter])

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[28px] text-ink-primary leading-tight">
            My Analytics
          </h1>
          <p className="font-body text-sm text-ink-secondary mt-1">
            Personal performance report — only visible to you
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {loading ? null : (
            <>
              <Select
                label="All Classes"
                value={classFilter}
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(v) => { setClassFilter(v); setExamFilter(""); setLoading(true) }}
              />
              <Select
                label="All Exams"
                value={examFilter}
                options={allAssessments.map((a) => ({ value: a.id, label: a.title }))}
                onChange={(v) => { setExamFilter(v); setLoading(true) }}
              />
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Exams Taken"
            value={exams.length}
            icon={BookOpen}
            color="#0072C6"
          />
          <StatCard
            label="Avg Score"
            value={avgScore != null ? `${avgScore}%` : "—"}
            sub={avgScore != null ? masteryLevel(avgScore).toUpperCase() : undefined}
            icon={BarChart2}
            color={avgScore != null ? (avgScore >= 75 ? "#2E7D32" : avgScore >= 60 ? "#F57F17" : "#C62828") : "#8E8E9E"}
          />
          <StatCard
            label="Avg Percentile"
            value={avgPercentile != null ? `${avgPercentile}th` : "—"}
            sub={avgPercentile != null ? percentileLabel(avgPercentile) : undefined}
            icon={TrendingUp}
            color="#7C3AED"
          />
          <StatCard
            label="Subtopics Tracked"
            value={overallMastery.length}
            icon={Award}
            color="#E6951A"
          />
        </div>
      )}

      {!loading && exams.length === 0 && (
        <div className="bg-white rounded-[16px] border border-border-light shadow-card flex flex-col items-center justify-center py-20 gap-4 text-center">
          <BarChart2 className="w-10 h-10 text-ink-tertiary/40" strokeWidth={1.5} />
          <p className="font-display font-semibold text-ink-secondary">No exam data yet</p>
          <p className="font-body text-sm text-ink-tertiary max-w-[280px]">
            Complete exams to see your personalized analytics.
          </p>
        </div>
      )}

      {!loading && exams.length > 0 && (
        <>
          {/* ── Exam History ── */}
          <section>
            <h2 className="font-display font-semibold text-base text-ink-primary mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
              Exam History
            </h2>
            <div className="bg-white rounded-[16px] border border-border-light shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-light bg-surface-secondary">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">Exam</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide hidden sm:table-cell">Class</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide hidden md:table-cell">Date</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">Score</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">Percentile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {exams.map((exam) => {
                    const pct = exam.total_score_pct ?? 0
                    const lvl = masteryLevel(pct)
                    const cfg = MASTERY_CONFIG[lvl]
                    return (
                      <tr key={exam.assessment_id} className="hover:bg-surface-secondary/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-body font-semibold text-[13px] text-ink-primary">{exam.title}</p>
                          <p className="font-body text-[11px] text-ink-tertiary sm:hidden">{exam.class_name}</p>
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <p className="font-body text-[13px] text-ink-secondary">{exam.class_name}</p>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <p className="font-body text-[13px] text-ink-tertiary">
                            {exam.submitted_at ? formatDate(exam.submitted_at) : "—"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-display font-bold text-[15px] text-ink-primary">
                              {exam.total_score ?? "—"}/{exam.max_score}
                            </span>
                            <span
                              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: cfg.bg, color: cfg.text }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={cn("font-display font-bold text-[15px]", percentileColor(exam.percentile))}>
                              {exam.percentile}th
                            </span>
                            <span className="font-body text-[10px] text-ink-tertiary">{percentileLabel(exam.percentile)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Subtopic: My Score vs Class Average ── */}
          {subtopicChartData.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-base text-ink-primary mb-1 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                My Score vs Class Average
              </h2>
              <p className="font-body text-[12px] text-ink-tertiary mb-3">
                {examFilter ? "Selected exam subtopic breakdown" : "Aggregated across all exams"}
              </p>
              <div className="bg-white rounded-[16px] border border-border-light shadow-card p-6">
                <ResponsiveContainer width="100%" height={Math.max(240, subtopicChartData.length * 52)}>
                  <BarChart
                    data={subtopicChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                    barCategoryGap="28%"
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0F0" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fontFamily: "var(--font-body)", fill: "#8E8E9E" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11, fontFamily: "var(--font-body)", fill: "#4A4A5A" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<SubtopicTooltip />} cursor={{ fill: "#F5F3EF" }} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)", paddingTop: 8 }}
                    />
                    <Bar dataKey="My Score" fill="#0072C6" radius={[0, 4, 4, 0]} maxBarSize={16} />
                    <Bar dataKey="Class Avg" fill="#CBD5E1" radius={[0, 4, 4, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* ── Subtopic Mastery ── */}
          {overallMastery.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-base text-ink-primary mb-1 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                My Subtopic Mastery
              </h2>
              <p className="font-body text-[12px] text-ink-tertiary mb-3">
                Aggregated across all your exams — includes trend over time
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overallMastery.map((m) => {
                  const lvl = m.level as MasteryLevel
                  const cfg = MASTERY_CONFIG[lvl] ?? MASTERY_CONFIG.average
                  return (
                    <div
                      key={m.subtopic}
                      className="bg-white rounded-[14px] border border-border-light shadow-card p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-body font-semibold text-[13px] text-ink-primary truncate">
                            {m.subtopic}
                          </p>
                          <p className="font-body text-[11px] text-ink-tertiary mt-0.5">
                            {m.exam_count} exam{m.exam_count !== 1 ? "s" : ""} · avg {m.avg_score_pct}%
                          </p>
                        </div>
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-surface-secondary overflow-hidden mb-3">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${m.avg_score_pct}%`, backgroundColor: cfg.bar }}
                        />
                      </div>

                      {/* Trend sparkline */}
                      {m.trend.length >= 2 && (
                        <div className="flex items-center justify-between">
                          <span className="font-body text-[11px] text-ink-tertiary">Trend</span>
                          <TrendLine data={m.trend} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Percentile context ── */}
          {exams.length > 0 && (
            <section>
              <h2 className="font-display font-semibold text-base text-ink-primary mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                Class Standing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {exams.map((exam) => {
                  const pct = exam.total_score_pct ?? 0
                  const fillWidth = exam.percentile
                  return (
                    <div key={exam.assessment_id} className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
                      <p className="font-body font-semibold text-[13px] text-ink-primary truncate mb-0.5">
                        {exam.title}
                      </p>
                      <p className="font-body text-[11px] text-ink-tertiary mb-3">{exam.class_name}</p>

                      <div className="flex items-end justify-between mb-2">
                        <span className={cn("font-display font-bold text-2xl", percentileColor(exam.percentile))}>
                          {exam.percentile}th
                        </span>
                        <span className="font-body text-[11px] text-ink-tertiary">
                          {percentileLabel(exam.percentile)}
                        </span>
                      </div>

                      {/* Percentile bar */}
                      <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${fillWidth}%`,
                            backgroundColor:
                              exam.percentile >= 75 ? "#66BB6A" :
                              exam.percentile >= 50 ? "#FFCA28" : "#EF5350",
                          }}
                        />
                      </div>
                      <p className="font-body text-[11px] text-ink-tertiary mt-1.5 text-right">
                        Score: {pct}%
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
