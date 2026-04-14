"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts"
import {
  Award, BarChart2, BookOpen, Calendar, ChevronDown, ChevronUp,
  Filter, Minus, TrendingDown, TrendingUp, Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  api,
  type AnalyticsBloomsPoint,
  type AnalyticsMastery,
  type AnalyticsQTypePoint,
  type StudentAnalytics,
} from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ── Tokens ─────────────────────────────────────────────────────

type MasteryLevel = "mastered" | "good" | "average" | "remedial" | "critical"

const MC: Record<MasteryLevel, { label: string; bg: string; text: string; bar: string }> = {
  mastered: { label: "Mastered",   bg: "#E3F2FD", text: "#1565C0", bar: "#42A5F5" },
  good:     { label: "Good",       bg: "#E8F5E9", text: "#2E7D32", bar: "#66BB6A" },
  average:  { label: "Average",    bg: "#FFF8E1", text: "#F57F17", bar: "#FFCA28" },
  remedial: { label: "Needs Work", bg: "#FFF3E0", text: "#E65100", bar: "#FFA726" },
  critical: { label: "Critical",   bg: "#FFEBEE", text: "#C62828", bar: "#EF5350" },
}

function ml(pct: number): MasteryLevel {
  if (pct >= 90) return "mastered"
  if (pct >= 75) return "good"
  if (pct >= 60) return "average"
  if (pct >= 40) return "remedial"
  return "critical"
}

function pctColor(p: number) {
  if (p >= 75) return "#2E7D32"
  if (p >= 50) return "#F57F17"
  return "#C62828"
}

function pLabel(p: number) {
  if (p >= 90) return "Top 10%"
  if (p >= 75) return "Top 25%"
  if (p >= 50) return "Above Avg"
  if (p >= 25) return "Below Avg"
  return "Bottom 25%"
}

function fDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

// ── Sub-components ──────────────────────────────────────────────

function Sel({ label, value, options, onChange }: {
  label: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-tertiary pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-7 pr-7 py-2 rounded-[10px] border border-border-default bg-white text-[12px] font-body text-ink-primary appearance-none focus:outline-none focus:border-primary-500 transition-colors"
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-tertiary pointer-events-none" />
    </div>
  )
}

function MasteryBadge({ level }: { level: string }) {
  const cfg = MC[level as MasteryLevel] ?? MC.average
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}

function TrendArrow({ trend }: { trend: { score_pct: number }[] }) {
  if (trend.length < 2) return <Minus className="w-3.5 h-3.5 text-ink-tertiary" />
  const delta = trend[trend.length - 1].score_pct - trend[0].score_pct
  if (delta > 3) return <TrendingUp className="w-3.5 h-3.5 text-green-600" />
  if (delta < -3) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />
  return <Minus className="w-3.5 h-3.5 text-ink-tertiary" />
}

function SparkLine({ data }: { data: { score_pct: number }[] }) {
  if (data.length < 2) return null
  return (
    <div className="w-16 h-7 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((d) => ({ v: d.score_pct }))}>
          <Line type="monotone" dataKey="v" stroke="#0072C6" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border-light shadow-card rounded-xl px-4 py-3 text-[12px] font-body min-w-[160px]">
      <p className="font-semibold text-ink-primary mb-2 truncate max-w-[200px]">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-ink-secondary">{p.name}</span>
          </div>
          <span className="font-semibold text-ink-primary">{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Subtopic row ────────────────────────────────────────────────

function SubtopicRow({ m, rank }: { m: AnalyticsMastery; rank?: number }) {
  const cfg = MC[m.level as MasteryLevel] ?? MC.average
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border-light last:border-0">
      {rank != null && (
        <span className="w-5 h-5 rounded-full bg-surface-secondary flex items-center justify-center text-[10px] font-bold text-ink-tertiary shrink-0">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-body text-[13px] font-semibold text-ink-primary truncate">{m.subtopic}</span>
          <MasteryBadge level={m.level} />
        </div>
        <div className="h-1.5 rounded-full bg-surface-secondary overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${m.avg_score_pct}%`, backgroundColor: cfg.bar }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <TrendArrow trend={m.trend} />
        <SparkLine data={m.trend} />
        <span className="font-display font-bold text-[13px] text-ink-primary w-10 text-right">
          {m.avg_score_pct}%
        </span>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function StudentAnalyticsPage() {
  const [data, setData] = useState<StudentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [classFilter, setClassFilter] = useState("")
  const [examFilter, setExamFilter] = useState("")

  // UI expand state
  const [showAllExams, setShowAllExams] = useState(false)
  const [showAllSubtopics, setShowAllSubtopics] = useState(false)
  const [showClassHistory, setShowClassHistory] = useState(false)

  const load = (cId?: string, aId?: string) => {
    setLoading(true)
    api
      .getStudentAnalytics({ classId: cId || undefined, assessmentId: aId || undefined })
      .then(setData)
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const exams = data?.exams ?? []
  const overallMastery = data?.overall_mastery ?? []
  const bloomsData = data?.blooms_performance ?? []
  const qtypeData = data?.qtype_performance ?? []
  const classes = data?.classes ?? []
  const allAssessments = data?.all_assessments ?? []

  // Summaries
  const avgScore = useMemo(() => {
    const v = exams.filter((e) => e.total_score_pct != null)
    return v.length ? Math.round(v.reduce((s, e) => s + (e.total_score_pct ?? 0), 0) / v.length) : null
  }, [exams])

  const avgPercentile = useMemo(() => {
    return exams.length ? Math.round(exams.reduce((s, e) => s + e.percentile, 0) / exams.length) : null
  }, [exams])

  // Topic chart — all subtopics aggregated (or single exam)
  const topicChartData = useMemo(() => {
    if (!exams.length) return []
    const agg: Record<string, { myTotal: number; classTotal: number; count: number }> = {}
    const source = examFilter ? exams.slice(0, 1) : exams
    for (const exam of source) {
      for (const st of exam.subtopics) {
        if (!agg[st.name]) agg[st.name] = { myTotal: 0, classTotal: 0, count: 0 }
        agg[st.name].myTotal += st.student_score_pct
        agg[st.name].classTotal += st.class_avg_pct
        agg[st.name].count += 1
      }
    }
    return Object.entries(agg).map(([name, d]) => ({
      name: name.length > 16 ? name.slice(0, 14) + "…" : name,
      fullName: name,
      "My Score": Math.round(d.myTotal / d.count),
      "Class Avg": Math.round(d.classTotal / d.count),
    }))
  }, [exams, examFilter])

  // Subtopics to show in mastery section
  // When exam filtered: show subtopics for that exam only (already in exams[0].subtopics)
  // When no filter: Top 5 weakest from overall_mastery, with expandable "View All"
  const isExamFiltered = !!examFilter
  const examSubtopics = useMemo<AnalyticsMastery[]>(() => {
    if (!isExamFiltered || !exams.length) return []
    return exams[0].subtopics
      .map((st) => ({
        subtopic: st.name,
        avg_score_pct: st.student_score_pct,
        level: ml(st.student_score_pct),
        exam_count: 1,
        trend: [],
      }))
      .sort((a, b) => a.avg_score_pct - b.avg_score_pct)
  }, [isExamFiltered, exams])

  // Top 5 weakest (sorted ascending by pct, take bottom 5)
  const weakest5 = useMemo(() =>
    [...overallMastery].sort((a, b) => a.avg_score_pct - b.avg_score_pct).slice(0, 5),
    [overallMastery]
  )

  // Most recent exam for class standing
  const latestExam = exams[0] ?? null
  const olderExams = exams.slice(1)

  const hasData = !loading && exams.length > 0

  return (
    <div className="p-5 md:p-8 max-w-[1080px] mx-auto space-y-7">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[26px] text-ink-primary leading-tight">My Analytics</h1>
          <p className="font-body text-[13px] text-ink-secondary mt-0.5">
            Personal performance report — visible only to you
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!loading && (
            <>
              <Sel
                label="All Classes"
                value={classFilter}
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(v) => { setClassFilter(v); setExamFilter(""); load(v || undefined, undefined) }}
              />
              <Sel
                label="All Exams"
                value={examFilter}
                options={allAssessments.map((a) => ({ value: a.id, label: a.title }))}
                onChange={(v) => { setExamFilter(v); setShowAllSubtopics(false); load(classFilter || undefined, v || undefined) }}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-[88px] rounded-[14px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Exams Taken */}
          <div className="bg-white rounded-[14px] border border-border-light shadow-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-primary-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[11px] text-ink-tertiary uppercase tracking-wide">Exams</p>
              <p className="font-display font-bold text-2xl text-ink-primary">{exams.length}</p>
            </div>
          </div>

          {/* Avg Score — prominent */}
          <div className="bg-white rounded-[14px] border-2 shadow-card p-4 flex items-center gap-3"
            style={{ borderColor: avgScore != null ? (avgScore >= 75 ? "#66BB6A" : avgScore >= 60 ? "#FFCA28" : "#EF5350") : "#E8E8EE" }}>
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: avgScore != null ? `${pctColor(avgScore)}15` : "#F5F3EF" }}>
              <BarChart2 className="w-5 h-5" style={{ color: avgScore != null ? pctColor(avgScore) : "#8E8E9E" }} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[11px] text-ink-tertiary uppercase tracking-wide">Avg Score</p>
              <p className="font-display font-bold text-3xl leading-none"
                style={{ color: avgScore != null ? pctColor(avgScore) : "#8E8E9E" }}>
                {avgScore != null ? `${avgScore}%` : "—"}
              </p>
              {avgScore != null && (
                <p className="font-body text-[10px] mt-0.5" style={{ color: pctColor(avgScore) }}>
                  {ml(avgScore).toUpperCase()}
                </p>
              )}
            </div>
          </div>

          {/* Avg Percentile — prominent */}
          <div className="bg-white rounded-[14px] border-2 shadow-card p-4 flex items-center gap-3"
            style={{ borderColor: avgPercentile != null ? pctColor(avgPercentile) : "#E8E8EE" }}>
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: avgPercentile != null ? `${pctColor(avgPercentile)}15` : "#F5F3EF" }}>
              <TrendingUp className="w-5 h-5" style={{ color: avgPercentile != null ? pctColor(avgPercentile) : "#8E8E9E" }} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[11px] text-ink-tertiary uppercase tracking-wide">Avg Rank</p>
              <p className="font-display font-bold text-3xl leading-none"
                style={{ color: avgPercentile != null ? pctColor(avgPercentile) : "#8E8E9E" }}>
                {avgPercentile != null ? `${avgPercentile}th` : "—"}
              </p>
              {avgPercentile != null && (
                <p className="font-body text-[10px] mt-0.5" style={{ color: pctColor(avgPercentile) }}>
                  {pLabel(avgPercentile)}
                </p>
              )}
            </div>
          </div>

          {/* Subtopics */}
          <div className="bg-white rounded-[14px] border border-border-light shadow-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-amber-50 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-amber-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-body text-[11px] text-ink-tertiary uppercase tracking-wide">Subtopics</p>
              <p className="font-display font-bold text-2xl text-ink-primary">{overallMastery.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && exams.length === 0 && (
        <div className="bg-white rounded-[16px] border border-border-light shadow-card flex flex-col items-center justify-center py-20 gap-4 text-center">
          <BarChart2 className="w-10 h-10 text-ink-tertiary/40" strokeWidth={1.5} />
          <p className="font-display font-semibold text-ink-secondary">No exam data yet</p>
          <p className="font-body text-sm text-ink-tertiary max-w-[280px]">
            Complete exams to see your personalized analytics.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* ── Charts Row: Topic + Bloom's ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Topic / Chapter Performance */}
            {topicChartData.length > 0 && (
              <div className="bg-white rounded-[16px] border border-border-light shadow-card p-5">
                <div className="mb-4">
                  <p className="font-display font-semibold text-[14px] text-ink-primary">
                    Topic Performance
                  </p>
                  <p className="font-body text-[11px] text-ink-tertiary mt-0.5">
                    {examFilter ? "This exam's subtopics" : "Aggregated across all exams"}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(200, topicChartData.length * 22 + 60)}>
                  <LineChart data={topicChartData} margin={{ left: 0, right: 16, top: 4, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontFamily: "var(--font-body)", fill: "#6B6B80" }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 10, fontFamily: "var(--font-body)", fill: "#8E8E9E" }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <ReferenceLine y={75} stroke="#E8E8EE" strokeDasharray="4 2" />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-body)", paddingTop: 8 }} />
                    <Line type="monotone" dataKey="My Score" stroke="#0072C6" strokeWidth={2} dot={{ r: 3, fill: "#0072C6" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Class Avg" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: "#CBD5E1" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bloom's Taxonomy Performance */}
            {bloomsData.length > 0 && (
              <div className="bg-white rounded-[16px] border border-border-light shadow-card p-5">
                <div className="mb-4">
                  <p className="font-display font-semibold text-[14px] text-ink-primary">
                    Bloom's Taxonomy
                  </p>
                  <p className="font-body text-[11px] text-ink-tertiary mt-0.5">
                    Your score vs class average across cognitive levels
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={bloomsData.map((b) => ({
                      name: b.label,
                      "My Score": b.student_pct ?? 0,
                      "Class Avg": b.class_avg_pct ?? 0,
                    }))}
                    margin={{ left: 0, right: 16, top: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontFamily: "var(--font-body)", fill: "#6B6B80" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 10, fontFamily: "var(--font-body)", fill: "#8E8E9E" }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <ReferenceLine y={75} stroke="#E8E8EE" strokeDasharray="4 2" />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-body)", paddingTop: 8 }} />
                    <Line type="monotone" dataKey="My Score" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3, fill: "#7C3AED" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Class Avg" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: "#CBD5E1" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Section / Question-Type Performance ── */}
          {qtypeData.length > 0 && (
            <div className="bg-white rounded-[16px] border border-border-light shadow-card p-5">
              <div className="mb-4">
                <p className="font-display font-semibold text-[14px] text-ink-primary">
                  Section Performance
                </p>
                <p className="font-body text-[11px] text-ink-tertiary mt-0.5">
                  Your score vs class average by question type
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={qtypeData.map((q) => ({
                    name: q.label,
                    "My Score": q.student_pct ?? 0,
                    "Class Avg": q.class_avg_pct ?? 0,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                  barCategoryGap="30%"
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0F0" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fontFamily: "var(--font-body)", fill: "#8E8E9E" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={108}
                    tick={{ fontSize: 11, fontFamily: "var(--font-body)", fill: "#4A4A5A" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F5F3EF" }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-body)", paddingTop: 8 }} />
                  <Bar dataKey="My Score" fill="#0072C6" radius={[0, 4, 4, 0]} maxBarSize={14} />
                  <Bar dataKey="Class Avg" fill="#CBD5E1" radius={[0, 4, 4, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Exam History ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-[14px] text-ink-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                Exam History
              </h2>
              {exams.length > 3 && (
                <button
                  onClick={() => setShowAllExams((v) => !v)}
                  className="flex items-center gap-1 text-[12px] font-medium text-primary-500 hover:text-primary-600 transition-colors"
                >
                  {showAllExams ? (
                    <><ChevronUp className="w-3.5 h-3.5" />Show Less</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" />View All ({exams.length})</>
                  )}
                </button>
              )}
            </div>
            <div className="bg-white rounded-[16px] border border-border-light shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-light bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide">Exam</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide hidden sm:table-cell">Date</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide">Score</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-ink-tertiary uppercase tracking-wide">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {(showAllExams ? exams : exams.slice(0, 3)).map((exam) => {
                    const pct = exam.total_score_pct ?? 0
                    const level = ml(pct)
                    const cfg = MC[level]
                    return (
                      <tr key={exam.assessment_id} className="hover:bg-surface-secondary/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-body font-semibold text-[13px] text-ink-primary">{exam.title}</p>
                          <p className="font-body text-[11px] text-ink-tertiary">{exam.class_name}</p>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <p className="font-body text-[12px] text-ink-secondary">
                            {exam.submitted_at ? fDate(exam.submitted_at) : "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-display font-bold text-[14px] text-ink-primary">
                              {exam.total_score ?? "—"}/{exam.max_score}
                            </span>
                            <span
                              className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: cfg.bg, color: cfg.text }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <p className="font-display font-bold text-[14px]" style={{ color: pctColor(exam.percentile) }}>
                            {exam.percentile}th
                          </p>
                          <p className="font-body text-[10px] text-ink-tertiary">{pLabel(exam.percentile)}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Subtopic Mastery ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display font-semibold text-[14px] text-ink-primary flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                  {isExamFiltered ? "Subtopic Breakdown" : "Top 5 Weakest Subtopics"}
                </h2>
                {!isExamFiltered && (
                  <p className="font-body text-[11px] text-ink-tertiary mt-0.5">
                    Areas needing the most attention across all exams
                  </p>
                )}
              </div>
              {!isExamFiltered && overallMastery.length > 5 && (
                <button
                  onClick={() => setShowAllSubtopics((v) => !v)}
                  className="flex items-center gap-1 text-[12px] font-medium text-primary-500 hover:text-primary-600 transition-colors"
                >
                  {showAllSubtopics ? (
                    <><ChevronUp className="w-3.5 h-3.5" />Show Less</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" />View All ({overallMastery.length})</>
                  )}
                </button>
              )}
            </div>

            <div className="bg-white rounded-[16px] border border-border-light shadow-card overflow-hidden">
              {isExamFiltered ? (
                // Full list for this exam
                examSubtopics.length > 0
                  ? examSubtopics.map((m) => <SubtopicRow key={m.subtopic} m={m} />)
                  : <p className="px-4 py-8 text-center font-body text-sm text-ink-tertiary">No subtopic data for this exam.</p>
              ) : (
                // Weakest 5 (or all if expanded)
                (showAllSubtopics
                  ? [...overallMastery].sort((a, b) => a.avg_score_pct - b.avg_score_pct)
                  : weakest5
                ).map((m, i) => <SubtopicRow key={m.subtopic} m={m} rank={i + 1} />)
              )}
            </div>
          </section>

          {/* ── Class Standing ── */}
          {latestExam && (
            <section>
              <h2 className="font-display font-semibold text-[14px] text-ink-primary flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                Class Standing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Most recent — prominent */}
                <div className="bg-white rounded-[16px] border-2 border-primary-100 shadow-card p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="font-body text-[11px] text-ink-tertiary uppercase tracking-wide">Most Recent</p>
                      <p className="font-body font-semibold text-[14px] text-ink-primary truncate">{latestExam.title}</p>
                    </div>
                    <span className="text-[11px] font-body text-ink-tertiary shrink-0 ml-2">
                      {latestExam.submitted_at ? fDate(latestExam.submitted_at) : ""}
                    </span>
                  </div>

                  <div className="flex items-end gap-4 mt-4">
                    <div>
                      <p className="font-display font-bold text-5xl" style={{ color: pctColor(latestExam.percentile) }}>
                        {latestExam.percentile}th
                      </p>
                      <p className="font-body text-[12px] mt-0.5" style={{ color: pctColor(latestExam.percentile) }}>
                        {pLabel(latestExam.percentile)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-surface-secondary overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${latestExam.percentile}%`,
                            backgroundColor: pctColor(latestExam.percentile),
                          }}
                        />
                      </div>
                      <p className="font-body text-[11px] text-ink-tertiary text-right">
                        Score: {latestExam.total_score_pct ?? "—"}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Older exams — collapsible */}
                {olderExams.length > 0 && (
                  <div className="bg-white rounded-[16px] border border-border-light shadow-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                      <p className="font-body text-[12px] font-semibold text-ink-secondary">Previous Exams</p>
                      <button
                        onClick={() => setShowClassHistory((v) => !v)}
                        className="flex items-center gap-1 text-[11px] text-primary-500 hover:text-primary-600 transition-colors"
                      >
                        {showClassHistory ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Show ({olderExams.length})</>}
                      </button>
                    </div>
                    {showClassHistory && (
                      <div className="divide-y divide-border-light">
                        {olderExams.map((exam) => (
                          <div key={exam.assessment_id} className="flex items-center justify-between px-4 py-3">
                            <div className="min-w-0">
                              <p className="font-body text-[12px] font-semibold text-ink-primary truncate">{exam.title}</p>
                              <p className="font-body text-[11px] text-ink-tertiary">
                                {exam.submitted_at ? fDate(exam.submitted_at) : ""}
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="font-display font-bold text-[14px]" style={{ color: pctColor(exam.percentile) }}>
                                {exam.percentile}th
                              </p>
                              <p className="font-body text-[10px] text-ink-tertiary">{exam.total_score_pct ?? "—"}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
