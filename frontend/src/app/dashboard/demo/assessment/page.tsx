"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Users,
  BarChart2,
  Brain,
  ChevronDown,
  ChevronUp,
  TrendingDown,
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

// ── Design tokens ──────────────────────────────────────────────

type MasteryLevel = "critical" | "remedial" | "average" | "good" | "mastered"

const MASTERY_COLORS: Record<MasteryLevel, { bg: string; text: string; bar: string; border: string }> = {
  critical:  { bg: "#FFEBEE", text: "#C62828", bar: "#EF5350", border: "#EF5350" },
  remedial:  { bg: "#FFF3E0", text: "#E65100", bar: "#FFA726", border: "#FFA726" },
  average:   { bg: "#FFF8E1", text: "#F57F17", bar: "#FFCA28", border: "#FFCA28" },
  good:      { bg: "#E8F5E9", text: "#2E7D32", bar: "#66BB6A", border: "#66BB6A" },
  mastered:  { bg: "#E3F2FD", text: "#1565C0", bar: "#42A5F5", border: "#42A5F5" },
}

const BAND_COLORS: Record<string, string> = {
  "0–59":   "#EF5350",
  "60–69":  "#FFA726",
  "70–79":  "#FFCA28",
  "80–89":  "#66BB6A",
  "90–100": "#42A5F5",
}

function masteryLevel(pct: number): MasteryLevel {
  if (pct < 40) return "critical"
  if (pct < 60) return "remedial"
  if (pct < 75) return "average"
  if (pct < 90) return "good"
  return "mastered"
}

function heatmapColor(pct: number) {
  if (pct < 50) return { bg: "#FFEBEE", border: "#EF5350", text: "#C62828" }
  if (pct < 80) return { bg: "#FFF8E1", border: "#FFCA28", text: "#8B7500" }
  return { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32" }
}

// ── Hardcoded demo data ────────────────────────────────────────

const SCORE_DIST = [
  { band: "0–59", count: 3 },
  { band: "60–69", count: 2 },
  { band: "70–79", count: 4 },
  { band: "80–89", count: 10 },
  { band: "90–100", count: 16 },
]

const TOPIC_GROUPS = [
  {
    parent: "Linear Equations",
    avg_pct: 91,
    subtopics: [
      { name: "Solving for x", pct: 94 },
      { name: "One-step equations", pct: 91 },
      { name: "Two-step equations", pct: 88 },
    ],
  },
  {
    parent: "Quadratic Equations",
    avg_pct: 76,
    subtopics: [
      { name: "Standard form", pct: 82 },
      { name: "Factoring", pct: 76 },
      { name: "Quadratic formula", pct: 71 },
    ],
  },
  {
    parent: "Systems of Equations",
    avg_pct: 63,
    subtopics: [
      { name: "Substitution method", pct: 68 },
      { name: "Elimination method", pct: 63 },
      { name: "Graphical method", pct: 59 },
    ],
  },
]

const RETEACH_TOPICS = [
  {
    parent: "Systems of Equations",
    avg_pct: 63,
    level: "remedial" as MasteryLevel,
    subtopics: [
      {
        name: "Graphical method",
        pct: 59,
        level: "remedial" as MasteryLevel,
        misconception:
          "Students struggle to identify the intersection point when both lines have negative slopes. Many incorrectly plot the y-intercept on the wrong side of the axis.",
        commonMistake: "Common mistake: 14 out of 35 students chose an incorrect intersection point when lines crossed in the third quadrant.",
      },
      {
        name: "Elimination method",
        pct: 63,
        level: "remedial" as MasteryLevel,
        misconception:
          "Students frequently swap signs incorrectly when multiplying equations to match coefficients. The negative sign distribution error is especially common in two-digit coefficient problems.",
        commonMistake: "Common mistake: 11 out of 35 students chose an answer with a sign error in the final variable.",
      },
    ],
  },
  {
    parent: "Quadratic Equations",
    avg_pct: 76,
    level: "average" as MasteryLevel,
    subtopics: [
      {
        name: "Quadratic formula",
        pct: 71,
        level: "average" as MasteryLevel,
        misconception:
          "Students make computation errors with the discriminant (b² − 4ac), especially when b is negative. Many fail to square the negative value correctly before subtracting 4ac.",
        commonMistake: "Common mistake: 9 out of 35 students computed b² as a negative value instead of squaring it.",
      },
    ],
  },
]

const AT_RISK_STUDENTS = [
  {
    id: "s1",
    name: "Juan dela Cruz",
    score: 13,
    max_score: 35,
    pct: 37,
    level: "critical" as MasteryLevel,
    weakIn: ["Systems of Equations", "Quadratic Equations"],
    subtopics: [
      { name: "Graphical method", pct: 20 },
      { name: "Elimination method", pct: 27 },
      { name: "Quadratic formula", pct: 35 },
      { name: "Factoring", pct: 40 },
    ],
  },
  {
    id: "s2",
    name: "Carlos Mendoza",
    score: 15,
    max_score: 35,
    pct: 43,
    level: "remedial" as MasteryLevel,
    weakIn: ["Systems of Equations", "Quadratic Equations"],
    subtopics: [
      { name: "Graphical method", pct: 30 },
      { name: "Elimination method", pct: 40 },
      { name: "Quadratic formula", pct: 45 },
    ],
  },
  {
    id: "s3",
    name: "Pedro Bautista",
    score: 18,
    max_score: 35,
    pct: 51,
    level: "remedial" as MasteryLevel,
    weakIn: ["Systems of Equations"],
    subtopics: [
      { name: "Graphical method", pct: 40 },
      { name: "Elimination method", pct: 50 },
      { name: "Substitution method", pct: 55 },
    ],
  },
]

// Clustered student groups for the bottom table
const STUDENT_CLUSTERS = [
  {
    key: "cluster-1",
    label: "Systems of Equations + Quadratic Equations",
    count: 3,
    students: [
      { name: "Juan dela Cruz",   score: "13/35", level: "critical" as MasteryLevel },
      { name: "Carlos Mendoza",   score: "15/35", level: "remedial" as MasteryLevel },
      { name: "Pedro Bautista",   score: "18/35", level: "remedial" as MasteryLevel },
    ],
  },
  {
    key: "cluster-2",
    label: "Quadratic Equations only",
    count: 7,
    students: [
      { name: "Sofia Villanueva", score: "24/35", level: "average" as MasteryLevel },
      { name: "Andres Torres",    score: "25/35", level: "average" as MasteryLevel },
      { name: "Grace Navarro",    score: "26/35", level: "average" as MasteryLevel },
      { name: "Mark Castillo",    score: "24/35", level: "average" as MasteryLevel },
      { name: "Lea Aquino",       score: "25/35", level: "average" as MasteryLevel },
      { name: "Rico Gomez",       score: "26/35", level: "average" as MasteryLevel },
      { name: "Tina Soriano",     score: "27/35", level: "average" as MasteryLevel },
    ],
  },
  {
    key: "no-gap",
    label: "no critical gaps",
    count: 25,
    noGap: true,
    students: [
      { name: "Maria Santos",    score: "32/35", level: "mastered" as MasteryLevel },
      { name: "Jose Reyes",      score: "33/35", level: "mastered" as MasteryLevel },
      { name: "Ana Garcia",      score: "35/35", level: "mastered" as MasteryLevel },
      { name: "Luis Fernandez",  score: "31/35", level: "mastered" as MasteryLevel },
      { name: "Rosa Mendez",     score: "30/35", level: "mastered" as MasteryLevel },
      { name: "Diego Ramos",     score: "29/35", level: "good" as MasteryLevel },
      { name: "Elena Cruz",      score: "31/35", level: "mastered" as MasteryLevel },
      { name: "Marco Santos",    score: "32/35", level: "mastered" as MasteryLevel },
      { name: "Carla Reyes",     score: "33/35", level: "mastered" as MasteryLevel },
      { name: "Noel Flores",     score: "30/35", level: "mastered" as MasteryLevel },
      { name: "Bianca Lopez",    score: "29/35", level: "good" as MasteryLevel },
      { name: "Paolo Dela Cruz", score: "31/35", level: "mastered" as MasteryLevel },
      { name: "Jenny Bautista",  score: "30/35", level: "mastered" as MasteryLevel },
      { name: "Kevin Morales",   score: "32/35", level: "mastered" as MasteryLevel },
      { name: "Trish Ocampo",    score: "29/35", level: "good" as MasteryLevel },
      { name: "Sam Hernandez",   score: "33/35", level: "mastered" as MasteryLevel },
      { name: "Nina Pascual",    score: "31/35", level: "mastered" as MasteryLevel },
      { name: "Gio Esguerra",    score: "30/35", level: "mastered" as MasteryLevel },
      { name: "Mia Salazar",     score: "32/35", level: "mastered" as MasteryLevel },
      { name: "Jan Santos",      score: "31/35", level: "mastered" as MasteryLevel },
      { name: "Rex Ignacio",     score: "29/35", level: "good" as MasteryLevel },
      { name: "Cath Buenaventura", score: "30/35", level: "mastered" as MasteryLevel },
      { name: "Ric Magbanua",    score: "33/35", level: "mastered" as MasteryLevel },
      { name: "Pia Bonifacio",   score: "35/35", level: "mastered" as MasteryLevel },
      { name: "Ed dela Rosa",    score: "31/35", level: "mastered" as MasteryLevel },
    ],
  },
]

// ── Small reusable components ──────────────────────────────────

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

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
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

// ── Score distribution chart ───────────────────────────────────

function ScoreDistributionChart() {
  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={SCORE_DIST} barSize={36}>
          <XAxis
            dataKey="band"
            tick={{ fontSize: 11, fill: "#8E8E9E" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#8E8E9E" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #E8E6E1", fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {SCORE_DIST.map((entry) => (
              <Cell key={entry.band} fill={BAND_COLORS[entry.band] ?? "#8E8E9E"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Mastery heatmap ────────────────────────────────────────────

function MasteryHeatmap() {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [activeSubtopic, setActiveSubtopic] = useState<string | null>(null)

  const toggle = (parent: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev)
      next.has(parent) ? next.delete(parent) : next.add(parent)
      return next
    })
    setActiveSubtopic(null)
  }

  const sorted = [...TOPIC_GROUPS].sort((a, b) => a.avg_pct - b.avg_pct)

  const legend = (
    <div className="flex items-center gap-3 text-[11px] font-body text-ink-tertiary flex-wrap">
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#EF5350] inline-block" /> &lt;50% · Reteach</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#FFCA28] inline-block" /> 50–79% · Partial</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#66BB6A] inline-block" /> 80%+ · Strong</span>
    </div>
  )

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-display font-semibold text-base text-ink-primary">Subtopic Mastery</h3>
        {legend}
      </div>

      <div className="space-y-2">
        {sorted.map((group) => {
          const c = heatmapColor(group.avg_pct)
          const isExpanded = expandedParents.has(group.parent)

          return (
            <div
              key={group.parent}
              className="rounded-[10px] border-2 overflow-hidden transition-all"
              style={{ borderColor: isExpanded ? c.border : c.border + "44" }}
            >
              {/* Parent row */}
              <button
                onClick={() => toggle(group.parent)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left"
                style={{ backgroundColor: c.bg }}
              >
                <span className="font-display font-bold text-xl leading-none w-14 shrink-0" style={{ color: c.text }}>
                  {group.avg_pct}%
                </span>
                <span className="font-display font-semibold text-[13px] flex-1 text-ink-primary">{group.parent}</span>
                <span className="text-[11px] font-body text-ink-tertiary shrink-0">{group.subtopics.length} subtopics</span>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: c.text }} />
                  : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: c.text }} />
                }
              </button>

              {/* Expanded subtopic cells */}
              {isExpanded && (
                <div className="px-3.5 pb-3 pt-2 border-t" style={{ borderColor: c.border + "33", backgroundColor: c.bg + "55" }}>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {[...group.subtopics].sort((a, b) => a.pct - b.pct).map((sub) => {
                      const sc = heatmapColor(sub.pct)
                      const isActive = activeSubtopic === sub.name
                      return (
                        <button
                          key={sub.name}
                          onClick={() => setActiveSubtopic(isActive ? null : sub.name)}
                          className="flex flex-col items-center gap-1 shrink-0 rounded-[8px] border-2 px-2.5 py-2 transition-all min-w-[72px]"
                          style={{
                            backgroundColor: sc.bg,
                            borderColor: isActive ? sc.border : sc.border + "55",
                            boxShadow: isActive ? `0 0 0 3px ${sc.border}33` : undefined,
                          }}
                        >
                          <span className="font-display font-bold text-lg leading-none" style={{ color: sc.text }}>
                            {sub.pct}%
                          </span>
                          <span className="text-[10px] font-body text-center leading-tight line-clamp-2" style={{ color: sc.text + "CC" }}>
                            {sub.name.split(/[\s,–-]+/).slice(0, 2).join(" ")}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {activeSubtopic && (
                    <div className="mt-2 px-3.5 py-2.5 rounded-[8px] border bg-white" style={{ borderColor: heatmapColor(group.subtopics.find(s => s.name === activeSubtopic)?.pct ?? 50).border + "55" }}>
                      <span className="font-display font-semibold text-[12px] text-ink-primary">{activeSubtopic}</span>
                      <span className="font-display font-bold text-[12px] ml-2" style={{ color: heatmapColor(group.subtopics.find(s => s.name === activeSubtopic)?.pct ?? 50).text }}>
                        {group.subtopics.find(s => s.name === activeSubtopic)?.pct}% class avg
                      </span>
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

// ── Topics to Reteach ──────────────────────────────────────────

function ReteachPanel() {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set())

  const toggleParent = (p: string) =>
    setExpandedParents((prev) => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })

  const toggleSub = (s: string) =>
    setExpandedSubtopics((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Topics to Reteach</h3>
      <div className="space-y-2">
        {RETEACH_TOPICS.map((group) => {
          const c = MASTERY_COLORS[group.level]
          const isExpanded = expandedParents.has(group.parent)

          return (
            <div key={group.parent} className="rounded-[10px] border overflow-hidden" style={{ borderColor: c.border + "55" }}>
              <button
                onClick={() => toggleParent(group.parent)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-90"
                style={{ backgroundColor: c.bg + "55" }}
              >
                <span className="font-display font-bold text-[15px] flex-1 text-ink-primary">{group.parent}</span>
                <span className="font-display font-semibold text-[13px]" style={{ color: c.text }}>{group.avg_pct}% avg</span>
                <span className="text-[11px] font-body text-ink-tertiary">{group.subtopics.length} subtopic{group.subtopics.length !== 1 ? "s" : ""}</span>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 shrink-0 text-ink-tertiary" />
                  : <ChevronDown className="w-4 h-4 shrink-0 text-ink-tertiary" />
                }
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t" style={{ borderColor: c.border + "33" }}>
                  {group.subtopics.map((sub) => {
                    const sc = MASTERY_COLORS[sub.level]
                    const isOpen = expandedSubtopics.has(sub.name)
                    return (
                      <div
                        key={sub.name}
                        className="rounded-[10px] border-l-4 p-4 space-y-2"
                        style={{ borderColor: sc.border, backgroundColor: sc.bg + "55" }}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-display font-semibold text-[13px] text-ink-primary">{sub.name}</span>
                          <span className="font-display font-bold text-sm" style={{ color: sc.text }}>{sub.pct}% avg</span>
                        </div>
                        <p className="font-body text-[13px] text-ink-secondary leading-relaxed">{sub.misconception}</p>
                        <div className="flex items-start gap-2 text-[12px] font-body text-amber-800 bg-amber-50 rounded-[8px] px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" strokeWidth={2} />
                          <span>{sub.commonMistake}</span>
                        </div>
                        <button
                          onClick={() => toggleSub(sub.name)}
                          className="flex items-center gap-1 text-[11px] font-medium font-body text-ink-tertiary hover:text-ink-primary transition-colors"
                        >
                          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isOpen ? "Hide" : "Show"} explanation · 3 related questions
                        </button>
                        {isOpen && (
                          <div className="space-y-2">
                            <div className="text-[12px] font-body text-ink-secondary bg-white/80 rounded-[8px] px-3 py-2.5 leading-relaxed border border-border-light">
                              <p className="font-semibold text-[10px] text-ink-tertiary uppercase tracking-wide mb-1">Correct Explanation</p>
                              {sub.name === "Graphical method"
                                ? "To find the intersection of two lines, rewrite both in slope-intercept form (y = mx + b). Plot each line carefully from the y-intercept, then count rise/run for the slope. The intersection is where both lines cross."
                                : sub.name === "Elimination method"
                                ? "To use elimination, multiply one or both equations so that adding or subtracting them cancels one variable. Be careful to distribute the multiplication factor to every term, including the constant, before adding the equations."
                                : "Apply the quadratic formula: x = (−b ± √(b²−4ac)) / 2a. Always square b first before making it negative — (−b)² is always positive. Compute the discriminant b²−4ac carefully to determine the number of solutions."
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── At-Risk Panel ──────────────────────────────────────────────

function AtRiskPanel() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="bg-white rounded-[14px] border border-[#FFCDD2] shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-danger-500" strokeWidth={2} />
        <h3 className="font-display font-semibold text-base text-ink-primary">At-Risk Students</h3>
        <span className="ml-0.5 text-[13px] font-body text-danger-500 font-semibold">
          · {AT_RISK_STUDENTS.length} flagged
        </span>
      </div>

      <div className="space-y-3">
        {AT_RISK_STUDENTS.map((s) => {
          const trendLabel =
            s.pct < 40 ? "Critical — well below passing" :
            s.pct < 60 ? "Below passing threshold" :
            "Just below class average"
          const trendColor = s.pct < 40 ? "#C62828" : s.pct < 60 ? "#E65100" : "#8B7500"
          const isExpanded = expanded.has(s.id)

          return (
            <div key={s.id} className="rounded-[10px] border border-[#FFCDD2] bg-[#FFEBEE]/30 overflow-hidden">
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
                    Score: <span className="font-semibold text-ink-primary">{s.score}/{s.max_score} ({s.pct}%)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                    <span className="text-[11px] font-body text-ink-tertiary">Weak in:</span>
                    {s.weakIn.map((w) => (
                      <span key={w} className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full bg-[#FFEBEE] text-danger-700">{w}</span>
                    ))}
                    <button
                      onClick={() => toggle(s.id)}
                      className="text-[11px] font-body text-ink-tertiary hover:text-ink-primary transition-colors"
                    >
                      {isExpanded ? "hide detail" : "see subtopics"}
                    </button>
                  </div>
                </div>

                <button className="shrink-0 px-3 py-1.5 rounded-[8px] bg-primary-500 hover:bg-primary-600 text-white text-[11px] font-semibold font-body transition-colors">
                  Re-Assess
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-[#FFCDD2]/50 px-3.5 pb-3 pt-2 flex flex-wrap gap-1.5">
                  {s.subtopics.map((sub) => (
                    <span key={sub.name} className="text-[11px] font-body px-2 py-0.5 rounded-full bg-white border border-[#FFCDD2] text-danger-700">
                      {sub.name} · {sub.pct}%
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

// ── Student Clusters ───────────────────────────────────────────

function StudentClusters() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card">
      <div className="p-5 border-b border-border-light">
        <h3 className="font-display font-semibold text-base text-ink-primary">Student Groups by Gap</h3>
      </div>
      <div className="divide-y divide-border-light">
        {STUDENT_CLUSTERS.map((cluster) => {
          const isOpen = expanded.has(cluster.key)
          return (
            <div key={cluster.key}>
              <button
                onClick={() => toggle(cluster.key)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-secondary/50 transition-colors text-left"
              >
                {cluster.noGap ? (
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-[13px] text-green-700">{cluster.count}</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#FFEBEE] flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4 h-4 text-danger-500" />
                  </div>
                )}
                <p className="font-body text-[13px] text-ink-primary flex-1">
                  <span className="font-semibold">{cluster.count} student{cluster.count !== 1 ? "s" : ""}</span>{" "}
                  {cluster.noGap ? "have" : "share weakness in"}{" "}
                  {cluster.noGap ? "no critical gaps" : (
                    <span className="text-danger-600 font-medium">{cluster.label}</span>
                  )}
                </p>
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-ink-tertiary shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-ink-tertiary shrink-0" />
                }
              </button>

              {isOpen && (
                <div className={`border-t border-border-light divide-y divide-border-light/60 ${cluster.noGap ? "bg-green-50/30" : "bg-[#FFEBEE]/10"}`}>
                  {cluster.students.map((s) => (
                    <div key={s.name} className="flex items-center gap-3 px-5 py-3">
                      <span className="font-body text-[13px] text-ink-primary flex-1">{s.name}</span>
                      <span className="font-display font-semibold text-[13px] text-ink-secondary">{s.score}</span>
                      <MasteryBadge level={s.level} />
                    </div>
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

// ── Page ───────────────────────────────────────────────────────

export default function DemoAssessmentPage() {
  const router = useRouter()

  return (
    <div className="p-4 md:p-8 max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/demo/report")}
          className="flex items-center gap-1.5 text-[13px] font-body text-ink-tertiary hover:text-ink-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          Back to Reports
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-[24px] md:text-[28px] text-ink-primary leading-tight">
              Algebra Equations
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[13px] font-body text-ink-secondary">Grade 10 — Luna</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-body bg-primary-50 text-primary-600">Math</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="text-[12px] font-body text-ink-tertiary">Feb 22, 2025</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="text-[12px] font-body text-ink-tertiary capitalize">Medium</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="text-[12px] font-body text-ink-tertiary">35 questions</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold font-body bg-[#E3F2FD] text-[#1565C0]">
              closed
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Score"      value="91%"  sub="class average"      icon={BarChart2} color="#0072C6" />
        <StatCard label="Mastery Rate"   value="88%"  sub="of students passed"  icon={Brain}     color="#9B59B6" />
        <StatCard label="Students"       value="35"   sub="enrolled"            icon={Users}     color="#2ECC71" />
        <StatCard label="Completion"     value="100%" sub="35/35 submitted"     icon={CheckCircle2} color="#42A5F5" />
      </div>

      {/* Score distribution + Subtopic heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ScoreDistributionChart />
        <MasteryHeatmap />
      </div>

      {/* Topics to Reteach + At-Risk (side by side on large) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReteachPanel />
        <AtRiskPanel />
      </div>

      {/* Student Groups */}
      <StudentClusters />

    </div>
  )
}
