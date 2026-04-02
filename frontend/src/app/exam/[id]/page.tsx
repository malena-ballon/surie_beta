"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("surie_token") : null
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.detail ?? `Request failed: ${res.status}`)
  return json as T
}

// ── Types ──────────────────────────────────────────────────────

interface Choice {
  label: string
  text: string
  is_correct: boolean
}

interface Question {
  id: string
  question_text: string
  question_type: "mcq" | "true_false" | "identification" | "essay"
  choices: Choice[] | null
  display_order: number
}

interface AssessmentMeta {
  title: string
  description: string | null
  time_limit_minutes: number | null
  end_at: string | null
}

interface Submission {
  id: string
  assessment_id: string
  status: string
  started_at: string
  submitted_at: string | null
  total_score: number | null
  max_score: number
  questions: Question[]
}

interface SubmissionResult {
  id: string
  status: string
  total_score: number | null
  max_score: number
  submitted_at: string | null
  responses: { question_id: string; is_correct: boolean | null; score: number | null }[]
}

// ── Countdown timer ────────────────────────────────────────────

// startedAt: ISO string when the exam was started
// timeLimitMinutes: duration in minutes (overrides endAt if set)
// endAt: absolute deadline from assessment window
function useCountdown(startedAt: string | null, timeLimitMinutes: number | null, endAt: string | null) {
  const [secs, setSecs] = useState<number | null>(null)

  useEffect(() => {
    // Determine effective end time
    let effectiveEnd: number | null = null
    if (startedAt && timeLimitMinutes) {
      effectiveEnd = new Date(startedAt).getTime() + timeLimitMinutes * 60 * 1000
    } else if (endAt) {
      effectiveEnd = new Date(endAt).getTime()
    }
    if (!effectiveEnd) return

    const update = () => {
      const diff = Math.max(0, Math.floor((effectiveEnd! - Date.now()) / 1000))
      setSecs(diff)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [startedAt, timeLimitMinutes, endAt])

  return secs
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ── Answer components ──────────────────────────────────────────

function MCQChoice({
  choice,
  selected,
  onSelect,
}: {
  choice: Choice
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-[18px] py-[14px] rounded-xl border text-left transition-all",
        selected
          ? "border-primary-500 bg-primary-50 shadow-sm"
          : "border-border-light bg-white hover:border-primary-300 hover:bg-primary-50"
      )}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-semibold font-body transition-all",
          selected
            ? "border-primary-500 bg-primary-500 text-white"
            : "border-border-default text-ink-tertiary"
        )}
      >
        {selected ? <Check className="w-3.5 h-3.5" /> : choice.label}
      </div>
      <span className="text-sm font-body text-ink-primary">{choice.text}</span>
    </button>
  )
}

function TrueFalseAnswer({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {["True", "False"].map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "py-5 rounded-xl border-2 text-base font-semibold font-body transition-all",
            value === opt
              ? "border-primary-500 bg-primary-50 text-primary-600"
              : "border-border-light bg-white text-ink-secondary hover:border-primary-300"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── Result screen ──────────────────────────────────────────────

function ResultScreen({
  result,
  onReturn,
}: {
  result: SubmissionResult
  onReturn: () => void
}) {
  const isPending = result.status === "pending_review"
  const pct = result.max_score > 0
    ? Math.round(((result.total_score ?? 0) / result.max_score) * 100)
    : 0
  const radius = 54
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ

  return (
    <div className="min-h-screen bg-surface-body flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-card p-10 max-w-[420px] w-full text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
          <Check className="w-8 h-8 text-primary-500" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-primary">Exam Submitted!</h1>
          {isPending ? (
            <p className="font-body text-sm text-ink-secondary mt-2">
              Your exam has been submitted. Your teacher will review essay questions.
            </p>
          ) : (
            <p className="font-body text-sm text-ink-secondary mt-2">Here are your results.</p>
          )}
        </div>

        {!isPending && (
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={radius} fill="none" stroke="#E8F0FE" strokeWidth="12" />
              <circle
                cx="64" cy="64" r={radius}
                fill="none"
                stroke="#0072C6"
                strokeWidth="12"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-3xl text-ink-primary">{pct}%</span>
              <span className="font-body text-xs text-ink-tertiary">
                {result.total_score ?? 0}/{result.max_score}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={onReturn}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold font-body text-sm transition-opacity hover:opacity-90"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  )
}

// ── Confirm dialog ─────────────────────────────────────────────

function ConfirmDialog({
  unanswered,
  onConfirm,
  onCancel,
}: {
  unanswered: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-[380px] w-full">
        <h2 className="font-display font-bold text-lg text-ink-primary mb-2">Submit Exam?</h2>
        {unanswered > 0 ? (
          <p className="font-body text-sm text-ink-secondary mb-6">
            You have <span className="font-semibold text-amber-600">{unanswered} unanswered question{unanswered !== 1 ? "s" : ""}</span>. Are you sure you want to submit?
          </p>
        ) : (
          <p className="font-body text-sm text-ink-secondary mb-6">
            Are you ready to submit your exam?
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border-default text-sm font-medium font-body text-ink-secondary hover:bg-surface-secondary transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white text-sm font-semibold font-body hover:opacity-90 transition-opacity"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Intro screen ───────────────────────────────────────────────

function IntroScreen({
  meta,
  onStart,
  starting,
}: {
  meta: AssessmentMeta
  onStart: () => void
  starting: boolean
}) {
  function formatLimit(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h > 0 && m > 0) return `${h} hr ${m} min`
    if (h > 0) return `${h} hr`
    return `${m} min`
  }

  return (
    <div className="min-h-screen bg-surface-body flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-card p-10 max-w-[520px] w-full flex flex-col gap-6">
        {/* Title */}
        <div>
          <p className="text-[11px] font-semibold font-body uppercase tracking-widest text-ink-tertiary mb-2">
            Exam
          </p>
          <h1 className="font-display font-bold text-2xl text-ink-primary leading-tight">
            {meta.title}
          </h1>
        </div>

        {/* Description */}
        {meta.description && (
          <p className="font-body text-sm text-ink-secondary leading-relaxed border-l-4 border-primary-200 pl-4">
            {meta.description}
          </p>
        )}

        {/* Info row */}
        <div className="flex flex-wrap gap-4">
          {meta.time_limit_minutes && (
            <div className="flex items-center gap-2 text-sm font-body text-ink-secondary">
              <Clock className="w-4 h-4 text-primary-500 shrink-0" />
              <span>
                Time limit: <span className="font-semibold text-ink-primary">{formatLimit(meta.time_limit_minutes)}</span>
              </span>
            </div>
          )}
          {meta.end_at && (
            <div className="flex items-center gap-2 text-sm font-body text-ink-secondary">
              <Clock className="w-4 h-4 text-ink-tertiary shrink-0" />
              <span>
                Closes:{" "}
                <span className="font-semibold text-ink-primary">
                  {new Date(meta.end_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </span>
            </div>
          )}
        </div>

        {meta.time_limit_minutes && (
          <p className="text-[12px] font-body text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
            The timer starts when you click <strong>Start Exam</strong>. Make sure you are ready.
          </p>
        )}

        <button
          onClick={onStart}
          disabled={starting}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold font-body text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {starting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Starting…
            </>
          ) : (
            "Start Exam"
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────

export default function ExamPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const assessmentId = params.id
  const existingSubId = searchParams.get("sub")

  const [meta, setMeta] = useState<AssessmentMeta | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState(-1) // -1 = cover slide
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const secs = useCountdown(
    submission?.started_at ?? null,
    meta?.time_limit_minutes ?? null,
    meta?.end_at ?? null
  )
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load assessment metadata
  useEffect(() => {
    req<AssessmentMeta>(`/api/v1/assessments/${assessmentId}`)
      .then((data) => setMeta(data))
      .catch(() => {})
      .finally(() => {
        if (!existingSubId) setLoading(false)
      })
  }, [assessmentId, existingSubId])

  // If resuming or reviewing an existing submission
  useEffect(() => {
    if (!existingSubId) return
    const load = async () => {
      try {
        // Check submission status first
        const subResult = await req<SubmissionResult>(`/api/v1/submissions/${existingSubId}`)
        if (subResult.status !== "in_progress") {
          // Already submitted/graded — show result screen
          setResult(subResult)
          setLoading(false)
          return
        }
        // Still in progress — resume the exam
        const sub = await req<Submission>(`/api/v1/submissions/${existingSubId}/resume`)
        setSubmission(sub)
        setShowIntro(false)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load exam"
        toast.error(msg)
        router.back()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [existingSubId, router])

  const handleStart = async () => {
    setStarting(true)
    try {
      const sub = await req<Submission>("/api/v1/submissions", {
        method: "POST",
        body: JSON.stringify({ assessment_id: assessmentId }),
      })
      setSubmission(sub)
      setShowIntro(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start exam"
      toast.error(msg)
      router.back()
    } finally {
      setStarting(false)
    }
  }

  // Auto-save every 30s
  useEffect(() => {
    if (!submission) return
    autoSaveRef.current = setInterval(() => {
      const responses = Object.entries(answers).map(([question_id, student_answer]) => ({
        question_id,
        student_answer,
      }))
      if (responses.length === 0) return
      req(`/api/v1/submissions/${submission.id}/responses`, {
        method: "PUT",
        body: JSON.stringify({ responses }),
      }).catch(() => {})
    }, 30000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [submission, answers])

  // Auto-submit when time runs out
  useEffect(() => {
    if (secs === 0 && submission && !result) {
      handleSubmit(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs])

  const handleAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleSubmit = async (force = false) => {
    if (!submission) return
    if (!force && !showConfirm) {
      setShowConfirm(true)
      return
    }
    setShowConfirm(false)
    setSubmitting(true)

    // Save all responses first
    const responses = Object.entries(answers).map(([question_id, student_answer]) => ({
      question_id,
      student_answer,
    }))
    if (responses.length > 0) {
      await req(`/api/v1/submissions/${submission.id}/responses`, {
        method: "PUT",
        body: JSON.stringify({ responses }),
      }).catch(() => {})
    }

    try {
      const res = await req<SubmissionResult>(`/api/v1/submissions/${submission.id}/submit`, {
        method: "POST",
      })
      setResult(res)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-body flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (result) {
    return <ResultScreen result={result} onReturn={() => router.push("/student")} />
  }

  if (showIntro && meta) {
    return <IntroScreen meta={meta} onStart={handleStart} starting={starting} />
  }

  if (!submission) return null

  const questions = submission.questions
  const q = current >= 0 ? questions[current] : null
  const unanswered = questions.filter((q) => !answers[q.id]).length
  const isNearEnd = secs !== null && secs < 300

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          unanswered={unanswered}
          onConfirm={() => handleSubmit(true)}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="min-h-screen bg-surface-body flex flex-col">
        {/* Top bar */}
        <div className="fixed top-0 left-0 right-0 h-14 md:h-16 bg-white shadow-sm z-40 flex items-center px-4 md:px-6 gap-3">
          <span className="font-display font-semibold text-sm md:text-base text-ink-primary flex-1 truncate">
            {meta?.title ?? "Exam"}
          </span>
          {secs !== null && (
            <div className={cn(
              "flex items-center gap-1.5 font-mono text-base md:text-xl font-bold tabular-nums shrink-0",
              isNearEnd ? "text-red-500" : "text-ink-primary"
            )}>
              <Clock className="w-4 h-4 md:w-5 md:h-5" />
              {formatTime(secs)}
            </div>
          )}
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className={cn(
              "px-3 md:px-5 py-2 rounded-xl text-sm font-semibold font-body transition-all shrink-0",
              isNearEnd
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-surface-secondary text-ink-secondary hover:bg-border-light"
            )}
          >
            {submitting ? "Submitting\u2026" : "Submit Exam"}
          </button>
        </div>

        {/* Question nav strip */}
        <div className="fixed top-14 md:top-16 left-0 right-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] z-30 px-4 md:px-6 py-2">
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide">
            {/* Cover slide tab */}
            <button
              onClick={() => setCurrent(-1)}
              title="Exam Info"
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-body shrink-0 transition-all",
                current === -1
                  ? "ring-2 ring-primary-300 bg-primary-500 text-white shadow-sm"
                  : "border border-border-default text-ink-secondary bg-white hover:border-primary-300"
              )}
            >
              i
            </button>
            {questions.map((question, i) => {
              const answered = !!answers[question.id]
              const isCurrent = i === current
              return (
                <button
                  key={question.id}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold font-body shrink-0 transition-all",
                    isCurrent
                      ? "ring-2 ring-primary-300 bg-primary-500 text-white shadow-sm"
                      : answered
                      ? "bg-primary-500 text-white"
                      : "border border-border-default text-ink-secondary bg-white hover:border-primary-300"
                  )}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 pt-[96px] md:pt-[108px] pb-24 px-4">
          <div className="max-w-[720px] mx-auto py-6">
            {current === -1 ? (
              /* Cover slide */
              <div className="bg-white rounded-2xl shadow-card p-8">
                <p className="text-[11px] font-semibold font-body uppercase tracking-widest text-ink-tertiary mb-3">
                  Exam Information
                </p>
                <h2 className="font-display font-bold text-2xl text-ink-primary leading-tight mb-4">
                  {meta?.title}
                </h2>
                {meta?.description ? (
                  <p className="font-body text-[15px] text-ink-secondary leading-relaxed border-l-4 border-primary-200 pl-4 mb-6">
                    {meta.description}
                  </p>
                ) : (
                  <p className="font-body text-sm text-ink-tertiary mb-6">No description provided.</p>
                )}
                <div className="flex flex-wrap gap-4 mb-8">
                  <div className="text-sm font-body text-ink-secondary">
                    <span className="text-ink-tertiary">Questions: </span>
                    <span className="font-semibold text-ink-primary">{questions.length}</span>
                  </div>
                  {meta?.time_limit_minutes && (
                    <div className="flex items-center gap-1.5 text-sm font-body text-ink-secondary">
                      <Clock className="w-4 h-4 text-primary-500 shrink-0" />
                      <span className="text-ink-tertiary">Time limit: </span>
                      <span className="font-semibold text-ink-primary">
                        {(() => {
                          const h = Math.floor(meta.time_limit_minutes / 60)
                          const m = meta.time_limit_minutes % 60
                          if (h > 0 && m > 0) return `${h}h ${m}min`
                          if (h > 0) return `${h}h`
                          return `${m}min`
                        })()}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setCurrent(0)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold font-body text-sm hover:opacity-90 transition-opacity"
                >
                  Go to Question 1 →
                </button>
              </div>
            ) : q ? (
              /* Question */
              <div className="bg-white rounded-2xl shadow-card p-8">
                <p className="text-[11px] font-semibold font-body uppercase tracking-widest text-ink-tertiary mb-3">
                  Question {current + 1} of {questions.length} &bull;{" "}
                  {q.question_type === "mcq"
                    ? "Multiple Choice"
                    : q.question_type === "true_false"
                    ? "True or False"
                    : q.question_type === "identification"
                    ? "Identification"
                    : "Essay"}
                </p>

                <p className="font-body text-[18px] text-ink-primary leading-relaxed mb-8">
                  {q.question_text}
                </p>

                {q.question_type === "mcq" && q.choices && (
                  <div className="flex flex-col gap-3">
                    {q.choices.map((choice) => (
                      <MCQChoice
                        key={choice.label}
                        choice={choice}
                        selected={answers[q.id] === choice.label}
                        onSelect={() => handleAnswer(q.id, choice.label)}
                      />
                    ))}
                  </div>
                )}

                {q.question_type === "true_false" && (
                  <TrueFalseAnswer
                    value={answers[q.id] ?? ""}
                    onChange={(v) => handleAnswer(q.id, v)}
                  />
                )}

                {q.question_type === "identification" && (
                  <input
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => handleAnswer(q.id, e.target.value)}
                    placeholder="Type your answer here…"
                    className="w-full h-[48px] px-4 text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-xl focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
                  />
                )}

                {q.question_type === "essay" && (
                  <div className="relative">
                    <textarea
                      value={answers[q.id] ?? ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      placeholder="Write your answer here…"
                      rows={6}
                      className="w-full px-4 py-3 text-sm font-body text-ink-primary placeholder:text-ink-tertiary bg-white border border-border-default rounded-xl focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors resize-none"
                    />
                    <span className="absolute bottom-3 right-4 text-[11px] text-ink-tertiary font-body">
                      {(answers[q.id] ?? "").split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-30 flex items-center justify-between px-6">
          <button
            onClick={() => setCurrent((c) => Math.max(-1, c - 1))}
            disabled={current === -1}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-border-default text-sm font-medium font-body text-ink-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-[13px] font-body text-ink-tertiary">
            {questions.filter((q) => answers[q.id]).length}/{questions.length} answered
          </span>
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            disabled={current === questions.length - 1}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-border-default text-sm font-medium font-body text-ink-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )
}
