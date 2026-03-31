"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  BarChart2,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  RefreshCw,
  Users,
  X,
  Zap,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { toast } from "sonner"
import {
  api,
  type AssessmentDetail,
  type DiagnosticReport,
  type MasteryLevel,
  type StudentSummary,
  type DifficultyLevel,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ── Design tokens ──────────────────────────────────────────────

const MASTERY_COLORS: Record<MasteryLevel, { bg: string; text: string; bar: string; border: string }> = {
  critical:  { bg: "#FFEBEE", text: "#C62828", bar: "#EF5350", border: "#EF5350" },
  remedial:  { bg: "#FFF3E0", text: "#E65100", bar: "#FFA726", border: "#FFA726" },
  average:   { bg: "#FFF8E1", text: "#F57F17", bar: "#FFCA28", border: "#FFCA28" },
  good:      { bg: "#E8F5E9", text: "#2E7D32", bar: "#66BB6A", border: "#66BB6A" },
  mastered:  { bg: "#E3F2FD", text: "#1565C0", bar: "#42A5F5", border: "#42A5F5" },
}

const BAND_COLORS: Record<string, string> = {
  "0-59":   "#EF5350",
  "60-69":  "#FFA726",
  "70-79":  "#FFCA28",
  "80-89":  "#66BB6A",
  "90-100": "#42A5F5",
}

function classify(pct: number): MasteryLevel {
  if (pct < 40) return "critical"
  if (pct < 60) return "remedial"
  if (pct < 75) return "average"
  if (pct < 90) return "good"
  return "mastered"
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
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "20" }}
      >
        <Icon className="w-6 h-6" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-body text-[12px] text-ink-tertiary uppercase tracking-wide">{label}</p>
        <p className="font-display font-bold text-2xl text-ink-primary leading-tight">{value}</p>
        {sub && <p className="font-body text-[12px] text-ink-secondary mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Mastery badge ──────────────────────────────────────────────

function MasteryBadge({ level }: { level: MasteryLevel }) {
  const c = MASTERY_COLORS[level]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-body capitalize"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {level}
    </span>
  )
}

// ── Score distribution bar chart ───────────────────────────────

function ScoreDistributionChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([band, count]) => ({ band, count }))
  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barSize={36}>
          <XAxis
            dataKey="band"
            tick={{ fontSize: 11, fontFamily: "var(--font-dm-sans)", fill: "#8E8E9E" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: "var(--font-dm-sans)", fill: "#8E8E9E" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #E8E6E1", fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.band} fill={BAND_COLORS[entry.band] ?? "#8E8E9E"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Subtopic mastery heatmap ───────────────────────────────────

function SubtopicHeatmap({ data }: { data: Record<string, { pct: number; level: MasteryLevel }> }) {
  const entries = Object.entries(data).sort((a, b) => a[1].pct - b[1].pct)
  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Subtopic Mastery</h3>
      {entries.length === 0 ? (
        <p className="text-sm font-body text-ink-tertiary">No subtopic data available.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([subtopic, { pct, level }]) => {
            const c = MASTERY_COLORS[level]
            return (
              <div key={subtopic}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-body text-[13px] text-ink-primary truncate max-w-[60%]">{subtopic}</span>
                  <span className="font-display font-semibold text-[13px]" style={{ color: c.text }}>
                    {pct}%
                  </span>
                </div>
                <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: c.bar }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Topics to reteach ──────────────────────────────────────────

function ReteachPanel({ topics }: { data?: unknown; topics: DiagnosticReport["topics_to_reteach"] }) {
  if (topics.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
        <h3 className="font-display font-semibold text-base text-ink-primary mb-3">Topics to Reteach</h3>
        <div className="flex items-center gap-2 text-ink-tertiary">
          <CheckCircle2 className="w-5 h-5 text-[#2D8A4E]" strokeWidth={1.75} />
          <span className="font-body text-sm">No critical gaps — great class performance!</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Topics to Reteach</h3>
      <div className="space-y-3">
        {topics.map((t) => {
          const c = MASTERY_COLORS[t.level]
          return (
            <div
              key={t.subtopic}
              className="rounded-[10px] border-l-4 p-3 pl-4"
              style={{ borderColor: c.border, backgroundColor: c.bg + "66" }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-display font-semibold text-[13px] text-ink-primary">
                  {t.subtopic}
                </span>
                <span className="font-display font-bold text-sm" style={{ color: c.text }}>
                  {t.avg_pct}%
                </span>
              </div>
              <p className="font-body text-[12px] text-ink-secondary mt-1.5 leading-relaxed">
                {t.misconception}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Student performance table ──────────────────────────────────

type SortKey = "name" | "pct" | "status" | "weakest"

function StudentTable({ students }: { students: StudentSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pct")
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...students].sort((a, b) => {
    let va: string | number = 0
    let vb: string | number = 0
    if (sortKey === "name") { va = a.name; vb = b.name }
    else if (sortKey === "pct") { va = a.pct; vb = b.pct }
    else if (sortKey === "status") { va = a.status; vb = b.status }
    else if (sortKey === "weakest") { va = a.weakest_subtopic ?? ""; vb = b.weakest_subtopic ?? "" }
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  })

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortAsc
        ? <ArrowUp className="w-3 h-3 inline ml-0.5" />
        : <ArrowDown className="w-3 h-3 inline ml-0.5" />
      : <Minus className="w-3 h-3 inline ml-0.5 opacity-30" />

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border-light flex items-center gap-2">
        <Users className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
        <h3 className="font-display font-semibold text-base text-ink-primary">Student Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-secondary border-b border-border-light">
              {(
                [
                  { key: "name" as SortKey, label: "Student" },
                  { key: "pct" as SortKey, label: "Score" },
                  { key: "status" as SortKey, label: "Status" },
                  { key: "weakest" as SortKey, label: "Weakest Area" },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggle(key)}
                  className="px-5 py-3 text-left text-[11px] font-semibold font-body text-ink-tertiary uppercase tracking-wide cursor-pointer hover:text-ink-secondary select-none"
                >
                  {label} <SortIcon k={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {sorted.map((s) => (
              <tr
                key={s.student_id}
                className={cn(
                  "hover:bg-surface-secondary/50 transition-colors",
                  s.at_risk && "bg-[#FFEBEE]/30"
                )}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm font-medium text-ink-primary">{s.name}</span>
                    {s.at_risk && (
                      <AlertTriangle className="w-3.5 h-3.5 text-danger-500 shrink-0" strokeWidth={2} />
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-display font-semibold text-sm text-ink-primary">
                    {s.score ?? "—"}/{s.max_score} ({s.pct}%)
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <MasteryBadge level={s.status} />
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-body text-[12px] text-ink-secondary">
                    {s.weakest_subtopic ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Re-Assessment Modal ────────────────────────────────────────

const GEN_MESSAGES = [
  "Analyzing diagnostic data…",
  "Identifying weak subtopics…",
  "Crafting targeted questions…",
  "Building remediation exam…",
]

function ReassessmentModal({
  report,
  assessmentId,
  onClose,
  onSuccess,
}: {
  report: DiagnosticReport
  assessmentId: string
  onClose: () => void
  onSuccess: (newId: string) => void
}) {
  const allSubtopics = Object.entries(report.subtopic_mastery).sort(
    (a, b) => a[1].pct - b[1].pct
  )
  const defaultSelected = allSubtopics
    .filter(([, d]) => d.pct < 60)
    .map(([s]) => s)

  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected.length ? defaultSelected : allSubtopics.slice(0, 3).map(([s]) => s)))
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium")
  const [subject, setSubject] = useState("")
  const [gradeLevel, setGradeLevel] = useState("")
  const [generating, setGenerating] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % GEN_MESSAGES.length), 3000)
    return () => clearInterval(t)
  }, [generating])

  const toggle = (s: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  const readyPct = report.mastery_rate
  const interventionPct = Math.round(
    (report.student_summaries.filter((s) => s.pct < 60).length /
      Math.max(1, report.student_summaries.length)) *
      100
  )

  const handleGenerate = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one subtopic")
      return
    }
    setGenerating(true)
    try {
      const result = await api.generateReassessment(assessmentId, {
        target_subtopics: Array.from(selected),
        question_count: questionCount,
        difficulty,
        subject,
        grade_level: gradeLevel,
      })
      onSuccess(result.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
      setGenerating(false)
    }
  }

  const inputCls =
    "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-[560px] max-h-[90vh] flex flex-col">

        {/* Generating overlay */}
        {generating && (
          <div className="absolute inset-0 bg-white/90 rounded-[20px] z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-lg text-ink-primary">Generating Re-Assessment</p>
              <p className="font-body text-sm text-ink-secondary mt-1">{GEN_MESSAGES[msgIdx]}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-lg text-ink-primary">Generate Re-Assessment</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Class readiness summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#E8F5E9] rounded-[10px] p-3">
              <p className="font-body text-[11px] text-[#2D8A4E] uppercase tracking-wide mb-0.5">Ready for Next Unit</p>
              <p className="font-display font-bold text-xl text-[#2D8A4E]">{readyPct}%</p>
            </div>
            <div className="bg-[#FFEBEE] rounded-[10px] p-3">
              <p className="font-body text-[11px] text-danger-500 uppercase tracking-wide mb-0.5">Need Intervention</p>
              <p className="font-display font-bold text-xl text-danger-500">{interventionPct}%</p>
            </div>
          </div>

          {/* Subtopics */}
          <div>
            <p className="font-display font-semibold text-sm text-ink-primary mb-2">
              Target Subtopics <span className="font-body font-normal text-ink-tertiary text-[12px]">({selected.size} selected)</span>
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {allSubtopics.map(([subtopic, data]) => {
                const c = MASTERY_COLORS[data.level as MasteryLevel]
                const isSelected = selected.has(subtopic)
                return (
                  <label
                    key={subtopic}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-all",
                      isSelected
                        ? "border-primary-500 bg-primary-50"
                        : "border-border-light bg-surface-secondary hover:border-primary-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(subtopic)}
                      className="w-4 h-4 rounded accent-primary-500"
                    />
                    <span className="font-body text-sm text-ink-primary flex-1 truncate">{subtopic}</span>
                    <span className="font-display font-semibold text-[13px]" style={{ color: c.text }}>
                      {data.pct}%
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{ backgroundColor: c.bg, color: c.text }}
                    >
                      {data.level}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Question Count</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(3, Math.min(30, Number(e.target.value))))}
                  className={cn(inputCls, "text-center")}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className={cn(inputCls, "cursor-pointer")}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Science"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Grade Level</label>
              <input
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="e.g. 9"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-light shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button
            variant="gradient"
            onClick={handleGenerate}
            disabled={generating || selected.size === 0}
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function AssessmentDiagnosticPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [report, setReport] = useState<DiagnosticReport | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showReassessModal, setShowReassessModal] = useState(false)

  useEffect(() => {
    Promise.all([api.getAssessment(id), api.getDiagnostics(id)])
      .then(([a, r]) => {
        setAssessment(a)
        setReport(r)
      })
      .catch(() => toast.error("Failed to load assessment"))
      .finally(() => setLoading(false))
  }, [id])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const r = await api.generateDiagnostics(id)
      setReport(r)
      toast.success("Diagnostic report generated!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[1280px] mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}
        </div>
        <Skeleton className="h-64 rounded-[14px]" />
      </div>
    )
  }

  if (!assessment) {
    return <div className="p-8 text-center text-ink-secondary font-body">Assessment not found.</div>
  }

  const criticalCount = report
    ? Object.values(report.subtopic_mastery).filter((s) => s.level === "critical").length
    : 0

  return (
    <div className="p-8 max-w-[1280px] mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/exams")}
        className="flex items-center gap-1.5 text-[13px] font-body text-ink-tertiary hover:text-ink-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Exam Library
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-[28px] text-ink-primary leading-tight">
            {assessment.title}
          </h1>
          <p className="font-body text-sm text-ink-secondary mt-1">
            Diagnostic Report
            {report && (
              <span className="ml-2 text-ink-tertiary">
                · Generated {new Date(report.generated_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => toast.info("Export coming soon")}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> {report ? "Regenerate" : "Generate Report"}</>
            )}
          </Button>
        </div>
      </div>

      {/* No report yet */}
      {!report && !generating && (
        <div className="bg-white rounded-[16px] border border-border-light shadow-card flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
            <BarChart2 className="w-8 h-8 text-primary-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-ink-primary">No diagnostic report yet</p>
            <p className="font-body text-sm text-ink-tertiary mt-1 max-w-[320px]">
              Generate a report after students have submitted their exams to see performance insights.
            </p>
          </div>
          <Button variant="gradient" onClick={handleGenerate} disabled={generating}>
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : "Generate Report"}
          </Button>
        </div>
      )}

      {/* Generating spinner */}
      {generating && !report && (
        <div className="bg-white rounded-[16px] border border-border-light shadow-card flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" strokeWidth={1.75} />
          <p className="font-body text-sm text-ink-secondary">Analyzing student data with AI…</p>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard
              label="Average Score"
              value={`${report.avg_score}%`}
              sub={`${report.student_summaries.length} student${report.student_summaries.length !== 1 ? "s" : ""}`}
              icon={BarChart2}
              color="#0072C6"
            />
            <StatCard
              label="Mastery Rate"
              value={`${report.mastery_rate}%`}
              sub={`${report.student_summaries.filter((s) => s.pct >= 80).length} scored 80%+`}
              icon={CheckCircle2}
              color="#2D8A4E"
            />
            <StatCard
              label="Learning Gaps"
              value={String(criticalCount)}
              sub={criticalCount === 0 ? "No critical gaps" : `critical subtopic${criticalCount !== 1 ? "s" : ""}`}
              icon={Brain}
              color={criticalCount > 0 ? "#E53935" : "#2D8A4E"}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ScoreDistributionChart data={report.score_distribution} />
            <SubtopicHeatmap data={report.subtopic_mastery} />
          </div>

          {/* Reteach + Student table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ReteachPanel topics={report.topics_to_reteach} />
            <StudentTable students={report.student_summaries} />
          </div>

          {/* Class strengths */}
          {report.class_strengths.length > 0 && (
            <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
              <h3 className="font-display font-semibold text-base text-ink-primary mb-3">
                Class Strengths
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.class_strengths.map((s) => (
                  <div
                    key={s.subtopic}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: MASTERY_COLORS.mastered.bg }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: MASTERY_COLORS.mastered.text }} strokeWidth={2} />
                    <span className="font-body text-[13px] font-medium" style={{ color: MASTERY_COLORS.mastered.text }}>
                      {s.subtopic} · {s.avg_pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-3 pb-4">
            <Button variant="gradient" size="lg" onClick={() => setShowReassessModal(true)}>
              <Zap className="w-4 h-4" />
              Generate Re-Assessment
            </Button>
            <Button variant="secondary" size="lg" onClick={() => toast.info("Export coming soon")}>
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </>
      )}

      {/* Re-Assessment Modal */}
      {showReassessModal && report && (
        <ReassessmentModal
          report={report}
          assessmentId={id}
          onClose={() => setShowReassessModal(false)}
          onSuccess={(newId) => {
            setShowReassessModal(false)
            router.push(`/dashboard/exams/create?id=${newId}`)
          }}
        />
      )}
    </div>
  )
}
