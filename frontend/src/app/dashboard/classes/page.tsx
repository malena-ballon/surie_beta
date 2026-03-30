"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  GraduationCap,
  Plus,
  Users,
  BookOpen,
  Calculator,
  FlaskConical,
  Languages,
  Landmark,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { api, type ClassItem, type ClassCreateData } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ── Subject style map ──────────────────────────────────────────

interface SubjectStyle {
  icon: LucideIcon
  bg: string
  color: string
}

const SUBJECT_STYLES: Record<string, SubjectStyle> = {
  science:        { icon: FlaskConical, bg: "#E0F7FA", color: "#00B4D8" },
  chemistry:      { icon: FlaskConical, bg: "#E0F7FA", color: "#00B4D8" },
  biology:        { icon: FlaskConical, bg: "#E0F7FA", color: "#00B4D8" },
  physics:        { icon: FlaskConical, bg: "#E0F7FA", color: "#00B4D8" },
  math:           { icon: Calculator,   bg: "#E8F1FA", color: "#0072C6" },
  mathematics:    { icon: Calculator,   bg: "#E8F1FA", color: "#0072C6" },
  english:        { icon: BookOpen,     bg: "#FFF8E1", color: "#E6951A" },
  filipino:       { icon: Languages,    bg: "#E8F5E9", color: "#2D8A4E" },
  history:        { icon: Landmark,     bg: "#F3E8FF", color: "#7C3AED" },
  "social studies":{ icon: Landmark,   bg: "#F3E8FF", color: "#7C3AED" },
  araling:        { icon: Landmark,     bg: "#F3E8FF", color: "#7C3AED" },
}
const DEFAULT_STYLE: SubjectStyle = { icon: GraduationCap, bg: "#F5F3EF", color: "#8E8E9E" }

function subjectStyle(subject: string): SubjectStyle {
  return SUBJECT_STYLES[subject.toLowerCase()] ?? DEFAULT_STYLE
}

// ── Input helper ───────────────────────────────────────────────
const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

// ── Class card ─────────────────────────────────────────────────

function ClassCard({ cls, onClick }: { cls: ClassItem; onClick: () => void }) {
  const style = subjectStyle(cls.subject)
  const Icon = style.icon
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-[14px] border border-border-light shadow-card p-5 cursor-pointer flex flex-col gap-3 transition-all duration-[250ms] hover:shadow-card-hover hover:-translate-y-[2px]"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: style.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: style.color }} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base text-ink-primary truncate">
            {cls.name}
          </h3>
          <p className="font-body text-[13px] text-ink-secondary mt-0.5">
            {cls.subject} &middot; Grade {cls.grade_level}
            {cls.section ? ` · Section ${cls.section}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-2 border-t border-border-light">
        <Users className="w-3.5 h-3.5 text-ink-tertiary" strokeWidth={1.75} />
        <span className="font-body text-[12px] text-ink-tertiary">
          {cls.student_count} {cls.student_count === 1 ? "student" : "students"}
        </span>
      </div>
    </div>
  )
}

// ── Create class modal ─────────────────────────────────────────

const GRADE_LEVELS = ["7", "8", "9", "10", "11", "12"]

function CreateClassModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (cls: ClassItem) => void
}) {
  const [form, setForm] = useState<ClassCreateData>({
    name: "",
    subject: "",
    grade_level: "",
    section: "",
    academic_year: "",
  })
  const [loading, setLoading] = useState(false)

  const set = (field: keyof ClassCreateData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const cls = await api.createClass({ ...form, section: form.section || undefined })
      onCreated(cls)
      onOpenChange(false)
      toast.success(`Class "${cls.name}" created!`)
      setForm({ name: "", subject: "", grade_level: "", section: "", academic_year: "" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create class")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-[20px] p-8">
        <DialogHeader>
          <DialogTitle className="font-display font-semibold text-xl text-ink-primary">
            Create New Class
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">
              Class Name <span className="text-danger-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Science 9 — Archimedes"
              required
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">
              Subject <span className="text-danger-500">*</span>
            </label>
            <input
              value={form.subject}
              onChange={set("subject")}
              placeholder="e.g. Science, Mathematics, English"
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">
                Grade Level <span className="text-danger-500">*</span>
              </label>
              <select value={form.grade_level} onChange={set("grade_level")} required className={cn(inputCls, "cursor-pointer")}>
                <option value="" disabled>Select…</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-secondary font-body">Section</label>
              <input
                value={form.section}
                onChange={set("section")}
                placeholder="e.g. A, B, Rizal"
                className={inputCls}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">
              Academic Year <span className="text-danger-500">*</span>
            </label>
            <input
              value={form.academic_year}
              onChange={set("academic_year")}
              placeholder="e.g. 2025-2026"
              required
              className={inputCls}
            />
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? "Creating…" : "Create Class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function ClassesPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    api.getClasses()
      .then((res) => setClasses(res.items))
      .catch(() => toast.error("Failed to load classes"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-[30px] text-ink-primary leading-tight">
            My Classes
          </h1>
          <p className="font-body text-sm text-ink-secondary mt-1">
            Manage your classes and student rosters
          </p>
        </div>
        <Button variant="gradient" size="lg" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Create Class
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-[14px]" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes yet"
          description="You haven't created any classes yet. Create your first class to get started."
          actionLabel="Create Class"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
            />
          ))}
        </div>
      )}

      <CreateClassModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={(cls) => setClasses((prev) => [cls, ...prev])}
      />
    </div>
  )
}
