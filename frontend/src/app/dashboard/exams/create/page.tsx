"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  api,
  type AssessmentItem,
  type ClassItem,
  type DifficultyLevel,
  type MaterialItem,
  type QuestionItem,
  type QuestionType,
  type Choice,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Shared input style ─────────────────────────────────────────
const inputCls =
  "w-full h-[42px] px-[14px] text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-[10px] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"

// ── Step indicator ─────────────────────────────────────────────

const STEPS = ["Configure", "Review & Edit", "Assign & Publish"]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold font-body transition-all shrink-0",
                  done
                    ? "bg-primary-500 text-white"
                    : active
                    ? "bg-brand-gradient text-white ring-4 ring-primary-500/20"
                    : "bg-surface-secondary text-ink-tertiary"
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[13px] font-body whitespace-nowrap",
                  active ? "font-semibold text-ink-primary" : "text-ink-tertiary"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-px mx-3", done ? "bg-primary-500" : "bg-border-light")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Stepper number input ───────────────────────────────────────

function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-ink-secondary hover:border-primary-500 hover:text-primary-500 transition-colors"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-body font-semibold text-ink-primary">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-ink-secondary hover:border-primary-500 hover:text-primary-500 transition-colors"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Generation overlay ─────────────────────────────────────────

const GEN_MESSAGES = [
  "Analyzing your curriculum…",
  "Crafting questions…",
  "Adding explanations…",
  "Tagging subtopics…",
]

function GeneratingOverlay() {
  const [msgIdx, setMsgIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % GEN_MESSAGES.length), 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-[20px] shadow-xl p-10 flex flex-col items-center gap-5 max-w-[340px] w-full mx-4">
        <div className="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-display font-semibold text-lg text-ink-primary mb-1">
            Generating Exam
          </p>
          <p className="font-body text-sm text-ink-secondary transition-all">{GEN_MESSAGES[msgIdx]}</p>
        </div>
      </div>
    </div>
  )
}

// ── Question type icons ────────────────────────────────────────

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "MCQ",
  true_false: "T/F",
  identification: "ID",
  essay: "Essay",
}

const TYPE_COLOR: Record<QuestionType, string> = {
  mcq: "bg-primary-50 text-primary-600",
  true_false: "bg-green-50 text-green-700",
  identification: "bg-amber-50 text-amber-700",
  essay: "bg-purple-50 text-purple-700",
}

// ══════════════════════════════════════════════════════════════
// STEP 1 — Configure
// ══════════════════════════════════════════════════════════════

interface Breakdown {
  mcq: number
  true_false: number
  identification: number
  essay: number
}

interface Step1Props {
  classes: ClassItem[]
  onDone: (result: { assessment: AssessmentItem; questions: QuestionItem[] }) => void
}

function Step1({ classes, onDone }: Step1Props) {
  const [title, setTitle] = useState("")
  const [classId, setClassId] = useState("")
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium")
  const [breakdown, setBreakdown] = useState<Breakdown>({
    mcq: 5,
    true_false: 3,
    identification: 2,
    essay: 0,
  })

  // Material state
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [materialPreview, setMaterialPreview] = useState<string | null>(null)
  const [materialFilename, setMaterialFilename] = useState<string | null>(null)
  const [prevMaterials, setPrevMaterials] = useState<MaterialItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getMaterials().then(setPrevMaterials).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(pdf|docx)$/i)) {
      toast.error("Only .pdf and .docx files are allowed")
      return
    }
    setUploading(true)
    try {
      const mat = await api.uploadMaterial(file)
      setMaterialId(mat.id)
      setMaterialFilename(mat.filename)
      setMaterialPreview(mat.preview)
      toast.success("Material uploaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const selectedClass = classes.find((c) => c.id === classId)

  const handleGenerate = async () => {
    if (!title.trim()) return toast.error("Enter a title")
    if (!classId) return toast.error("Select a class")
    if (!materialId) return toast.error("Upload a source material")
    if (total === 0) return toast.error("Add at least one question")

    setGenerating(true)
    try {
      const assessment = await api.createAssessment({
        title: title.trim(),
        class_id: classId,
        difficulty,
        source_material_id: materialId,
      })

      const activeBreakdown = Object.fromEntries(
        Object.entries(breakdown).filter(([, v]) => v > 0)
      )

      const questions = await api.generateQuestions(assessment.id, {
        question_breakdown: activeBreakdown,
        subject: selectedClass?.subject ?? "",
        grade_level: selectedClass?.grade_level ?? "",
      })

      onDone({ assessment, questions })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      {generating && <GeneratingOverlay />}
      <div className="max-w-[680px] mx-auto space-y-6">

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-ink-secondary font-body">
            Exam Title <span className="text-danger-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Unit 3 Quiz: Cellular Respiration"
            className={inputCls}
          />
        </div>

        {/* Class */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-ink-secondary font-body">
            Class <span className="text-danger-500">*</span>
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={cn(inputCls, "cursor-pointer")}
          >
            <option value="" disabled>Select a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.subject}, Grade {c.grade_level}
              </option>
            ))}
          </select>
        </div>

        {/* Source Material */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-ink-secondary font-body">
            Source Material <span className="text-danger-500">*</span>
          </label>

          {materialId ? (
            <div className="flex items-start gap-3 p-4 border border-green-200 bg-green-50 rounded-[12px]">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-body text-ink-primary truncate">
                  {materialFilename}
                </p>
                {materialPreview && (
                  <p className="text-[12px] font-body text-ink-tertiary mt-1 line-clamp-2">
                    {materialPreview}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setMaterialId(null); setMaterialFilename(null); setMaterialPreview(null) }}
                className="text-ink-tertiary hover:text-danger-500 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                ref={dragRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border-default rounded-[12px] p-8 text-center hover:border-primary-500 transition-colors cursor-pointer group"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    <p className="text-sm font-body text-ink-secondary">Uploading & extracting text…</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-ink-tertiary group-hover:text-primary-500 mx-auto mb-2 transition-colors" />
                    <p className="text-sm font-body text-ink-secondary">
                      Drag & drop a file here, or{" "}
                      <span className="text-primary-500 font-medium">browse</span>
                    </p>
                    <p className="text-[12px] font-body text-ink-tertiary mt-1">
                      PDF or DOCX, max 20MB
                    </p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>

              {/* Previous materials */}
              {prevMaterials.length > 0 && (
                <div className="mt-3">
                  <p className="text-[12px] font-body text-ink-tertiary mb-2">
                    Or select a previously uploaded file:
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {prevMaterials.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setMaterialId(m.id)
                          setMaterialFilename(m.filename)
                          setMaterialPreview(m.preview)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] border border-border-light hover:border-primary-500 hover:bg-primary-50/50 transition-all text-left"
                      >
                        <FileText className="w-4 h-4 text-ink-tertiary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-medium text-ink-primary truncate">
                            {m.filename}
                          </p>
                          <p className="text-[11px] font-body text-ink-tertiary truncate">
                            {m.preview.slice(0, 60)}…
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Question Breakdown */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-ink-secondary font-body">
            Question Breakdown
          </label>
          <div className="bg-white border border-border-light rounded-[12px] overflow-hidden divide-y divide-border-light">
            {(["mcq", "true_false", "identification", "essay"] as const).map((type) => (
              <div key={type} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={cn("px-2 py-0.5 rounded text-[11px] font-semibold", TYPE_COLOR[type])}>
                    {TYPE_LABEL[type]}
                  </span>
                  <span className="text-sm font-body text-ink-primary capitalize">
                    {type === "mcq" ? "Multiple Choice" : type === "true_false" ? "True / False" : type.replace("_", " ")}
                  </span>
                </div>
                <Stepper
                  value={breakdown[type]}
                  onChange={(v) => setBreakdown((b) => ({ ...b, [type]: v }))}
                />
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-secondary">
              <span className="text-[13px] font-semibold font-body text-ink-secondary">Total</span>
              <span className="text-[13px] font-bold font-display text-ink-primary">{total} questions</span>
            </div>
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-ink-secondary font-body">
            Difficulty
          </label>
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

        <Button variant="gradient" size="lg" className="w-full mt-2" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Generate Exam
        </Button>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 2 — Review & Edit
// ══════════════════════════════════════════════════════════════

function QuestionEditor({
  question,
  onChange,
  onDelete,
}: {
  question: QuestionItem
  onChange: (updated: Partial<QuestionItem>) => void
  onDelete: () => void
}) {
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white rounded-[14px] border border-border-light p-6 space-y-4">
      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("px-2 py-0.5 rounded text-[11px] font-semibold", TYPE_COLOR[question.question_type])}>
          {TYPE_LABEL[question.question_type]}
        </span>
        {question.blooms_level && (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-secondary text-ink-secondary capitalize">
            {question.blooms_level}
          </span>
        )}
        {question.difficulty && (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-secondary text-ink-secondary capitalize">
            {question.difficulty}
          </span>
        )}
      </div>

      {/* Question text */}
      <textarea
        value={question.question_text}
        onChange={(e) => onChange({ question_text: e.target.value })}
        rows={3}
        className={cn(inputCls, "h-auto resize-none py-3 leading-relaxed")}
      />

      {/* MCQ choices */}
      {question.question_type === "mcq" && question.choices && (
        <div className="space-y-2">
          {question.choices.map((choice, idx) => (
            <div
              key={choice.label}
              className={cn(
                "flex items-center gap-3 p-3 rounded-[10px] border transition-colors",
                choice.is_correct
                  ? "border-green-400 bg-green-50"
                  : "border-border-light bg-white"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  const updated = question.choices!.map((c, i) => ({
                    ...c,
                    is_correct: i === idx,
                  }))
                  const correct = updated[idx]
                  onChange({
                    choices: updated,
                    correct_answer: correct.label,
                  })
                }}
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  choice.is_correct
                    ? "border-green-500 bg-green-500"
                    : "border-border-default"
                )}
              >
                {choice.is_correct && <div className="w-2 h-2 rounded-full bg-white" />}
              </button>
              <span className="text-[12px] font-semibold text-ink-tertiary w-4 shrink-0">
                {choice.label}
              </span>
              <input
                value={choice.text}
                onChange={(e) => {
                  const updated = question.choices!.map((c, i) =>
                    i === idx ? { ...c, text: e.target.value } : c
                  )
                  onChange({ choices: updated })
                }}
                className="flex-1 text-sm font-body text-ink-primary bg-transparent outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Correct answer (non-MCQ) */}
      {question.question_type !== "mcq" && (
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium font-body text-ink-tertiary">Correct Answer</label>
          <input
            value={question.correct_answer}
            onChange={(e) => onChange({ correct_answer: e.target.value })}
            className={cn(inputCls, "h-[38px]")}
          />
        </div>
      )}

      {/* Subtopic tags */}
      {question.subtopic_tags && question.subtopic_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {question.subtopic_tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-body bg-primary-50 text-primary-600"
            >
              {tag}
              <button
                onClick={() =>
                  onChange({ subtopic_tags: question.subtopic_tags!.filter((t) => t !== tag) })
                }
                className="hover:text-danger-500 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Explanation */}
      <div>
        <button
          onClick={() => setExplanationOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[12px] font-medium font-body text-ink-tertiary hover:text-ink-primary transition-colors"
        >
          {explanationOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Explanation
        </button>
        {explanationOpen && (
          <textarea
            value={question.explanation ?? ""}
            onChange={(e) => onChange({ explanation: e.target.value })}
            rows={3}
            placeholder="Why this answer is correct…"
            className={cn(inputCls, "h-auto resize-none py-3 leading-relaxed mt-2")}
          />
        )}
      </div>

      {/* Delete */}
      <div className="flex justify-end pt-2 border-t border-border-light">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-body text-ink-secondary">Delete this question?</span>
            <button
              onClick={onDelete}
              className="text-[12px] font-medium font-body text-danger-500 hover:text-danger-600"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[12px] font-medium font-body text-ink-tertiary hover:text-ink-primary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium font-body text-ink-tertiary hover:text-danger-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Question
          </button>
        )}
      </div>
    </div>
  )
}

interface Step2Props {
  assessment: AssessmentItem
  initialQuestions: QuestionItem[]
  onDone: (questions: QuestionItem[]) => void
}

function Step2({ assessment, initialQuestions, onDone }: Step2Props) {
  const [questions, setQuestions] = useState<QuestionItem[]>(initialQuestions)
  const [selectedId, setSelectedId] = useState<string | null>(initialQuestions[0]?.id ?? null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null

  const handleChange = (id: string, patch: Partial<QuestionItem>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))

    // Debounced save
    clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(async () => {
      try {
        await api.updateQuestion(id, patch)
      } catch {
        toast.error("Failed to save question")
      }
    }, 800)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteQuestion(id)
      const newList = questions.filter((q) => q.id !== id)
      setQuestions(newList)
      setSelectedId(newList[0]?.id ?? null)
      toast.success("Question deleted")
    } catch {
      toast.error("Failed to delete question")
    }
  }

  const handleAddQuestion = async () => {
    try {
      const newQ = await api.updateQuestion("", {}) // placeholder — actually needs POST
      toast.info("Use the backend POST endpoint to add questions")
    } catch {
      // Add via API
      const body = {
        question_text: "New question",
        question_type: "identification" as QuestionType,
        correct_answer: "",
        display_order: questions.length + 1,
        created_via: "manual" as const,
      }
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/assessments/${assessment.id}/questions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("surie_token") ?? ""}`,
            },
            body: JSON.stringify(body),
          }
        )
        if (!res.ok) throw new Error()
        const created: QuestionItem = await res.json()
        setQuestions((qs) => [...qs, created])
        setSelectedId(created.id)
        toast.success("Question added")
      } catch {
        toast.error("Failed to add question")
      }
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-260px)]">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-white rounded-[14px] border border-border-light shadow-card flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
          <span className="font-display font-semibold text-sm text-ink-primary">
            Questions
            <span className="ml-1.5 text-[11px] font-body text-ink-tertiary bg-surface-secondary px-1.5 py-0.5 rounded-full">
              {questions.length}
            </span>
          </span>
          <button
            onClick={handleAddQuestion}
            className="w-6 h-6 rounded-md flex items-center justify-center text-ink-tertiary hover:text-primary-500 hover:bg-primary-50 transition-colors"
            title="Add question"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border-light">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setSelectedId(q.id)}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors flex items-start gap-2.5",
                selectedId === q.id ? "bg-primary-50" : "hover:bg-surface-secondary"
              )}
            >
              <span className="text-[11px] font-body text-ink-tertiary shrink-0 mt-0.5 w-4">
                Q{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-body text-ink-primary line-clamp-2 leading-snug">
                  {q.question_text}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", TYPE_COLOR[q.question_type])}>
                    {TYPE_LABEL[q.question_type]}
                  </span>
                  {q.subtopic_tags?.[0] && (
                    <span className="text-[10px] font-body text-ink-tertiary truncate">
                      {q.subtopic_tags[0]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto pr-1">
        {selectedQuestion ? (
          <QuestionEditor
            key={selectedQuestion.id}
            question={selectedQuestion}
            onChange={(patch) => handleChange(selectedQuestion.id, patch)}
            onDelete={() => handleDelete(selectedQuestion.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-ink-tertiary font-body text-sm">
            Select a question to edit
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// STEP 3 — Assign & Publish
// ══════════════════════════════════════════════════════════════

interface Step3Props {
  assessment: AssessmentItem
  questions: QuestionItem[]
  classes: ClassItem[]
}

function Step3({ assessment, questions, classes }: Step3Props) {
  const router = useRouter()
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [publishing, setPublishing] = useState(false)

  const cls = classes.find((c) => c.id === assessment.class_id)

  const handlePublish = async () => {
    setPublishing(true)
    try {
      await api.publishAssessment(assessment.id, {
        start_at: startAt || undefined,
        end_at: endAt || undefined,
      })
      toast.success("Assessment published!")
      router.push("/dashboard/exams")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="max-w-[560px] mx-auto space-y-6">
      {/* Summary card */}
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-6">
        <h3 className="font-display font-semibold text-base text-ink-primary mb-4">
          Assessment Summary
        </h3>
        <dl className="space-y-3">
          <div className="flex justify-between text-sm font-body">
            <dt className="text-ink-tertiary">Title</dt>
            <dd className="font-medium text-ink-primary text-right max-w-[280px] truncate">
              {assessment.title}
            </dd>
          </div>
          <div className="flex justify-between text-sm font-body">
            <dt className="text-ink-tertiary">Class</dt>
            <dd className="font-medium text-ink-primary">{cls?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between text-sm font-body">
            <dt className="text-ink-tertiary">Questions</dt>
            <dd className="font-medium text-ink-primary">{questions.length}</dd>
          </div>
          <div className="flex justify-between text-sm font-body">
            <dt className="text-ink-tertiary">Difficulty</dt>
            <dd className="font-medium text-ink-primary capitalize">{assessment.difficulty}</dd>
          </div>
        </dl>
      </div>

      {/* Date/time */}
      <div className="bg-white rounded-[14px] border border-border-light shadow-card p-6 space-y-4">
        <h3 className="font-display font-semibold text-base text-ink-primary">
          Availability Window <span className="text-ink-tertiary font-body font-normal text-sm">(optional)</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">Start</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className={cn(inputCls, "cursor-pointer")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-secondary font-body">End</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className={cn(inputCls, "cursor-pointer")}
            />
          </div>
        </div>
        {startAt && endAt && (
          <p className="text-[12px] font-body text-ink-tertiary">
            Available from{" "}
            <span className="font-medium text-ink-secondary">
              {new Date(startAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </span>{" "}
            to{" "}
            <span className="font-medium text-ink-secondary">
              {new Date(endAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </p>
        )}
      </div>

      <Button
        variant="gradient"
        size="lg"
        className="w-full"
        onClick={handlePublish}
        disabled={publishing}
      >
        {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Publish Assessment
      </Button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function CreateExamPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get("id")

  const [step, setStep] = useState(0)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [assessment, setAssessment] = useState<AssessmentItem | null>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])

  useEffect(() => {
    api.getClasses({ per_page: 100 }).then((res) => setClasses(res.items)).catch(() => {})
  }, [])

  // Resume draft
  useEffect(() => {
    if (!resumeId) return
    api.getAssessment(resumeId)
      .then((detail) => {
        setAssessment(detail)
        setQuestions(detail.questions)
        setStep(detail.questions.length > 0 ? 1 : 0)
      })
      .catch(() => toast.error("Failed to load assessment"))
  }, [resumeId])

  return (
    <div className="p-8 max-w-[1280px] mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/exams")}
        className="flex items-center gap-1.5 text-[13px] font-body text-ink-tertiary hover:text-ink-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Exam Library
      </button>

      <h1 className="font-display font-bold text-[28px] text-ink-primary mb-6">
        {step === 0 ? "Create New Exam" : step === 1 ? "Review Questions" : "Publish Exam"}
      </h1>

      <StepBar current={step} />

      {step === 0 && (
        <Step1
          classes={classes}
          onDone={({ assessment: a, questions: qs }) => {
            setAssessment(a)
            setQuestions(qs)
            setStep(1)
          }}
        />
      )}

      {step === 1 && assessment && (
        <>
          <Step2
            assessment={assessment}
            initialQuestions={questions}
            onDone={(qs) => {
              setQuestions(qs)
              setStep(2)
            }}
          />
          <div className="flex justify-end mt-6">
            <Button variant="gradient" onClick={() => setStep(2)}>
              Continue to Publish
            </Button>
          </div>
        </>
      )}

      {step === 2 && assessment && (
        <Step3 assessment={assessment} questions={questions} classes={classes} />
      )}
    </div>
  )
}
