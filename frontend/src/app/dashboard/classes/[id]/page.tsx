"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Copy, Plus, RefreshCw, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { api, type ClassDetail, type StudentInfo, type StudentInput } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ── Input helper ───────────────────────────────────────────────
const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

// ── Add Students modal ─────────────────────────────────────────

function AddStudentsModal({
  open,
  onOpenChange,
  classId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  classId: string
  onAdded: () => void
}) {
  const [loading, setLoading] = useState(false)

  // Individual tab state
  const [individual, setIndividual] = useState({ first_name: "", last_name: "", email: "" })
  const [queue, setQueue] = useState<StudentInput[]>([])

  // Bulk tab state
  const [bulkText, setBulkText] = useState("")

  const setInd = (f: keyof typeof individual) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setIndividual((prev) => ({ ...prev, [f]: e.target.value }))

  const addToQueue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!individual.first_name || !individual.last_name || !individual.email) return
    setQueue((q) => [...q, { ...individual }])
    setIndividual({ first_name: "", last_name: "", email: "" })
  }

  const parseBulk = (text: string): StudentInput[] =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [first_name, last_name, email] = l.split(",").map((s) => s.trim())
        return { first_name, last_name, email }
      })
      .filter((s) => s.first_name && s.last_name && s.email)

  const submit = async (students: StudentInput[]) => {
    if (!students.length) return
    setLoading(true)
    try {
      const res = await api.addStudents(classId, students)
      toast.success(`Added ${res.added} student${res.added !== 1 ? "s" : ""}${res.already_enrolled ? ` (${res.already_enrolled} already enrolled)` : ""}`)
      setQueue([])
      setBulkText("")
      onAdded()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add students")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] rounded-[20px] p-8">
        <DialogHeader>
          <DialogTitle className="font-display font-semibold text-xl text-ink-primary">
            Add Students
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="individual" className="mt-4">
          <TabsList className="w-full bg-surface-secondary rounded-[10px] h-10 p-1">
            <TabsTrigger value="individual" className="flex-1 rounded-[8px] text-sm font-body">
              Individual
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1 rounded-[8px] text-sm font-body">
              Bulk Import
            </TabsTrigger>
          </TabsList>

          {/* Individual */}
          <TabsContent value="individual" className="mt-4 space-y-4">
            <form onSubmit={addToQueue} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={individual.first_name}
                  onChange={setInd("first_name")}
                  placeholder="First Name"
                  className={inputCls}
                />
                <input
                  value={individual.last_name}
                  onChange={setInd("last_name")}
                  placeholder="Last Name"
                  className={inputCls}
                />
              </div>
              <input
                type="email"
                value={individual.email}
                onChange={setInd("email")}
                placeholder="Email address"
                className={inputCls}
              />
              <Button type="submit" variant="secondary" className="w-full">
                <Plus className="w-4 h-4" />
                Add to List
              </Button>
            </form>

            {queue.length > 0 && (
              <div className="border border-border-light rounded-[10px] overflow-hidden">
                <div className="bg-surface-secondary px-4 py-2 border-b border-border-light">
                  <span className="text-[12px] font-medium font-body text-ink-secondary uppercase tracking-wide">
                    Pending ({queue.length})
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-border-light">
                  {queue.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium font-body text-ink-primary">
                          {s.first_name} {s.last_name}
                        </p>
                        <p className="text-[12px] font-body text-ink-tertiary">{s.email}</p>
                      </div>
                      <button
                        onClick={() => setQueue((q) => q.filter((_, j) => j !== i))}
                        className="text-ink-tertiary hover:text-danger-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border-light">
                  <Button
                    variant="gradient"
                    className="w-full"
                    disabled={loading}
                    onClick={() => submit(queue)}
                  >
                    {loading ? "Saving…" : `Save ${queue.length} Student${queue.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Bulk */}
          <TabsContent value="bulk" className="mt-4 space-y-4">
            <p className="text-[13px] font-body text-ink-secondary">
              One student per line:{" "}
              <code className="bg-surface-secondary px-1.5 py-0.5 rounded text-[12px]">
                FirstName, LastName, Email
              </code>
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              placeholder={"Maria, Santos, maria.santos@school.ph\nJuan, Dela Cruz, juan@school.ph"}
              className={cn(
                inputCls,
                "h-auto resize-none py-3 leading-relaxed font-mono text-[13px]"
              )}
            />
            <Button
              variant="gradient"
              className="w-full"
              disabled={loading || !bulkText.trim()}
              onClick={() => submit(parseBulk(bulkText))}
            >
              {loading ? "Importing…" : `Import ${parseBulk(bulkText).length} Student${parseBulk(bulkText).length !== 1 ? "s" : ""}`}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cls, setCls] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Join code copied!")
  }

  const handleRegenerateCode = async () => {
    setRegenerating(true)
    try {
      const updated = await api.regenerateJoinCode(id)
      setCls((c) => c ? { ...c, join_code: updated.join_code } : c)
      toast.success("New join code generated")
    } catch {
      toast.error("Failed to regenerate code")
    } finally {
      setRegenerating(false)
    }
  }

  const fetchClass = async () => {
    try {
      const data = await api.getClass(id)
      setCls(data)
    } catch {
      toast.error("Failed to load class")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClass() }, [id])

  const removeStudent = async (student: StudentInfo) => {
    setRemoving(student.id)
    try {
      await api.removeStudent(id, student.id)
      setCls((c) => c ? { ...c, students: c.students.filter((s) => s.id !== student.id), student_count: c.student_count - 1 } : c)
      toast.success(`${student.first_name} ${student.last_name} removed`)
    } catch {
      toast.error("Failed to remove student")
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[1280px] mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-64 rounded-[14px]" />
      </div>
    )
  }

  if (!cls) {
    return (
      <div className="p-8 text-center text-ink-secondary font-body">Class not found.</div>
    )
  }

  return (
    <div className="p-8 max-w-[1280px] mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/classes")}
        className="flex items-center gap-1.5 text-[13px] font-body text-ink-tertiary hover:text-ink-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        My Classes
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-[30px] text-ink-primary leading-tight">
            {cls.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium font-body bg-primary-50 text-primary-600">
              {cls.subject}
            </span>
            <span className="text-[13px] font-body text-ink-tertiary">
              Grade {cls.grade_level}
              {cls.section ? ` · Section ${cls.section}` : ""}
              {" · "}{cls.academic_year}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Join code card */}
          {cls.join_code && (
            <div className="flex items-center gap-2 bg-surface-secondary border border-border-light rounded-[10px] px-3 py-2">
              <div>
                <p className="text-[10px] font-body text-ink-tertiary uppercase tracking-wide leading-none mb-0.5">
                  Join Code
                </p>
                <p className="font-mono font-bold text-sm text-ink-primary tracking-[0.2em] leading-none">
                  {cls.join_code}
                </p>
              </div>
              <button
                onClick={() => copyCode(cls.join_code!)}
                className="text-ink-tertiary hover:text-primary-500 transition-colors ml-1"
                title="Copy code"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="text-ink-tertiary hover:text-ink-secondary transition-colors disabled:opacity-50"
                title="Regenerate code"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
          <Button variant="gradient" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Students
          </Button>
        </div>
      </div>

      {/* Student roster */}
      <div className="bg-white rounded-[14px] border border-border-light shadow-card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-ink-tertiary" strokeWidth={1.75} />
            <span className="font-display font-semibold text-base text-ink-primary">
              Students
            </span>
            <span className="text-[12px] font-body text-ink-tertiary bg-surface-secondary px-2 py-0.5 rounded-full">
              {cls.students.length}
            </span>
          </div>
        </div>

        {cls.students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <Users className="w-8 h-8 text-ink-tertiary mb-3" strokeWidth={1.25} />
            <p className="font-body text-sm text-ink-secondary">No students enrolled yet.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-3 text-sm text-primary-500 hover:text-primary-600 font-medium font-body transition-colors"
            >
              Add students
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-surface-secondary border-b border-border-light">
                <th className="px-6 py-3 text-left text-[11px] font-semibold font-body text-ink-tertiary uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold font-body text-ink-tertiary uppercase tracking-wide">
                  Email
                </th>
                <th className="px-6 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {cls.students.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-surface-secondary/50 transition-colors group"
                >
                  <td className="px-6 py-3.5">
                    <span className="font-body text-sm font-medium text-ink-primary">
                      {student.last_name}, {student.first_name}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="font-body text-sm text-ink-secondary">{student.email}</span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => removeStudent(student)}
                      disabled={removing === student.id}
                      className="opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-danger-500 transition-all disabled:opacity-50"
                      aria-label="Remove student"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddStudentsModal
        open={addOpen}
        onOpenChange={setAddOpen}
        classId={id}
        onAdded={fetchClass}
      />
    </div>
  )
}
