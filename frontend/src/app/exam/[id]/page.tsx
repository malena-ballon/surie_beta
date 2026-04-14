"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, X, XCircle } from "lucide-react"
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
  question_type: "mcq" | "true_false" | "identification" | "essay" | "matching"
  choices: Choice[] | null
  display_order: number
  match_options: string[] | null
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

// ── Review types ───────────────────────────────────────────────

interface RubricCriterion {
  criterion: string
  score: number
  max_score: number
  feedback: string
}

interface ReviewQuestion {
  id: string
  question_text: string
  question_type: string
  question_type_label: string
  choices: Choice[] | null
  correct_answer: string | null
  explanation: string | null
  subtopic_tags: string[] | null
  display_order: number
  max_marks: number
  student_answer: string | null
  is_correct: boolean | null
  score: number | null
  feedback: string | null
  rubric: RubricCriterion[] | null
  teacher_comment: string | null
}

interface ReviewData {
  submission_id: string
  assessment_id: string
  assessment_title: string
  status: string
  submitted_at: string | null
  total_score: number | null
  max_score: number | null
  grades_released: boolean
  release_type: string
  questions: ReviewQuestion[]
}

// ── Detailed Review Screen ─────────────────────────────────────

function DetailedReviewScreen({
  review,
  onReturn,
}: {
  review: ReviewData
  onReturn: () => void
}) {
  const pct =
    review.max_score && review.max_score > 0
      ? Math.round(((review.total_score ?? 0) / review.max_score) * 100)
      : 0

  const radius = 54
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ

  const scoreColor =
    pct >= 90 ? "#1565C0" : pct >= 75 ? "#2E7D32" : pct >= 60 ? "#F57F17" : "#C62828"

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border-light px-4 md:px-8 h-14 flex items-center gap-3">
        <button
          onClick={onReturn}
          className="flex items-center gap-1.5 text-[13px] font-body text-ink-tertiary hover:text-ink-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Exams
        </button>
        <span className="text-ink-tertiary font-body text-[13px]">/</span>
        <span className="font-body text-[13px] text-ink-primary font-medium truncate">
          {review.assessment_title}
        </span>
      </div>

      <div className="max-w-[800px] mx-auto px-4 py-8 space-y-6">
        {/* Score header card */}
        <div className="bg-white rounded-2xl shadow-card p-8 flex items-center gap-8">
          <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={radius} fill="none" stroke="#F0F0F0" strokeWidth="12" />
              <circle
                cx="64" cy="64" r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-2xl text-ink-primary">{pct}%</span>
              <span className="font-body text-[11px] text-ink-tertiary">
                {review.total_score ?? 0}/{review.max_score}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-tertiary font-body mb-1">
              Exam Results
            </p>
            <h1 className="font-display font-bold text-xl text-ink-primary leading-tight mb-2">
              {review.assessment_title}
            </h1>
            {review.submitted_at && (
              <p className="font-body text-[13px] text-ink-secondary">
                Submitted{" "}
                {new Date(review.submitted_at).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
            <div className="mt-3 flex gap-4">
              <div className="text-center">
                <p className="font-display font-bold text-lg" style={{ color: scoreColor }}>
                  {review.total_score ?? 0}
                </p>
                <p className="text-[11px] font-body text-ink-tertiary">Your Score</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-lg text-ink-primary">
                  {review.max_score ?? 0}
                </p>
                <p className="text-[11px] font-body text-ink-tertiary">Total Marks</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-lg text-ink-primary">
                  {review.questions.length}
                </p>
                <p className="text-[11px] font-body text-ink-tertiary">Questions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-4">
          {review.questions.map((q, i) => {
            const isCorrect = q.is_correct === true
            const isWrong = q.is_correct === false
            const scorePct =
              q.max_marks > 0 && q.score != null
                ? Math.round((q.score / q.max_marks) * 100)
                : null

            return (
              <div
                key={q.id}
                className={cn(
                  "bg-white rounded-2xl border shadow-card overflow-hidden",
                  isCorrect ? "border-green-200" : isWrong ? "border-red-200" : "border-border-light"
                )}
              >
                {/* Question header */}
                <div
                  className={cn(
                    "flex items-center justify-between px-6 py-3 border-b",
                    isCorrect
                      ? "bg-green-50 border-green-100"
                      : isWrong
                      ? "bg-red-50 border-red-100"
                      : "bg-surface-secondary border-border-light"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    ) : isWrong ? (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    ) : null}
                    <span className="font-body text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide">
                      Q{i + 1} &bull; {q.question_type_label}
                      {q.subtopic_tags?.[0] && (
                        <span className="ml-2 normal-case text-primary-500">[{q.subtopic_tags[0]}]</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "font-display font-bold text-sm",
                        isCorrect ? "text-green-700" : isWrong ? "text-red-600" : "text-ink-secondary"
                      )}
                    >
                      {q.score ?? "—"}/{q.max_marks}
                    </span>
                    {scorePct !== null && (
                      <span className="font-body text-[11px] text-ink-tertiary">({scorePct}%)</span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Question text */}
                  <p className="font-body text-[15px] text-ink-primary leading-relaxed">
                    {q.question_text}
                  </p>

                  {/* Answer grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Student's answer */}
                    <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary mb-1.5">
                        Your Answer
                      </p>
                      <p
                        className={cn(
                          "font-body text-sm font-medium",
                          isCorrect
                            ? "text-green-700"
                            : isWrong
                            ? "text-red-600"
                            : "text-ink-secondary"
                        )}
                      >
                        {q.student_answer
                          ? q.question_type === "matching"
                            ? (() => {
                                try {
                                  const m = JSON.parse(q.student_answer)
                                  return Object.entries(m)
                                    .map(([t, v]) => `${t} → ${v}`)
                                    .join(", ")
                                } catch {
                                  return q.student_answer
                                }
                              })()
                            : q.student_answer
                          : <span className="italic text-ink-tertiary">No answer</span>}
                      </p>
                    </div>

                    {/* Correct answer */}
                    {q.correct_answer != null && (
                      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700 mb-1.5">
                          {q.question_type === "essay" ? "Model Answer" : "Correct Answer"}
                        </p>
                        <p className="font-body text-sm text-green-800">
                          {q.question_type === "matching"
                            ? (() => {
                                try {
                                  const pairs = JSON.parse(q.correct_answer)
                                  return pairs.map((p: { term: string; match: string }) => `${p.term} → ${p.match}`).join(", ")
                                } catch {
                                  return q.correct_answer
                                }
                              })()
                            : q.correct_answer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Essay rubric */}
                  {q.rubric && q.rubric.length > 0 && (
                    <div className="rounded-xl border border-border-light overflow-hidden">
                      <div className="px-4 py-2 bg-surface-secondary border-b border-border-light">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                          Scoring Rubric
                        </p>
                      </div>
                      <div className="divide-y divide-border-light">
                        {q.rubric.map((criterion, ci) => (
                          <div key={ci} className="px-4 py-3 flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-body text-[13px] font-semibold text-ink-primary">
                                {criterion.criterion}
                              </p>
                              {criterion.feedback && (
                                <p className="font-body text-[12px] text-ink-secondary mt-0.5">
                                  {criterion.feedback}
                                </p>
                              )}
                            </div>
                            <span className="font-display font-bold text-sm text-ink-primary shrink-0">
                              {criterion.score}/{criterion.max_score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI feedback */}
                  {q.feedback && (
                    <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 mb-1">
                        Feedback
                      </p>
                      <p className="font-body text-[13px] text-blue-900">{q.feedback}</p>
                    </div>
                  )}

                  {/* Teacher comment */}
                  {q.teacher_comment && (
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
                        Teacher Comment
                      </p>
                      <p className="font-body text-[13px] text-amber-900">{q.teacher_comment}</p>
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="rounded-xl bg-surface-secondary border border-border-light px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary mb-1">
                        Explanation
                      </p>
                      <p className="font-body text-[13px] text-ink-secondary">{q.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onReturn}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold font-body text-sm hover:opacity-90 transition-opacity"
        >
          Back to My Exams
        </button>
      </div>
    </div>
  )
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
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
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
          // Try to load detailed review data (only available if grades released)
          try {
            const rd = await req<ReviewData>(`/api/v1/submissions/${existingSubId}/review`)
            if (rd.grades_released && rd.release_type === "score_with_feedback") {
              setReviewData(rd)
              setLoading(false)
              return
            }
          } catch {
            // If review fails, fall through to basic result screen
          }
          // Basic result screen
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

  if (reviewData) {
    return <DetailedReviewScreen review={reviewData} onReturn={() => router.push("/student")} />
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

                {q.question_type === "matching" && (() => {
                  const terms = (q.choices ?? []).map((c) => c.text).filter(Boolean)
                  const options = q.match_options ?? []
                  let studentAns: Record<string, string> = {}
                  try { studentAns = JSON.parse(answers[q.id] || "{}") } catch { studentAns = {} }

                  const updateMatch = (term: string, val: string) => {
                    handleAnswer(q.id, JSON.stringify({ ...studentAns, [term]: val }))
                  }

                  if (terms.length === 0) return (
                    <p className="text-sm font-body text-ink-tertiary">No matching pairs defined.</p>
                  )

                  return (
                    <div className="space-y-3">
                      {terms.map((term, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1 px-4 py-3 rounded-xl border border-border-light bg-surface-secondary text-sm font-body text-ink-primary">
                            {term}
                          </div>
                          <span className="text-ink-tertiary font-body text-sm shrink-0">→</span>
                          <select
                            value={studentAns[term] ?? ""}
                            onChange={(e) => updateMatch(term, e.target.value)}
                            className="flex-1 h-[48px] px-4 text-sm font-body text-ink-primary bg-white border border-border-default rounded-xl focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
                          >
                            <option value="">Select a match…</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )
                })()}
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
