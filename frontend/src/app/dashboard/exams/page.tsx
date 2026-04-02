"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  BarChart2,
  Trash2,
  ChevronDown,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { api, type AssessmentItem, type AssessmentStatus, type ClassItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: AssessmentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Closed", value: "closed" },
]

const STATUS_STYLES: Record<AssessmentStatus, { bg: string; text: string; dot: string }> = {
  draft:     { bg: "bg-amber-50",    text: "text-amber-700",  dot: "bg-amber-400" },
  published: { bg: "bg-green-50",    text: "text-green-700",  dot: "bg-green-500" },
  closed:    { bg: "bg-slate-100",   text: "text-slate-600",  dot: "bg-slate-400" },
  archived:  { bg: "bg-surface-secondary", text: "text-ink-tertiary", dot: "bg-ink-tertiary" },
}

function StatusBadge({ status }: { status: AssessmentStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold font-body uppercase tracking-wide", s.bg, s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

function isReassessment(title: string) {
  return /re-?assess/i.test(title)
}

// ── Assessment card ────────────────────────────────────────────

function AssessmentCard({
  item,
  className: classItem,
  onAction,
}: {
  item: AssessmentItem
  className: ClassItem | undefined
  onAction: (type: "edit" | "results" | "delete") => void
}) {
  const canViewResults = item.status === "published" || item.status === "closed"
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white rounded-[14px] border border-border-light shadow-card p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow duration-[250ms]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-display font-semibold text-base text-ink-primary leading-tight truncate">
              {item.title}
            </h3>
            {isReassessment(item.title) && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-50 text-accent-700">
                Re-assess
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {classItem && (
              <span className="text-[12px] font-body text-ink-secondary truncate">
                {classItem.name}
              </span>
            )}
            {classItem && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-body bg-primary-50 text-primary-600">
                {classItem.subject}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="flex items-center gap-4 text-[12px] font-body text-ink-tertiary">
        <span>{item.question_count} questions</span>
        <span className="capitalize">{item.difficulty}</span>
        <span className="ml-auto">{formatDate(item.created_at)}</span>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border-light">
        {/* Edit available for all non-archived */}
        {item.status !== "archived" && (
          <button
            onClick={() => onAction("edit")}
            className="flex items-center gap-1.5 text-[12px] font-medium font-body text-primary-500 hover:text-primary-600 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        {canViewResults && (
          <button
            onClick={() => onAction("results")}
            className="flex items-center gap-1.5 text-[12px] font-medium font-body text-primary-500 hover:text-primary-600 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            View Results
          </button>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {confirmDelete ? (
            <>
              <span className="text-[12px] font-body text-ink-secondary">Delete?</span>
              <button
                onClick={() => { onAction("delete"); setConfirmDelete(false) }}
                className="text-[12px] font-medium font-body text-danger-500 hover:text-danger-600 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[12px] font-medium font-body text-ink-tertiary hover:text-ink-primary transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium font-body text-ink-tertiary hover:text-danger-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter select ──────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[38px] pl-3 pr-8 text-sm font-body text-ink-primary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

const inputCls =
  "h-[38px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

export default function ExamsPage() {
  const router = useRouter()
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<AssessmentStatus | "all">("all")
  const [search, setSearch] = useState("")

  // Filters
  const [filterClass, setFilterClass] = useState("")
  const [filterType, setFilterType] = useState("") // "" | "regular" | "reassessment"
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")

  const fetchData = async (status: AssessmentStatus | "all", q: string, classId: string) => {
    setLoading(true)
    try {
      const [asmt, cls] = await Promise.all([
        api.getAssessments({
          status: status === "all" ? undefined : status,
          search: q || undefined,
          class_id: classId || undefined,
          per_page: 100,
        }),
        api.getClasses({ per_page: 100 }),
      ])
      setAssessments(asmt.items)
      setClasses(cls.items)
    } catch {
      toast.error("Failed to load exams")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(activeTab, search, filterClass)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterClass])

  useEffect(() => {
    const t = setTimeout(() => fetchData(activeTab, search, filterClass), 350)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]))

  // Client-side type + date filtering
  const filtered = assessments.filter((a) => {
    if (filterType === "reassessment" && !isReassessment(a.title)) return false
    if (filterType === "regular" && isReassessment(a.title)) return false
    if (filterFrom && new Date(a.created_at) < new Date(filterFrom)) return false
    if (filterTo && new Date(a.created_at) > new Date(filterTo + "T23:59:59")) return false
    return true
  })

  const hasFilters = filterClass || filterType || filterFrom || filterTo
  const clearFilters = () => {
    setFilterClass("")
    setFilterType("")
    setFilterFrom("")
    setFilterTo("")
  }

  const handleAction = async (item: AssessmentItem, type: "edit" | "results" | "delete") => {
    if (type === "edit") {
      router.push(`/dashboard/exams/create?id=${item.id}`)
    } else if (type === "results") {
      router.push(`/dashboard/assessments/${item.id}`)
    } else {
      try {
        await api.deleteAssessment(item.id)
        setAssessments((prev) => prev.filter((a) => a.id !== item.id))
        toast.success("Exam deleted")
      } catch {
        toast.error("Failed to delete exam")
      }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display font-bold text-[24px] md:text-[30px] text-ink-primary leading-tight">
            Exam Library
          </h1>
          <p className="font-body text-sm text-ink-secondary mt-1 hidden sm:block">
            Create, manage, and assign assessments to your classes
          </p>
        </div>
        <Button variant="gradient" size="default" onClick={() => router.push("/dashboard/exams/create")} className="shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create Exam</span>
          <span className="sm:hidden">Create</span>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center bg-surface-secondary rounded-[10px] p-1 gap-0.5 mb-4 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 h-8 rounded-[8px] text-[13px] font-medium font-body transition-all",
              activeTab === tab.value
                ? "bg-white text-ink-primary shadow-sm"
                : "text-ink-tertiary hover:text-ink-secondary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams…"
            className={cn(inputCls, "pl-8 w-[200px]")}
          />
        </div>

        {/* Class filter */}
        <FilterSelect value={filterClass} onChange={setFilterClass} placeholder="All Classes">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </FilterSelect>

        {/* Type filter */}
        <FilterSelect value={filterType} onChange={setFilterType} placeholder="All Types">
          <option value="regular">Regular</option>
          <option value="reassessment">Reassessment</option>
        </FilterSelect>

        {/* Date from */}
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className={cn(inputCls, "w-[150px] cursor-pointer")}
          title="From date"
        />
        <span className="text-[12px] text-ink-tertiary font-body">–</span>
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className={cn(inputCls, "w-[150px] cursor-pointer")}
          title="To date"
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-[12px] font-body font-medium text-ink-tertiary hover:text-danger-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}

        {/* Result count */}
        {!loading && (
          <span className="text-[12px] font-body text-ink-tertiary ml-auto">
            {filtered.length} exam{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[152px] rounded-[14px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No exams found"
          description={
            hasFilters
              ? "No exams match your current filters."
              : activeTab === "all"
              ? "Create your first AI-powered exam to get started."
              : `No ${activeTab} exams found.`
          }
          actionLabel={hasFilters ? "Clear Filters" : "Create Exam"}
          onAction={hasFilters ? clearFilters : () => router.push("/dashboard/exams/create")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <AssessmentCard
              key={item.id}
              item={item}
              className={classMap[item.class_id]}
              onAction={(type) => handleAction(item, type)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
