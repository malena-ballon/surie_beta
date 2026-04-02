"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
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
  type AssessmentResponses,
  type DiagnosticReport,
  type MasteryLevel,
  type QuestionItem,
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

function ReteachItem({
  topic,
  questions,
}: {
  topic: DiagnosticReport["topics_to_reteach"][number]
  questions: QuestionItem[]
}) {
  const [open, setOpen] = useState(false)
  const c = MASTERY_COLORS[topic.level]
  // Questions tagged with this topic
  const tagged = questions.filter((q) =>
    q.subtopic_tags?.some((tag) => tag.toLowerCase() === topic.subtopic.toLowerCase())
  )

  return (
    <div
      className="rounded-[10px] border-l-4 p-3 pl-4"
      style={{ borderColor: c.border, backgroundColor: c.bg + "66" }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-display font-semibold text-[13px] text-ink-primary">
          {topic.subtopic}
        </span>
        <span className="font-display font-bold text-sm" style={{ color: c.text }}>
          {topic.avg_pct}%
        </span>
      </div>
      <p className="font-body text-[12px] text-ink-secondary mt-1.5 leading-relaxed">
        {topic.misconception}
      </p>
      {tagged.length > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 mt-2 text-[11px] font-medium font-body text-ink-tertiary hover:text-ink-primary transition-colors"
        >
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {tagged.length} related question{tagged.length !== 1 ? "s" : ""}
        </button>
      )}
      {open && tagged.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {tagged.map((q, i) => (
            <div key={q.id} className="text-[11px] font-body text-ink-secondary bg-white/60 rounded-[6px] px-2.5 py-1.5 leading-snug">
              <span className="font-semibold text-ink-tertiary mr-1">Q{i + 1}.</span>
              {q.question_text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReteachPanel({
  topics,
  questions,
}: {
  topics: DiagnosticReport["topics_to_reteach"]
  questions: QuestionItem[]
}) {
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
        {topics.map((t) => (
          <ReteachItem key={t.subtopic} topic={t} questions={questions} />
        ))}
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-[20px] sm:rounded-[20px] shadow-2xl w-full sm:max-w-[560px] h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col">

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

// ── Student Responses tab ──────────────────────────────────────

function StudentResponsesTab({ responses }: { responses: AssessmentResponses; }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const questions = responses.question_analysis

  if (responses.student_responses.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-10 flex flex-col items-center gap-3 text-center">
        <Users className="w-10 h-10 text-ink-tertiary/40" strokeWidth={1.5} />
        <p className="font-display font-semibold text-ink-primary">No submissions yet</p>
        <p className="font-body text-sm text-ink-tertiary">Student responses will appear here once they submit the exam.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {responses.student_responses.map((s) => {
        const pct = s.max_score > 0 ? Math.round((s.total_score ?? 0) / s.max_score * 100) : 0
        const level: MasteryLevel = pct >= 90 ? "mastered" : pct >= 75 ? "good" : pct >= 60 ? "average" : pct >= 40 ? "remedial" : "critical"
        const isOpen = expandedId === s.student_id
        return (
          <div key={s.student_id} className="bg-white rounded-[14px] border border-border-light shadow-card overflow-hidden">
            {/* Row header */}
            <button
              onClick={() => setExpandedId(isOpen ? null : s.student_id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-secondary/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white font-display">
                  {s.student_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[14px] text-ink-primary">{s.student_name}</p>
                <p className="font-body text-[12px] text-ink-tertiary capitalize">{s.status.replace("_", " ")}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="font-display font-bold text-lg text-ink-primary">{s.total_score ?? "—"}/{s.max_score}</p>
                  <p className="font-body text-[11px] text-ink-tertiary">{pct}%</p>
                </div>
                <MasteryBadge level={level} />
                {isOpen ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />}
              </div>
            </button>

            {/* Expanded responses */}
            {isOpen && (
              <div className="border-t border-border-light divide-y divide-border-light">
                {questions.map((q, qi) => {
                  const resp = s.responses.find(r => r.question_id === q.question_id)
                  const answered = resp?.student_answer ?? "(no answer)"
                  const correct = resp?.is_correct
                  return (
                    <div key={q.question_id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                      <span className="font-body text-[11px] text-ink-tertiary shrink-0 mt-0.5 w-8">Q{qi + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-[13px] text-ink-primary leading-snug">{q.question_text}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[12px] font-medium font-body px-2 py-0.5 rounded-[6px]",
                            correct === true ? "bg-green-50 text-green-700" :
                            correct === false ? "bg-red-50 text-red-700" :
                            "bg-surface-secondary text-ink-secondary"
                          )}>
                            {correct === true ? "✓" : correct === false ? "✗" : "–"} {answered}
                          </span>
                          {correct === false && (
                            <span className="text-[12px] font-body text-ink-tertiary">
                              Correct: <span className="font-medium text-ink-secondary">{q.correct_answer}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Question Analysis tab ──────────────────────────────────────

function QuestionAnalysisTab({ responses }: { responses: AssessmentResponses }) {
  if (responses.question_analysis.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-10 text-center">
        <p className="font-body text-sm text-ink-tertiary">No responses to analyze yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {responses.question_analysis.map((q, qi) => {
        const total = q.total_responses
        const pct = q.correct_pct

        // Sort answers by count descending
        const distEntries = Object.entries(q.answer_distribution).sort((a, b) => b[1] - a[1])

        return (
          <div key={q.question_id} className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <span className="shrink-0 w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center text-[12px] font-bold font-display text-primary-600 mt-0.5">
                {qi + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[14px] text-ink-primary leading-snug">{q.question_text}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-body text-ink-tertiary">
                    {total} response{total !== 1 ? "s" : ""}
                  </span>
                  <span className={cn(
                    "text-[11px] font-semibold font-body px-2 py-0.5 rounded-full",
                    pct >= 75 ? "bg-green-50 text-green-700" :
                    pct >= 50 ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  )}>
                    {pct}% correct
                  </span>
                  {q.subtopic_tags?.map(tag => (
                    <span key={tag} className="text-[11px] font-body px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Answer distribution */}
            {total > 0 && (
              <div className="space-y-2">
                {distEntries.map(([answer, count]) => {
                  const barPct = Math.round(count / total * 100)
                  const isCorrect = answer === q.correct_answer ||
                    (q.question_type === "true_false" && answer.toLowerCase() === q.correct_answer.toLowerCase())
                  return (
                    <div key={answer} className="flex items-center gap-3">
                      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                        {isCorrect
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" strokeWidth={2} />
                          : <div className="w-3 h-3 rounded-full border-2 border-border-default" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "font-body text-[13px] truncate",
                            isCorrect ? "font-semibold text-green-700" : "text-ink-secondary"
                          )}>
                            {answer}
                          </span>
                          <span className="font-body text-[12px] text-ink-tertiary shrink-0 ml-2">
                            {count} ({barPct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: isCorrect ? "#4CAF50" : "#9E9E9E",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Correct answer label for non-MCQ */}
            {q.question_type !== "mcq" && q.question_type !== "true_false" && (
              <p className="mt-3 text-[12px] font-body text-ink-tertiary">
                Expected answer: <span className="font-semibold text-ink-secondary">{q.correct_answer}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

const TABS = ["Overview", "Student Responses", "Question Analysis"] as const
type TabName = typeof TABS[number]

export default function AssessmentDiagnosticPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [report, setReport] = useState<DiagnosticReport | null | undefined>(undefined)
  const [responses, setResponses] = useState<AssessmentResponses | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showReassessModal, setShowReassessModal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabName>("Overview")
  const [responsesLoading, setResponsesLoading] = useState(false)

  // Load assessment + report on mount; auto-generate if no report
  useEffect(() => {
    async function load() {
      try {
        const [a, r] = await Promise.all([api.getAssessment(id), api.getDiagnostics(id)])
        setAssessment(a)
        if (r) {
          setReport(r)
        } else {
          // Auto-generate
          setSyncing(true)
          try {
            const generated = await api.generateDiagnostics(id)
            setReport(generated)
          } catch {
            setReport(null)
          } finally {
            setSyncing(false)
          }
        }
      } catch {
        toast.error("Failed to load assessment")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Lazy-load responses when switching to those tabs
  useEffect(() => {
    if ((activeTab === "Student Responses" || activeTab === "Question Analysis") && !responses) {
      setResponsesLoading(true)
      api.getAssessmentResponses(id)
        .then(setResponses)
        .catch(() => toast.error("Failed to load responses"))
        .finally(() => setResponsesLoading(false))
    }
  }, [activeTab, id, responses])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const r = await api.generateDiagnostics(id)
      setReport(r)
      // Also refresh responses if loaded
      if (responses) {
        const r2 = await api.getAssessmentResponses(id)
        setResponses(r2)
      }
      toast.success("Report synced!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-[1280px] mx-auto space-y-6">
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
    <div className="p-4 md:p-8 max-w-[1280px] mx-auto space-y-6">
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
          <h1 className="font-display font-bold text-[24px] md:text-[28px] text-ink-primary leading-tight">
            {assessment.title}
          </h1>
          <p className="font-body text-sm text-ink-secondary mt-1">
            Results & Diagnostics
            {report && (
              <span className="ml-2 text-ink-tertiary">
                · Updated {new Date(report.generated_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => toast.info("Export coming soon")}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync"}</span>
          </Button>
          {report && (
            <Button variant="gradient" size="sm" onClick={() => setShowReassessModal(true)}>
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Re-Assess</span>
            </Button>
          )}
        </div>
      </div>

      {/* Syncing / no report */}
      {syncing && !report && (
        <div className="bg-white rounded-[16px] border border-border-light shadow-card flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" strokeWidth={1.75} />
          <p className="font-body text-sm text-ink-secondary">Analyzing student data…</p>
        </div>
      )}

      {!syncing && !report && (
        <div className="bg-white rounded-[16px] border border-border-light shadow-card flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center">
            <BarChart2 className="w-7 h-7 text-primary-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-display font-semibold text-base text-ink-primary">No data yet</p>
            <p className="font-body text-sm text-ink-tertiary mt-1 max-w-[300px]">
              Once students submit, click Sync to generate the diagnostic report.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {(report || responses) && (
        <>
          <div className="flex items-center bg-surface-secondary rounded-[10px] p-1 gap-0.5 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 h-8 rounded-[8px] text-[13px] font-medium font-body transition-all whitespace-nowrap",
                  activeTab === tab
                    ? "bg-white text-ink-primary shadow-sm"
                    : "text-ink-tertiary hover:text-ink-secondary"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === "Overview" && report && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ScoreDistributionChart data={report.score_distribution} />
                <SubtopicHeatmap data={report.subtopic_mastery} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReteachPanel topics={report.topics_to_reteach} questions={assessment.questions} />
                <StudentTable students={report.student_summaries} />
              </div>

              {report.class_strengths.length > 0 && (
                <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
                  <h3 className="font-display font-semibold text-base text-ink-primary mb-3">Class Strengths</h3>
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
            </div>
          )}

          {/* Student Responses tab */}
          {activeTab === "Student Responses" && (
            responsesLoading
              ? <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-[14px]" />)}</div>
              : responses
              ? <StudentResponsesTab responses={responses} />
              : null
          )}

          {/* Question Analysis tab */}
          {activeTab === "Question Analysis" && (
            responsesLoading
              ? <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-32 rounded-[14px]" />)}</div>
              : responses
              ? <QuestionAnalysisTab responses={responses} />
              : null
          )}
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
