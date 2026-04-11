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
  type TopicGroupDetail,
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

// ── Mastery heatmap — two-level hierarchy ─────────────────────
// Default: one card per parent topic (weakest→strongest).
// Expand a parent to reveal granular subtopic cells.
// Falls back to flat rendering if topicGroups is empty.

function heatmapColor(pct: number) {
  if (pct < 50) return { bg: "#FFEBEE", border: "#EF5350", text: "#C62828" }
  if (pct < 80) return { bg: "#FFF8E1", border: "#FFCA28", text: "#8B7500" }
  return { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32" }
}

function SubtopicCell({
  name,
  pct,
  isActive,
  onClick,
}: {
  name: string
  pct: number
  isActive: boolean
  onClick: () => void
}) {
  const c = heatmapColor(pct)
  const short = name.split(/[\s,–-]+/).slice(0, 2).join(" ")
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 shrink-0 rounded-[8px] border-2 px-2.5 py-2 transition-all min-w-[72px]"
      style={{
        backgroundColor: c.bg,
        borderColor: isActive ? c.border : c.border + "55",
        boxShadow: isActive ? `0 0 0 3px ${c.border}33` : undefined,
      }}
    >
      <span className="font-display font-bold text-lg leading-none" style={{ color: c.text }}>
        {pct}%
      </span>
      <span className="text-[10px] font-body text-center leading-tight line-clamp-2" style={{ color: c.text + "CC" }}>
        {short}
      </span>
    </button>
  )
}

function MasteryHeatmap({
  data,
  topics,
  topicGroups,
}: {
  data: Record<string, { pct: number; level: MasteryLevel }>
  topics: DiagnosticReport["topics_to_reteach"]
  topicGroups: Record<string, TopicGroupDetail>
}) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [activeSubtopic, setActiveSubtopic] = useState<string | null>(null)

  const misconceptionMap = Object.fromEntries(topics.map((t) => [t.subtopic.toLowerCase(), t.misconception]))

  const toggleParent = (parent: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev)
      next.has(parent) ? next.delete(parent) : next.add(parent)
      return next
    })
    setActiveSubtopic(null)
  }

  const useGroups = Object.keys(topicGroups).length > 0
  const legend = (
    <div className="flex items-center gap-3 text-[11px] font-body text-ink-tertiary flex-wrap">
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#EF5350] inline-block" /> &lt;50% · Reteach</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#FFCA28] inline-block" /> 50–79% · Partial</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#66BB6A] inline-block" /> 80%+ · Strong</span>
    </div>
  )

  if (!useGroups) {
    // ── Flat fallback (no topic groups) ──
    const sorted = Object.entries(data).sort((a, b) => a[1].pct - b[1].pct)
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-display font-semibold text-base text-ink-primary">Subtopic Mastery</h3>
          {legend}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {sorted.map(([name, { pct }]) => (
            <SubtopicCell
              key={name}
              name={name}
              pct={pct}
              isActive={activeSubtopic === name}
              onClick={() => setActiveSubtopic(activeSubtopic === name ? null : name)}
            />
          ))}
        </div>
        {activeSubtopic && data[activeSubtopic] && (
          <div className="mt-3 px-4 py-3 rounded-[10px] border" style={{ backgroundColor: heatmapColor(data[activeSubtopic].pct).bg, borderColor: heatmapColor(data[activeSubtopic].pct).border + "55" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-semibold text-[13px] text-ink-primary">{activeSubtopic}</span>
              <span className="font-display font-bold text-[13px]" style={{ color: heatmapColor(data[activeSubtopic].pct).text }}>{data[activeSubtopic].pct}% class avg</span>
            </div>
            {misconceptionMap[activeSubtopic.toLowerCase()]
              ? <p className="text-[12px] font-body text-ink-secondary leading-relaxed">{misconceptionMap[activeSubtopic.toLowerCase()]}</p>
              : <p className="text-[12px] font-body text-ink-tertiary">No misconception note for this subtopic.</p>}
          </div>
        )}
      </div>
    )
  }

  // ── Two-level grouped view ──
  const sortedParents = Object.entries(topicGroups).sort((a, b) => a[1].avg_pct - b[1].avg_pct)

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-display font-semibold text-base text-ink-primary">Subtopic Mastery</h3>
        {legend}
      </div>

      <div className="space-y-2">
        {sortedParents.map(([parent, group]) => {
          const c = heatmapColor(group.avg_pct)
          const isExpanded = expandedParents.has(parent)
          const sortedChildren = Object.entries(group.subtopics).sort((a, b) => a[1].pct - b[1].pct)

          return (
            <div key={parent} className="rounded-[10px] border-2 overflow-hidden transition-all" style={{ borderColor: isExpanded ? c.border : c.border + "44" }}>
              {/* Parent topic row */}
              <button
                onClick={() => toggleParent(parent)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left"
                style={{ backgroundColor: c.bg }}
              >
                <span className="font-display font-bold text-xl leading-none w-14 shrink-0" style={{ color: c.text }}>
                  {group.avg_pct}%
                </span>
                <span className="font-display font-semibold text-[13px] flex-1 text-ink-primary">{parent}</span>
                <span className="text-[11px] font-body text-ink-tertiary shrink-0">{sortedChildren.length} subtopic{sortedChildren.length !== 1 ? "s" : ""}</span>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: c.text }} />
                  : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: c.text }} />
                }
              </button>

              {/* Expanded: child subtopic cells */}
              {isExpanded && (
                <div className="px-3.5 pb-3 pt-2 border-t" style={{ borderColor: c.border + "33", backgroundColor: c.bg + "55" }}>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {sortedChildren.map(([name, { pct }]) => (
                      <SubtopicCell
                        key={name}
                        name={name}
                        pct={pct}
                        isActive={activeSubtopic === name}
                        onClick={() => setActiveSubtopic(activeSubtopic === name ? null : name)}
                      />
                    ))}
                  </div>
                  {/* Misconception detail for active subtopic within this parent */}
                  {activeSubtopic && group.subtopics[activeSubtopic] && (
                    <div className="mt-2 px-3.5 py-2.5 rounded-[8px] border bg-white" style={{ borderColor: heatmapColor(group.subtopics[activeSubtopic].pct).border + "55" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-display font-semibold text-[12px] text-ink-primary">{activeSubtopic}</span>
                        <span className="font-display font-bold text-[12px]" style={{ color: heatmapColor(group.subtopics[activeSubtopic].pct).text }}>{group.subtopics[activeSubtopic].pct}% avg</span>
                      </div>
                      {misconceptionMap[activeSubtopic.toLowerCase()]
                        ? <p className="text-[12px] font-body text-ink-secondary leading-relaxed">{misconceptionMap[activeSubtopic.toLowerCase()]}</p>
                        : <p className="text-[12px] font-body text-ink-tertiary">No misconception note for this subtopic.</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── At-Risk Alerts ─────────────────────────────────────────────
// Shows only at-risk students with trend label + top weak subtopics + re-assess action.

// Returns the parent topic name for a subtopic, or the subtopic itself as fallback
function parentOf(subtopic: string, topicGroups: Record<string, TopicGroupDetail>): string {
  for (const [parent, group] of Object.entries(topicGroups)) {
    if (Object.keys(group.subtopics).includes(subtopic)) return parent
  }
  return subtopic
}

// Deduplicates while preserving order
function dedupe<T>(arr: T[]): T[] {
  return arr.filter((v, i, a) => a.indexOf(v) === i)
}

function AtRiskPanel({
  students,
  onReassess,
  topicGroups,
}: {
  students: StudentSummary[]
  onReassess: (subtopics: string[]) => void
  topicGroups: Record<string, TopicGroupDetail>
}) {
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())
  const atRisk = students.filter((s) => s.at_risk)
  if (atRisk.length === 0) return null

  const useGroups = Object.keys(topicGroups).length > 0

  const toggleStudent = (id: string) =>
    setExpandedStudents((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="bg-white rounded-[14px] border border-[#FFCDD2] shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-danger-500" strokeWidth={2} />
        <h3 className="font-display font-semibold text-base text-ink-primary">At-Risk Students</h3>
        <span className="ml-0.5 text-[13px] font-body text-danger-500 font-semibold">
          · {atRisk.length} flagged
        </span>
      </div>

      <div className="space-y-3">
        {atRisk.map((s) => {
          const weakSubtopics = Object.entries(s.subtopics)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 5)

          // Show parent topic labels when groups are available; fall back to subtopic names
          const weakLabels = useGroups
            ? dedupe(weakSubtopics.map(([name]) => parentOf(name, topicGroups))).slice(0, 3)
            : weakSubtopics.slice(0, 3).map(([name]) => name)

          const trendLabel =
            s.pct < 40 ? "Critical — well below passing" :
            s.pct < 60 ? "Below passing threshold" :
            "Just below class average"
          const trendColor =
            s.pct < 40 ? "#C62828" : s.pct < 60 ? "#E65100" : "#8B7500"

          const isExpanded = expandedStudents.has(s.student_id)

          return (
            <div key={s.student_id} className="rounded-[10px] border border-[#FFCDD2] bg-[#FFEBEE]/30 overflow-hidden">
              <div className="flex items-start gap-3 p-3.5">
                <div className="w-9 h-9 rounded-full bg-[#FFCDD2] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-danger-700 font-display">
                    {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-display font-semibold text-[14px] text-ink-primary">{s.name}</span>
                    <span className="font-body text-[11px] font-semibold" style={{ color: trendColor }}>{trendLabel}</span>
                  </div>
                  <p className="font-body text-[12px] text-ink-secondary">
                    Score: <span className="font-semibold text-ink-primary">{s.score ?? "—"}/{s.max_score} ({s.pct}%)</span>
                  </p>
                  {weakLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                      <span className="text-[11px] font-body text-ink-tertiary">Weak in:</span>
                      {weakLabels.map((label) => (
                        <span key={label} className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full bg-[#FFEBEE] text-danger-700">
                          {label}
                        </span>
                      ))}
                      {useGroups && weakSubtopics.length > 0 && (
                        <button
                          onClick={() => toggleStudent(s.student_id)}
                          className="text-[11px] font-body text-ink-tertiary hover:text-ink-primary transition-colors"
                        >
                          {isExpanded ? "hide detail" : "see subtopics"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onReassess(weakSubtopics.map(([name]) => name))}
                  className="shrink-0 px-3 py-1.5 rounded-[8px] bg-primary-500 hover:bg-primary-600 text-white text-[11px] font-semibold font-body transition-colors"
                >
                  Re-Assess
                </button>
              </div>

              {/* Granular subtopic detail (expanded) */}
              {isExpanded && weakSubtopics.length > 0 && (
                <div className="border-t border-[#FFCDD2]/50 px-3.5 pb-3 pt-2 flex flex-wrap gap-1.5">
                  {weakSubtopics.map(([name, pct]) => (
                    <span key={name} className="text-[11px] font-body px-2 py-0.5 rounded-full bg-white border border-[#FFCDD2] text-danger-700">
                      {name} · {pct}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Reteach panel — misconception in teacher language ──────────

function ReteachItem({
  topic,
  questions,
  responses,
}: {
  topic: DiagnosticReport["topics_to_reteach"][number]
  questions: QuestionItem[]
  responses: AssessmentResponses | null
}) {
  const [open, setOpen] = useState(false)
  const c = MASTERY_COLORS[topic.level]

  const tagged = questions.filter((q) =>
    q.subtopic_tags?.some((tag) => tag.toLowerCase() === topic.subtopic.toLowerCase())
  )

  // Build a teacher-language distractor sentence from question analysis
  let distractorSentence: string | null = null
  if (responses) {
    for (const q of tagged) {
      const qa = responses.question_analysis.find((r) => r.question_id === q.id)
      if (!qa || qa.total_responses === 0) continue

      if (qa.question_type === "mcq" && qa.choices) {
        const topWrong = Object.entries(qa.answer_distribution)
          .filter(([ans]) => ans !== qa.correct_answer)
          .sort((a, b) => b[1] - a[1])[0]
        if (topWrong && topWrong[1] > 0) {
          const wrongChoice = qa.choices.find((ch) => ch.label === topWrong[0])
          if (wrongChoice) {
            distractorSentence = `Common mistake: Students chose "${wrongChoice.text}" (${topWrong[1]} out of ${qa.total_responses} students).`
            break
          }
        }
      } else if (qa.question_type === "true_false") {
        const wrongAns = qa.correct_answer === "True" ? "False" : "True"
        const wrongCount = qa.answer_distribution[wrongAns] ?? 0
        if (wrongCount > 0) {
          distractorSentence = `Common mistake: ${wrongCount} out of ${qa.total_responses} students answered "${wrongAns}" when the answer is "${qa.correct_answer}".`
          break
        }
      }
    }
  }

  const explanation = tagged.find((q) => q.explanation)?.explanation

  return (
    <div
      className="rounded-[10px] border-l-4 p-4 space-y-2"
      style={{ borderColor: c.border, backgroundColor: c.bg + "55" }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-display font-semibold text-[13px] text-ink-primary">{topic.subtopic}</span>
        <span className="font-display font-bold text-sm" style={{ color: c.text }}>{topic.avg_pct}% avg</span>
      </div>

      {/* Misconception — already written in teacher language by AI */}
      <p className="font-body text-[13px] text-ink-secondary leading-relaxed">{topic.misconception}</p>

      {/* Distractor count sentence */}
      {distractorSentence && (
        <div className="flex items-start gap-2 text-[12px] font-body text-amber-800 bg-amber-50 rounded-[8px] px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" strokeWidth={2} />
          <span>{distractorSentence}</span>
        </div>
      )}

      {(explanation || tagged.length > 0) && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[11px] font-medium font-body text-ink-tertiary hover:text-ink-primary transition-colors"
        >
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {open ? "Hide" : "Show"} explanation
          {tagged.length > 0 && ` · ${tagged.length} related question${tagged.length !== 1 ? "s" : ""}`}
        </button>
      )}

      {open && (
        <div className="space-y-2">
          {explanation && (
            <div className="text-[12px] font-body text-ink-secondary bg-white/80 rounded-[8px] px-3 py-2.5 leading-relaxed border border-border-light">
              <p className="font-semibold text-[10px] text-ink-tertiary uppercase tracking-wide mb-1">
                Correct Explanation
              </p>
              {explanation}
            </div>
          )}
          {tagged.map((q, i) => (
            <div
              key={q.id}
              className="text-[11px] font-body text-ink-secondary bg-white/60 rounded-[6px] px-2.5 py-1.5 leading-snug"
            >
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
  responses,
  topicGroups,
}: {
  topics: DiagnosticReport["topics_to_reteach"]
  questions: QuestionItem[]
  responses: AssessmentResponses | null
  topicGroups: Record<string, TopicGroupDetail>
}) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

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

  const useGroups = Object.keys(topicGroups).length > 0

  if (!useGroups) {
    // Flat fallback
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
        <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Topics to Reteach</h3>
        <div className="space-y-3">
          {topics.map((t) => (
            <ReteachItem key={t.subtopic} topic={t} questions={questions} responses={responses} />
          ))}
        </div>
      </div>
    )
  }

  // Group reteach items by parent topic
  const grouped: Record<string, DiagnosticReport["topics_to_reteach"]> = {}
  for (const topic of topics) {
    const parent = parentOf(topic.subtopic, topicGroups)
    if (!grouped[parent]) grouped[parent] = []
    grouped[parent].push(topic)
  }

  // Sort parents by their min avg_pct (worst first)
  const sortedParents = Object.entries(grouped).sort(
    (a, b) => Math.min(...a[1].map((t) => t.avg_pct)) - Math.min(...b[1].map((t) => t.avg_pct))
  )

  const toggleParent = (parent: string) =>
    setExpandedParents((prev) => {
      const next = new Set(prev)
      next.has(parent) ? next.delete(parent) : next.add(parent)
      return next
    })

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Topics to Reteach</h3>
      <div className="space-y-2">
        {sortedParents.map(([parent, parentTopics]) => {
          const avgPct = Math.round(parentTopics.reduce((sum, t) => sum + t.avg_pct, 0) / parentTopics.length)
          const c = MASTERY_COLORS[parentTopics[0].level] // use worst item's color
          const isExpanded = expandedParents.has(parent)

          return (
            <div key={parent} className="rounded-[10px] border overflow-hidden" style={{ borderColor: c.border + "55" }}>
              <button
                onClick={() => toggleParent(parent)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-90"
                style={{ backgroundColor: c.bg + "55" }}
              >
                <span className="font-display font-bold text-[15px] flex-1 text-ink-primary">{parent}</span>
                <span className="font-display font-semibold text-[13px]" style={{ color: c.text }}>{avgPct}% avg</span>
                <span className="text-[11px] font-body text-ink-tertiary">{parentTopics.length} subtopic{parentTopics.length !== 1 ? "s" : ""}</span>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 shrink-0 text-ink-tertiary" />
                  : <ChevronDown className="w-4 h-4 shrink-0 text-ink-tertiary" />
                }
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t" style={{ borderColor: c.border + "33" }}>
                  {parentTopics.map((t) => (
                    <ReteachItem key={t.subtopic} topic={t} questions={questions} responses={responses} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Student Cluster View ───────────────────────────────────────
// Default: groups students who share the same weak subtopics.
// Click to expand a cluster and see individual students.

function StudentClusterView({
  students,
  topicGroups,
}: {
  students: StudentSummary[]
  topicGroups: Record<string, TopicGroupDetail>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
        <h3 className="font-display font-semibold text-base text-ink-primary mb-2">Student Groups by Gap</h3>
        <p className="font-body text-sm text-ink-tertiary">No student data yet.</p>
      </div>
    )
  }

  const useGroups = Object.keys(topicGroups).length > 0

  // Group by weak parent topics (when groups available) or weak subtopics (fallback)
  const clusters: Record<string, { subtopics: string[]; students: StudentSummary[] }> = {}
  const noGap: StudentSummary[] = []

  students.forEach((s) => {
    const weakSubtopics = Object.entries(s.subtopics)
      .filter(([, pct]) => pct < 60)
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name)

    if (weakSubtopics.length === 0) {
      noGap.push(s)
      return
    }

    // Use parent topic names for clustering label when groups are available
    const weak = useGroups
      ? dedupe(weakSubtopics.map((name) => parentOf(name, topicGroups)))
      : weakSubtopics

    const key = weak.join("|")
    if (!clusters[key]) clusters[key] = { subtopics: weak, students: [] }
    clusters[key].students.push(s)
  })

  const clusterList = Object.entries(clusters).sort((a, b) => b[1].students.length - a[1].students.length)

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border-light flex items-center gap-2">
        <Users className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
        <h3 className="font-display font-semibold text-base text-ink-primary">Student Groups by Gap</h3>
      </div>

      <div className="divide-y divide-border-light">
        {clusterList.map(([key, cluster]) => {
          const isOpen = expanded.has(key)
          return (
            <div key={key}>
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-start gap-3 px-5 py-4 hover:bg-surface-secondary/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-display font-bold text-[13px] text-amber-700">
                    {cluster.students.length}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[13px] text-ink-primary leading-snug">
                    <span className="font-semibold">
                      {cluster.students.length} student{cluster.students.length !== 1 ? "s" : ""}
                    </span>{" "}
                    share weakness in
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {cluster.subtopics.slice(0, 4).map((sub) => (
                      <span
                        key={sub}
                        className="text-[11px] font-medium font-body px-2 py-0.5 rounded-full bg-[#FFEBEE] text-danger-700"
                      >
                        {sub}
                      </span>
                    ))}
                    {cluster.subtopics.length > 4 && (
                      <span className="text-[11px] font-body text-ink-tertiary px-1">
                        +{cluster.subtopics.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-ink-tertiary shrink-0 mt-1" />
                  : <ChevronDown className="w-4 h-4 text-ink-tertiary shrink-0 mt-1" />
                }
              </button>

              {isOpen && (
                <div className="bg-surface-secondary/40 border-t border-border-light divide-y divide-border-light/60">
                  {cluster.students.map((s) => (
                    <div key={s.student_id} className="flex items-center gap-3 px-5 py-3">
                      <span className="font-body text-[13px] text-ink-primary flex-1">{s.name}</span>
                      <span className="font-display font-semibold text-[13px] text-ink-secondary">
                        {s.score ?? "—"}/{s.max_score}
                      </span>
                      <MasteryBadge level={s.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {noGap.length > 0 && (
          <div>
            <button
              onClick={() => toggle("__no_gap__")}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-secondary/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                <span className="font-display font-bold text-[13px] text-green-700">{noGap.length}</span>
              </div>
              <p className="font-body text-[13px] text-ink-primary flex-1">
                <span className="font-semibold">{noGap.length} student{noGap.length !== 1 ? "s" : ""}</span>{" "}
                have no critical gaps
              </p>
              {expanded.has("__no_gap__")
                ? <ChevronUp className="w-4 h-4 text-ink-tertiary" />
                : <ChevronDown className="w-4 h-4 text-ink-tertiary" />
              }
            </button>

            {expanded.has("__no_gap__") && (
              <div className="bg-green-50/30 border-t border-border-light divide-y divide-border-light/60">
                {noGap.map((s) => (
                  <div key={s.student_id} className="flex items-center gap-3 px-5 py-3">
                    <span className="font-body text-[13px] text-ink-primary flex-1">{s.name}</span>
                    <span className="font-display font-semibold text-[13px] text-ink-secondary">
                      {s.score ?? "—"}/{s.max_score}
                    </span>
                    <MasteryBadge level={s.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
  preselectedSubtopics,
}: {
  report: DiagnosticReport
  assessmentId: string
  onClose: () => void
  onSuccess: (newId: string) => void
  preselectedSubtopics?: string[]
}) {
  const allSubtopics = Object.entries(report.subtopic_mastery).sort((a, b) => a[1].pct - b[1].pct)
  const defaultSelected = preselectedSubtopics?.length
    ? preselectedSubtopics
    : allSubtopics.filter(([, d]) => d.pct < 60).map(([s]) => s)

  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelected.length ? defaultSelected : allSubtopics.slice(0, 3).map(([s]) => s))
  )
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
      Math.max(1, report.student_summaries.length)) * 100
  )

  const handleGenerate = async () => {
    if (selected.size === 0) { toast.error("Select at least one subtopic"); return }
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

        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-lg text-ink-primary">Generate Re-Assessment</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
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

          <div>
            <p className="font-display font-semibold text-sm text-ink-primary mb-2">
              Target Subtopics{" "}
              <span className="font-body font-normal text-ink-tertiary text-[12px]">({selected.size} selected)</span>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Question Count</label>
              <input
                type="number"
                min={3}
                max={30}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(3, Math.min(30, Number(e.target.value))))}
                className={cn(inputCls, "text-center")}
              />
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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-light shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button
            variant="gradient"
            onClick={handleGenerate}
            disabled={generating || selected.size === 0}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Zap className="w-4 h-4" /> Generate</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Student Responses tab ──────────────────────────────────────

function StudentResponsesTab({ responses }: { responses: AssessmentResponses }) {
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
            <button
              onClick={() => setExpandedId(isOpen ? null : s.student_id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-secondary/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white font-display">
                  {s.student_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
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

            {isOpen && (
              <div className="border-t border-border-light divide-y divide-border-light">
                {questions.map((q, qi) => {
                  const resp = s.responses.find((r) => r.question_id === q.question_id)
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
        const distEntries = Object.entries(q.answer_distribution).sort((a, b) => b[1] - a[1])

        return (
          <div key={q.question_id} className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
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
                  {q.subtopic_tags?.map((tag) => (
                    <span key={tag} className="text-[11px] font-body px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

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
                            style={{ width: `${barPct}%`, backgroundColor: isCorrect ? "#4CAF50" : "#9E9E9E" }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

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

// ── Class Strengths — grouped by parent topic ──────────────────

function ClassStrengths({
  classStrengths,
  topicGroups,
}: {
  classStrengths: DiagnosticReport["class_strengths"]
  topicGroups: Record<string, TopicGroupDetail>
}) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  if (classStrengths.length === 0) return null

  const c = MASTERY_COLORS.mastered
  const useGroups = Object.keys(topicGroups).length > 0

  const toggleParent = (parent: string) =>
    setExpandedParents((prev) => {
      const next = new Set(prev)
      next.has(parent) ? next.delete(parent) : next.add(parent)
      return next
    })

  if (!useGroups) {
    // Flat fallback
    return (
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
        <h3 className="font-display font-semibold text-base text-ink-primary mb-3">Class Strengths</h3>
        <div className="flex flex-wrap gap-2">
          {classStrengths.map((s) => (
            <div key={s.subtopic} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: c.bg }}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: c.text }} strokeWidth={2} />
              <span className="font-body text-[13px] font-medium" style={{ color: c.text }}>{s.subtopic} · {s.avg_pct}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Group strong subtopics by parent topic
  const grouped: Record<string, { subtopic: string; avg_pct: number }[]> = {}
  for (const s of classStrengths) {
    const parent = parentOf(s.subtopic, topicGroups)
    if (!grouped[parent]) grouped[parent] = []
    grouped[parent].push(s)
  }

  // A parent topic is a strength if its overall avg_pct > 85
  const strongParents = Object.entries(grouped).filter(([parent]) => {
    const group = topicGroups[parent]
    return group && group.avg_pct > 85
  })

  if (strongParents.length === 0 && classStrengths.length === 0) return null

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-3">Class Strengths</h3>

      {/* Parent topic chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(grouped).map(([parent, subtopics]) => {
          const group = topicGroups[parent]
          const parentPct = group ? group.avg_pct : Math.round(subtopics.reduce((s, t) => s + t.avg_pct, 0) / subtopics.length)
          const isExpanded = expandedParents.has(parent)
          return (
            <button
              key={parent}
              onClick={() => toggleParent(parent)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all"
              style={{ backgroundColor: c.bg, outline: isExpanded ? `2px solid ${c.border}` : undefined }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: c.text }} strokeWidth={2} />
              <span className="font-body text-[13px] font-medium" style={{ color: c.text }}>{parent} · {parentPct}%</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" style={{ color: c.text }} /> : <ChevronDown className="w-3 h-3" style={{ color: c.text }} />}
            </button>
          )
        })}
      </div>

      {/* Expanded: granular subtopics for the active parent */}
      {Object.entries(grouped).map(([parent, subtopics]) =>
        expandedParents.has(parent) ? (
          <div key={parent} className="mt-1 mb-2 pl-3 border-l-2 flex flex-wrap gap-2" style={{ borderColor: c.border + "55" }}>
            {subtopics.map((s) => (
              <span key={s.subtopic} className="text-[12px] font-body px-2.5 py-1 rounded-full border" style={{ backgroundColor: c.bg + "55", borderColor: c.border + "44", color: c.text }}>
                {s.subtopic} · {s.avg_pct}%
              </span>
            ))}
          </div>
        ) : null
      )}
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
  const [reassessSubtopics, setReassessSubtopics] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<TabName>("Overview")
  const [responsesLoading, setResponsesLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [a, r] = await Promise.all([api.getAssessment(id), api.getDiagnostics(id)])
        setAssessment(a)

        // Load responses upfront — needed for misconception distractor counts in Overview
        api.getAssessmentResponses(id).then(setResponses).catch(() => {})

        if (r) {
          setReport(r)
        } else {
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

  // Still lazy-load for tab switches if not yet loaded
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
      const r2 = await api.getAssessmentResponses(id)
      setResponses(r2)
      toast.success("Report synced!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const openReassessFor = (subtopics: string[]) => {
    setReassessSubtopics(subtopics)
    setShowReassessModal(true)
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

  const topicGroups = report?.topic_groups ?? {}
  const hasGroups = Object.keys(topicGroups).length > 0

  // Count critical gaps at parent topic level when hierarchy is available
  const criticalCount = report
    ? hasGroups
      ? Object.values(topicGroups).filter((g) => g.level === "critical").length
      : Object.values(report.subtopic_mastery).filter((s) => s.level === "critical").length
    : 0
  const criticalLabel = hasGroups
    ? `critical topic${criticalCount !== 1 ? "s" : ""}`
    : `critical subtopic${criticalCount !== 1 ? "s" : ""}`

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
            <Button variant="gradient" size="sm" onClick={() => openReassessFor([])}>
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Re-Assess</span>
            </Button>
          )}
        </div>
      </div>

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

      {(report || responses) && (
        <>
          {/* Tabs */}
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

          {/* ── Overview tab ── */}
          {activeTab === "Overview" && report && (
            <div className="space-y-5">

              {/* Stat cards */}
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
                  sub={criticalCount === 0 ? "No critical gaps" : criticalLabel}
                  icon={Brain}
                  color={criticalCount > 0 ? "#E53935" : "#2D8A4E"}
                />
              </div>

              {/* At-risk alerts — full width, prominent */}
              <AtRiskPanel
                students={report.student_summaries}
                onReassess={openReassessFor}
                topicGroups={topicGroups}
              />

              {/* Score distribution + Mastery heatmap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ScoreDistributionChart data={report.score_distribution} />
                <MasteryHeatmap
                  data={report.subtopic_mastery}
                  topics={report.topics_to_reteach}
                  topicGroups={topicGroups}
                />
              </div>

              {/* Reteach panel + Student cluster view */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReteachPanel
                  topics={report.topics_to_reteach}
                  questions={assessment.questions}
                  responses={responses}
                  topicGroups={topicGroups}
                />
                <StudentClusterView
                  students={report.student_summaries}
                  topicGroups={topicGroups}
                />
              </div>

              {/* Class strengths — grouped by parent topic when hierarchy is available */}
              <ClassStrengths
                classStrengths={report.class_strengths}
                topicGroups={topicGroups}
              />
            </div>
          )}

          {/* ── Student Responses tab ── */}
          {activeTab === "Student Responses" && (
            responsesLoading
              ? <div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-16 rounded-[14px]" />)}</div>
              : responses
              ? <StudentResponsesTab responses={responses} />
              : null
          )}

          {/* ── Question Analysis tab ── */}
          {activeTab === "Question Analysis" && (
            responsesLoading
              ? <div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-32 rounded-[14px]" />)}</div>
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
          preselectedSubtopics={reassessSubtopics}
          onClose={() => { setShowReassessModal(false); setReassessSubtopics([]) }}
          onSuccess={(newId) => {
            setShowReassessModal(false)
            setReassessSubtopics([])
            router.push(`/dashboard/exams/create?id=${newId}`)
          }}
        />
      )}
    </div>
  )
}
