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
  Download,
  RefreshCw,
  Zap,
  Sparkles,
  X,
  Loader2,
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

function heatmapColor(pct: number) {
  if (pct < 50) return { bg: "#FFEBEE", border: "#EF5350", text: "#C62828" }
  if (pct < 80) return { bg: "#FFF8E1", border: "#FFCA28", text: "#8B7500" }
  return { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32" }
}

// ── Hardcoded demo data ────────────────────────────────────────

const SCORE_DIST = [
  { band: "0–59",   count: 11 },
  { band: "60–69",  count: 8  },
  { band: "70–79",  count: 7  },
  { band: "80–89",  count: 5  },
  { band: "90–100", count: 1  },
]

const TOPIC_GROUPS = [
  {
    parent: "Chemical Bonding",
    avg_pct: 78,
    subtopics: [
      { name: "Covalent bonds",  pct: 82 },
      { name: "Ionic bonds",     pct: 79 },
      { name: "Metallic bonds",  pct: 72 },
    ],
  },
  {
    parent: "Reaction Types",
    avg_pct: 61,
    subtopics: [
      { name: "Synthesis reactions",      pct: 71 },
      { name: "Decomposition reactions",  pct: 63 },
      { name: "Displacement reactions",   pct: 57 },
    ],
  },
  {
    parent: "Balancing Equations",
    avg_pct: 49,
    subtopics: [
      { name: "Conservation of mass",  pct: 54 },
      { name: "Coefficient rules",     pct: 47 },
      { name: "Polyatomic ions",       pct: 43 },
    ],
  },
]

const RETEACH_TOPICS = [
  {
    parent: "Balancing Equations",
    avg_pct: 49,
    level: "critical" as MasteryLevel,
    subtopics: [
      {
        name: "Polyatomic ions",
        pct: 43,
        level: "critical" as MasteryLevel,
        misconception:
          "Students treat polyatomic ions as individual atoms when balancing, breaking them apart and recounting each element separately instead of keeping the group as a unit.",
        commonMistake: "Common mistake: 19 out of 32 students split the sulfate (SO₄²⁻) ion when balancing, leading to incorrect atom counts.",
      },
      {
        name: "Coefficient rules",
        pct: 47,
        level: "critical" as MasteryLevel,
        misconception:
          "Many students change subscripts instead of coefficients when balancing, which alters the chemical formula of the compound rather than adjusting the number of molecules.",
        commonMistake: "Common mistake: 16 out of 32 students modified subscripts in H₂O rather than placing a coefficient in front of the formula.",
      },
      {
        name: "Conservation of mass",
        pct: 54,
        level: "remedial" as MasteryLevel,
        misconception:
          "Students do not verify that atom counts match on both sides after placing one coefficient. Many stop after one adjustment without rechecking the full equation.",
        commonMistake: "Common mistake: 12 out of 32 students left equations partially balanced, fixing only one element type.",
      },
    ],
  },
  {
    parent: "Reaction Types",
    avg_pct: 61,
    level: "remedial" as MasteryLevel,
    subtopics: [
      {
        name: "Displacement reactions",
        pct: 57,
        level: "remedial" as MasteryLevel,
        misconception:
          "Students confuse single and double displacement reactions. They cannot reliably predict which element replaces which, especially when activity series knowledge is needed.",
        commonMistake: "Common mistake: 14 out of 32 students swapped reactant and product positions in single displacement reactions.",
      },
      {
        name: "Decomposition reactions",
        pct: 63,
        level: "remedial" as MasteryLevel,
        misconception:
          "Students struggle to predict the correct number of decomposition products. Many assume all decomposition reactions produce exactly two products regardless of the compound.",
        commonMistake: "Common mistake: 11 out of 32 students predicted only two products for multi-product decomposition reactions.",
      },
    ],
  },
]

const AT_RISK_STUDENTS = [
  {
    id: "c1",
    name: "Maria Santos",
    score: 10,
    max_score: 40,
    pct: 31,
    level: "critical" as MasteryLevel,
    weakIn: ["Balancing Equations", "Reaction Types"],
    subtopics: [
      { name: "Polyatomic ions", pct: 15 },
      { name: "Coefficient rules", pct: 20 },
      { name: "Displacement reactions", pct: 25 },
      { name: "Conservation of mass", pct: 30 },
    ],
  },
  {
    id: "c2",
    name: "Jose Reyes",
    score: 15,
    max_score: 40,
    pct: 37,
    level: "critical" as MasteryLevel,
    weakIn: ["Balancing Equations", "Reaction Types"],
    subtopics: [
      { name: "Polyatomic ions", pct: 20 },
      { name: "Coefficient rules", pct: 25 },
      { name: "Displacement reactions", pct: 35 },
    ],
  },
  {
    id: "c3",
    name: "Ana Garcia",
    score: 17,
    max_score: 40,
    pct: 42,
    level: "remedial" as MasteryLevel,
    weakIn: ["Balancing Equations"],
    subtopics: [
      { name: "Polyatomic ions", pct: 30 },
      { name: "Coefficient rules", pct: 35 },
      { name: "Conservation of mass", pct: 40 },
    ],
  },
  {
    id: "c4",
    name: "Andres Torres",
    score: 18,
    max_score: 40,
    pct: 45,
    level: "remedial" as MasteryLevel,
    weakIn: ["Balancing Equations", "Reaction Types"],
    subtopics: [
      { name: "Polyatomic ions", pct: 30 },
      { name: "Displacement reactions", pct: 40 },
      { name: "Decomposition reactions", pct: 45 },
    ],
  },
  {
    id: "c5",
    name: "Sofia Villanueva",
    score: 19,
    max_score: 40,
    pct: 48,
    level: "remedial" as MasteryLevel,
    weakIn: ["Balancing Equations"],
    subtopics: [
      { name: "Polyatomic ions", pct: 35 },
      { name: "Coefficient rules", pct: 40 },
    ],
  },
]

const STUDENT_CLUSTERS = [
  {
    key: "cluster-1",
    label: "Balancing Equations + Reaction Types",
    count: 5,
    students: [
      { name: "Maria Santos",    score: "10/40", level: "critical" as MasteryLevel },
      { name: "Jose Reyes",      score: "15/40", level: "critical" as MasteryLevel },
      { name: "Ana Garcia",      score: "17/40", level: "remedial" as MasteryLevel },
      { name: "Andres Torres",   score: "18/40", level: "remedial" as MasteryLevel },
      { name: "Sofia Villanueva",score: "19/40", level: "remedial" as MasteryLevel },
    ],
  },
  {
    key: "cluster-2",
    label: "Balancing Equations only",
    count: 8,
    students: [
      { name: "Tina Soriano",    score: "22/40", level: "average" as MasteryLevel },
      { name: "Rico Gomez",      score: "24/40", level: "average" as MasteryLevel },
      { name: "Lea Aquino",      score: "25/40", level: "average" as MasteryLevel },
      { name: "Mark Castillo",   score: "24/40", level: "average" as MasteryLevel },
      { name: "Grace Navarro",   score: "25/40", level: "average" as MasteryLevel },
      { name: "Paolo Dela Cruz", score: "26/40", level: "average" as MasteryLevel },
      { name: "Jenny Bautista",  score: "26/40", level: "average" as MasteryLevel },
      { name: "Kevin Morales",   score: "27/40", level: "average" as MasteryLevel },
    ],
  },
  {
    key: "no-gap",
    label: "no critical gaps",
    count: 19,
    noGap: true,
    students: [
      { name: "Luis Fernandez",  score: "33/40", level: "mastered" as MasteryLevel },
      { name: "Rosa Mendez",     score: "32/40", level: "mastered" as MasteryLevel },
      { name: "Diego Ramos",     score: "30/40", level: "good"     as MasteryLevel },
      { name: "Elena Cruz",      score: "31/40", level: "mastered" as MasteryLevel },
      { name: "Marco Santos",    score: "34/40", level: "mastered" as MasteryLevel },
      { name: "Carla Reyes",     score: "33/40", level: "mastered" as MasteryLevel },
      { name: "Noel Flores",     score: "30/40", level: "mastered" as MasteryLevel },
      { name: "Bianca Lopez",    score: "29/40", level: "good"     as MasteryLevel },
      { name: "Trish Ocampo",    score: "29/40", level: "good"     as MasteryLevel },
      { name: "Sam Hernandez",   score: "33/40", level: "mastered" as MasteryLevel },
      { name: "Nina Pascual",    score: "31/40", level: "mastered" as MasteryLevel },
      { name: "Gio Esguerra",    score: "30/40", level: "mastered" as MasteryLevel },
      { name: "Mia Salazar",     score: "32/40", level: "mastered" as MasteryLevel },
      { name: "Jan Santos",      score: "31/40", level: "mastered" as MasteryLevel },
      { name: "Rex Ignacio",     score: "29/40", level: "good"     as MasteryLevel },
      { name: "Cath Buenaventura", score: "30/40", level: "mastered" as MasteryLevel },
      { name: "Ric Magbanua",    score: "33/40", level: "mastered" as MasteryLevel },
      { name: "Pia Bonifacio",   score: "36/40", level: "mastered" as MasteryLevel },
      { name: "Ed dela Rosa",    score: "31/40", level: "mastered" as MasteryLevel },
    ],
  },
]

const CHEM_SUBTOPICS = [
  { name: "Polyatomic ions",        pct: 43, level: "critical"  as MasteryLevel },
  { name: "Coefficient rules",      pct: 47, level: "critical"  as MasteryLevel },
  { name: "Conservation of mass",   pct: 54, level: "remedial"  as MasteryLevel },
  { name: "Displacement reactions", pct: 57, level: "remedial"  as MasteryLevel },
  { name: "Decomposition reactions",pct: 63, level: "remedial"  as MasteryLevel },
  { name: "Synthesis reactions",    pct: 71, level: "average"   as MasteryLevel },
  { name: "Metallic bonds",         pct: 72, level: "average"   as MasteryLevel },
  { name: "Ionic bonds",            pct: 79, level: "good"      as MasteryLevel },
  { name: "Covalent bonds",         pct: 82, level: "good"      as MasteryLevel },
]

const GEN_MESSAGES = [
  "Analyzing diagnostic data…",
  "Identifying weak subtopics…",
  "Crafting targeted questions…",
  "Building remediation exam…",
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
      <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20" }}>
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

// ── Score distribution ─────────────────────────────────────────

function ScoreDistributionChart() {
  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <h3 className="font-display font-semibold text-base text-ink-primary mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={SCORE_DIST} barSize={36}>
          <XAxis dataKey="band" tick={{ fontSize: 11, fill: "#8E8E9E" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#8E8E9E" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 10, border: "1px solid #E8E6E1", fontSize: 12 }} />
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
      const next = new Set(prev); next.has(parent) ? next.delete(parent) : next.add(parent); return next
    })
    setActiveSubtopic(null)
  }

  const sorted = [...TOPIC_GROUPS].sort((a, b) => a.avg_pct - b.avg_pct)

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-display font-semibold text-base text-ink-primary">Subtopic Mastery</h3>
        <div className="flex items-center gap-3 text-[11px] font-body text-ink-tertiary flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#EF5350] inline-block" /> &lt;50% · Reteach</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#FFCA28] inline-block" /> 50–79% · Partial</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#66BB6A] inline-block" /> 80%+ · Strong</span>
        </div>
      </div>
      <div className="space-y-2">
        {sorted.map((group) => {
          const c = heatmapColor(group.avg_pct)
          const isExpanded = expandedParents.has(group.parent)
          return (
            <div key={group.parent} className="rounded-[10px] border-2 overflow-hidden" style={{ borderColor: isExpanded ? c.border : c.border + "44" }}>
              <button
                onClick={() => toggle(group.parent)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
                style={{ backgroundColor: c.bg }}
              >
                <span className="font-display font-bold text-xl leading-none w-14 shrink-0" style={{ color: c.text }}>{group.avg_pct}%</span>
                <span className="font-display font-semibold text-[13px] flex-1 text-ink-primary">{group.parent}</span>
                <span className="text-[11px] font-body text-ink-tertiary shrink-0">{group.subtopics.length} subtopics</span>
                {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: c.text }} /> : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: c.text }} />}
              </button>
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
                          className="flex flex-col items-center gap-1 shrink-0 rounded-[8px] border-2 px-2.5 py-2 min-w-[72px]"
                          style={{ backgroundColor: sc.bg, borderColor: isActive ? sc.border : sc.border + "55", boxShadow: isActive ? `0 0 0 3px ${sc.border}33` : undefined }}
                        >
                          <span className="font-display font-bold text-lg leading-none" style={{ color: sc.text }}>{sub.pct}%</span>
                          <span className="text-[10px] font-body text-center leading-tight line-clamp-2" style={{ color: sc.text + "CC" }}>{sub.name.split(/[\s,–-]+/).slice(0, 2).join(" ")}</span>
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
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-90"
                style={{ backgroundColor: c.bg + "55" }}
              >
                <span className="font-display font-bold text-[15px] flex-1 text-ink-primary">{group.parent}</span>
                <span className="font-display font-semibold text-[13px]" style={{ color: c.text }}>{group.avg_pct}% avg</span>
                <span className="text-[11px] font-body text-ink-tertiary">{group.subtopics.length} subtopics</span>
                {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 shrink-0 text-ink-tertiary" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t" style={{ borderColor: c.border + "33" }}>
                  {group.subtopics.map((sub) => {
                    const sc = MASTERY_COLORS[sub.level]
                    const isOpen = expandedSubtopics.has(sub.name)
                    return (
                      <div key={sub.name} className="rounded-[10px] border-l-4 p-4 space-y-2" style={{ borderColor: sc.border, backgroundColor: sc.bg + "55" }}>
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
                          <div className="text-[12px] font-body text-ink-secondary bg-white/80 rounded-[8px] px-3 py-2.5 leading-relaxed border border-border-light">
                            <p className="font-semibold text-[10px] text-ink-tertiary uppercase tracking-wide mb-1">Correct Explanation</p>
                            {sub.name === "Polyatomic ions"
                              ? "When balancing equations with polyatomic ions (e.g., SO₄²⁻, NO₃⁻), treat the entire ion as one unit. If the ion appears unchanged on both sides, balance it as a group rather than counting individual atoms. Only break the ion apart if it splits between products."
                              : sub.name === "Coefficient rules"
                              ? "To balance a chemical equation, only add coefficients (numbers in front of the chemical formula) — never change subscripts inside the formula. Changing subscripts changes the substance itself. Coefficients tell how many molecules of each substance are involved."
                              : sub.name === "Conservation of mass"
                              ? "After placing each coefficient, count all atoms of every element on both sides to verify they are equal. Work systematically: balance one element at a time, then recount everything. The equation is balanced only when all elements match."
                              : sub.name === "Displacement reactions"
                              ? "In single displacement, a more reactive element replaces a less reactive one in a compound (A + BC → AC + B). Use the activity series to determine which element is more reactive. In double displacement, both compounds exchange ions (AB + CD → AD + CB)."
                              : "In decomposition, one compound breaks down into two or more simpler substances. The number of products depends on the compound: binary compounds (like H₂O) produce two elements; others may produce three or more products including gases."
                            }
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
        <span className="ml-0.5 text-[13px] font-body text-danger-500 font-semibold">· {AT_RISK_STUDENTS.length} flagged</span>
      </div>
      <div className="space-y-3">
        {AT_RISK_STUDENTS.map((s) => {
          const trendLabel = s.pct < 40 ? "Critical — well below passing" : s.pct < 60 ? "Below passing threshold" : "Just below class average"
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
                    <button onClick={() => toggle(s.id)} className="text-[11px] font-body text-ink-tertiary hover:text-ink-primary transition-colors">
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
                {isOpen ? <ChevronUp className="w-4 h-4 text-ink-tertiary shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary shrink-0" />}
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

// ── Reviewer Panel ─────────────────────────────────────────────

function ReviewerPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[480px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={1.75} />
            </div>
            <h2 className="font-display font-semibold text-base text-ink-primary">AI Class Review</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div className="rounded-[12px] bg-[#FFEBEE] border border-[#FFCDD2] p-4">
            <p className="font-display font-semibold text-[13px] text-danger-700 mb-1">Overall Performance</p>
            <p className="font-body text-[13px] text-danger-800 leading-relaxed">
              Below-average class performance with <strong>58% mastery</strong> and <strong>68% average score</strong>. Balancing Equations is a critical gap affecting the majority of students and will block progress in Stoichiometry if not addressed immediately.
            </p>
          </div>

          <div>
            <p className="font-display font-semibold text-[13px] text-ink-primary mb-2">Key Findings</p>
            <ul className="space-y-2">
              {[
                { color: "#C62828", bg: "#FFEBEE", text: "11 students (31%) scored below 60% — immediate full reteach intervention needed." },
                { color: "#C62828", bg: "#FFEBEE", text: "Balancing Equations averaged only 49% — polyatomic ions (43%) is the most critical gap and a foundational concept." },
                { color: "#E65100", bg: "#FFF3E0", text: "Reaction Types averaged 61% — displacement reactions (57%) and decomposition (63%) need targeted review." },
                { color: "#2E7D32", bg: "#E8F5E9", text: "Chemical Bonding averaged 78% — theoretical concepts are well-understood; this is a relative strength." },
                { color: "#E65100", bg: "#FFF3E0", text: "Only 19 of 32 students (59%) are ready to advance to Stoichiometry without additional support." },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-[8px] px-3 py-2.5" style={{ backgroundColor: item.bg }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: item.color }} />
                  <span className="font-body text-[12px] leading-relaxed" style={{ color: item.color }}>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[12px] border border-[#FFCDD2] bg-[#FFEBEE]/40 p-4">
            <p className="font-display font-semibold text-[13px] text-danger-700 mb-1.5">Priority Action</p>
            <p className="font-body text-[13px] text-danger-800 leading-relaxed">
              Dedicate <strong>2–3 class sessions</strong> to Balancing Equations before moving to Stoichiometry. Use hands-on balance activities to reinforce conservation of mass, then reintroduce coefficient rules and polyatomic ions. <strong>Maria Santos</strong> and <strong>Jose Reyes</strong> require immediate one-on-one sessions.
            </p>
          </div>

          <div>
            <p className="font-display font-semibold text-[13px] text-ink-primary mb-2">Recommended Grouping</p>
            <div className="space-y-2">
              {[
                {
                  label: "Group 1 — Full Reteach",
                  count: "5 students",
                  names: "Maria Santos, Jose Reyes, Ana Garcia, Andres Torres, Sofia Villanueva",
                  focus: "Balancing Equations + Reaction Types — start from conservation of mass",
                  color: "#C62828", bg: "#FFEBEE",
                },
                {
                  label: "Group 2 — Targeted Practice",
                  count: "8 students",
                  names: "Tina Soriano + 7 others",
                  focus: "Balancing Equations only — coefficient rules and polyatomic ions",
                  color: "#E65100", bg: "#FFF3E0",
                },
                {
                  label: "Group 3 — Ready to Advance",
                  count: "19 students",
                  names: "Remaining class",
                  focus: "Proceed to Stoichiometry with brief review of displacement reactions",
                  color: "#2E7D32", bg: "#E8F5E9",
                },
              ].map((g) => (
                <div key={g.label} className="rounded-[10px] p-3.5 border" style={{ backgroundColor: g.bg, borderColor: g.color + "33" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-semibold text-[12px]" style={{ color: g.color }}>{g.label}</span>
                    <span className="font-body text-[11px] font-medium" style={{ color: g.color }}>{g.count}</span>
                  </div>
                  <p className="font-body text-[11px] text-ink-secondary">{g.names}</p>
                  <p className="font-body text-[11px] text-ink-tertiary mt-0.5">Focus: {g.focus}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Re-assess Modal ────────────────────────────────────────────

function ReassessModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["Polyatomic ions", "Coefficient rules", "Conservation of mass", "Displacement reactions"])
  )
  const [questionCount, setQuestionCount] = useState(12)
  const [difficulty, setDifficulty] = useState("medium")
  const [generating, setGenerating] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const [done, setDone] = useState(false)

  const toggle = (s: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })

  const handleGenerate = () => {
    setGenerating(true)
    let idx = 0
    const t = setInterval(() => { idx++; setMsgIdx(idx % GEN_MESSAGES.length) }, 2500)
    setTimeout(() => { clearInterval(t); setGenerating(false); setDone(true) }, 8000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-[20px] sm:rounded-[20px] shadow-2xl w-full sm:max-w-[540px] max-h-[90vh] flex flex-col relative">
        {generating && (
          <div className="absolute inset-0 bg-white/95 rounded-[20px] z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-lg text-ink-primary">Generating Re-Assessment</p>
              <p className="font-body text-sm text-ink-secondary mt-1">{GEN_MESSAGES[msgIdx]}</p>
            </div>
          </div>
        )}
        {done && (
          <div className="absolute inset-0 bg-white/95 rounded-[20px] z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E9] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#2D8A4E]" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-lg text-ink-primary">Re-Assessment Created!</p>
              <p className="font-body text-sm text-ink-secondary mt-1">
                {selected.size} subtopics · {questionCount} questions · {difficulty}
              </p>
            </div>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-[10px] bg-primary-500 text-white text-sm font-semibold font-body hover:bg-primary-600 transition-colors">Done</button>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-500" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-lg text-ink-primary">Generate Re-Assessment</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#E8F5E9] rounded-[10px] p-3">
              <p className="font-body text-[11px] text-[#2D8A4E] uppercase tracking-wide mb-0.5">Ready for Next Unit</p>
              <p className="font-display font-bold text-xl text-[#2D8A4E]">58%</p>
            </div>
            <div className="bg-[#FFEBEE] rounded-[10px] p-3">
              <p className="font-body text-[11px] text-danger-500 uppercase tracking-wide mb-0.5">Need Intervention</p>
              <p className="font-display font-bold text-xl text-danger-500">41%</p>
            </div>
          </div>

          <div>
            <p className="font-display font-semibold text-sm text-ink-primary mb-2">
              Target Subtopics <span className="font-body font-normal text-ink-tertiary text-[12px]">({selected.size} selected)</span>
            </p>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {CHEM_SUBTOPICS.map((sub) => {
                const c = MASTERY_COLORS[sub.level]
                const isSel = selected.has(sub.name)
                return (
                  <label
                    key={sub.name}
                    className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-all ${isSel ? "border-primary-500 bg-primary-50" : "border-border-light bg-surface-secondary hover:border-primary-300"}`}
                  >
                    <input type="checkbox" checked={isSel} onChange={() => toggle(sub.name)} className="w-4 h-4 rounded accent-primary-500" />
                    <span className="font-body text-sm text-ink-primary flex-1 truncate">{sub.name}</span>
                    <span className="font-display font-semibold text-[13px]" style={{ color: c.text }}>{sub.pct}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{ backgroundColor: c.bg, color: c.text }}>{sub.level}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Question Count</label>
              <input
                type="number" min={3} max={30} value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(3, Math.min(30, Number(e.target.value))))}
                className="w-full h-[42px] px-[14px] text-sm font-body text-ink-primary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors text-center"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Difficulty</label>
              <select
                value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                className="w-full h-[42px] px-[14px] text-sm font-body text-ink-primary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 shrink-0">
          <button
            onClick={handleGenerate}
            disabled={selected.size === 0 || generating}
            className="w-full h-11 rounded-[10px] bg-gradient-to-r from-primary-500 to-accent-500 text-white font-display font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Generate Re-Assessment
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function DemoChemistryPage() {
  const router = useRouter()
  const [showReviewer, setShowReviewer] = useState(false)
  const [showReassess, setShowReassess] = useState(false)

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
              Chemical Reactions Lab Exam
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[13px] font-body text-ink-secondary">Grade 10 — Luna</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-body bg-primary-50 text-primary-600">Science</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="text-[12px] font-body text-ink-tertiary">Mar 5, 2025</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="text-[12px] font-body text-ink-tertiary capitalize">Hard</span>
              <span className="text-ink-tertiary text-xs">·</span>
              <span className="text-[12px] font-body text-ink-tertiary">40 questions</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold font-body bg-[#E3F2FD] text-[#1565C0]">
              closed
            </span>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-border-light bg-white text-[12px] font-medium font-body text-ink-secondary hover:bg-surface-secondary transition-colors">
              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
              Export
            </button>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-border-light bg-white text-[12px] font-medium font-body text-ink-secondary hover:bg-surface-secondary transition-colors">
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Sync
            </button>
            <button
              onClick={() => setShowReviewer(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-primary-200 bg-primary-50 text-[12px] font-semibold font-body text-primary-600 hover:bg-primary-100 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              Reviewer
            </button>
            <button
              onClick={() => setShowReassess(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-gradient-to-r from-primary-500 to-accent-500 text-[12px] font-semibold font-body text-white hover:opacity-90 transition-opacity"
            >
              <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
              Re-assess
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Score"    value="68%"  sub="class average"       icon={BarChart2}    color="#0072C6" />
        <StatCard label="Mastery Rate" value="58%"  sub="of students passed"   icon={Brain}        color="#E74C3C" />
        <StatCard label="Students"     value="35"   sub="enrolled"             icon={Users}        color="#2ECC71" />
        <StatCard label="Completion"   value="91%"  sub="32/35 submitted"      icon={CheckCircle2} color="#42A5F5" />
      </div>

      {/* Score distribution + Subtopic heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ScoreDistributionChart />
        <MasteryHeatmap />
      </div>

      {/* Topics to Reteach + At-Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReteachPanel />
        <AtRiskPanel />
      </div>

      {/* Student Groups */}
      <StudentClusters />

      {/* Modals */}
      {showReviewer && <ReviewerPanel onClose={() => setShowReviewer(false)} />}
      {showReassess && <ReassessModal onClose={() => setShowReassess(false)} />}

    </div>
  )
}
