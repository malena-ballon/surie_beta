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

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken()
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.detail ?? `Upload failed: ${res.status}`)
  return json as T
}

// ── Types ──────────────────────────────────────────────────────

export interface ClassItem {
  id: string
  name: string
  subject: string
  grade_level: string
  section: string | null
  academic_year: string
  teacher_id: string
  institution_id: string
  is_archived: boolean
  student_count: number
  join_code: string | null
  created_at: string
  updated_at: string
}

export interface StudentInfo {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface ClassDetail extends ClassItem {
  students: StudentInfo[]
}

export interface PaginatedClasses {
  items: ClassItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface StudentInput {
  first_name: string
  last_name: string
  email: string
}

export interface AddStudentsResult {
  added: number
  already_enrolled: number
}

export interface ClassCreateData {
  name: string
  subject: string
  grade_level: string
  section?: string
  academic_year: string
}

// ── Assessment types ───────────────────────────────────────────

export type DifficultyLevel = "easy" | "medium" | "hard"
export type AssessmentStatus = "draft" | "published" | "closed" | "archived"
export type QuestionType = "mcq" | "true_false" | "identification" | "essay" | "matching"
export type BloomsLevel =
  | "remembering"
  | "understanding"
  | "applying"
  | "analyzing"
  | "evaluating"
  | "creating"

export interface Choice {
  label: string
  text: string
  is_correct: boolean
}

export interface QuestionItem {
  id: string
  assessment_id: string
  question_text: string
  question_type: QuestionType
  choices: Choice[] | null
  correct_answer: string
  explanation: string | null
  subtopic_tags: string[] | null
  blooms_level: BloomsLevel | null
  difficulty: DifficultyLevel | null
  display_order: number
  max_marks?: number
  created_via: "ai" | "manual" | "hybrid"
  created_at: string
  updated_at: string
}

export interface AssessmentItem {
  id: string
  title: string
  description: string | null
  class_id: string
  teacher_id: string
  source_material_id: string | null
  difficulty: DifficultyLevel
  status: AssessmentStatus
  start_at: string | null
  end_at: string | null
  time_limit_minutes: number | null
  question_count: number
  created_at: string
  updated_at: string
}

export interface AssessmentDetail extends AssessmentItem {
  questions: QuestionItem[]
}

export interface PaginatedAssessments {
  items: AssessmentItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface MaterialItem {
  id: string
  teacher_id: string
  filename: string
  file_type: string
  file_url: string
  preview: string
  created_at: string
  updated_at: string
}

export interface AssessmentCreateData {
  title: string
  description?: string | null
  class_id: string
  difficulty: DifficultyLevel
  source_material_id?: string
  time_limit_minutes?: number | null
}

export interface QuestionUpdateData {
  question_text?: string
  question_type?: QuestionType
  choices?: Choice[] | null
  correct_answer?: string
  explanation?: string | null
  subtopic_tags?: string[] | null
  blooms_level?: BloomsLevel | null
  difficulty?: DifficultyLevel | null
  display_order?: number
  max_marks?: number
}

export interface GenerateData {
  question_breakdown: Record<string, number>
  subject: string
  grade_level: string
}

export type SubmissionStatus = "in_progress" | "submitted" | "graded" | "pending_review"

export type MasteryLevel = "critical" | "remedial" | "average" | "good" | "mastered"

export interface SubtopicMastery {
  pct: number
  level: MasteryLevel
}

export interface TopicToReteach {
  subtopic: string
  avg_pct: number
  level: MasteryLevel
  misconception: string
}

export interface StudentSummary {
  student_id: string
  name: string
  score: number | null
  max_score: number
  pct: number
  status: MasteryLevel
  at_risk: boolean
  weakest_subtopic: string | null
  subtopics: Record<string, number>
}

export interface TopicGroupDetail {
  avg_pct: number
  level: MasteryLevel
  subtopics: Record<string, SubtopicMastery>
}

export interface DiagnosticReport {
  id: string
  assessment_id: string
  class_id: string
  avg_score: number
  mastery_rate: number
  score_distribution: Record<string, number>
  subtopic_mastery: Record<string, SubtopicMastery>
  topics_to_reteach: TopicToReteach[]
  class_strengths: { subtopic: string; avg_pct: number }[]
  student_summaries: StudentSummary[]
  topic_groups: Record<string, TopicGroupDetail>
  generated_at: string
}

export interface StudentAssessmentItem {
  id: string
  title: string
  class_name: string
  subject: string
  difficulty: DifficultyLevel
  status: AssessmentStatus
  start_at: string | null
  end_at: string | null
  question_count: number
  submission_id: string | null
  submission_status: SubmissionStatus | null
  total_score: number | null
  max_score: number | null
}

export interface StudentResponseItem {
  question_id: string
  student_answer: string | null
  is_correct: boolean | null
  score: number | null
}

export interface StudentSubmissionResponse {
  student_id: string
  student_name: string
  submission_id: string
  status: string
  total_score: number | null
  max_score: number
  submitted_at: string | null
  responses: StudentResponseItem[]
}

export interface QuestionAnalysis {
  question_id: string
  question_text: string
  question_type: QuestionType
  choices: Choice[] | null
  correct_answer: string
  subtopic_tags: string[] | null
  total_responses: number
  correct_count: number
  correct_pct: number
  answer_distribution: Record<string, number>
}

export interface AssessmentResponses {
  student_responses: StudentSubmissionResponse[]
  question_analysis: QuestionAnalysis[]
}

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  institution_id: string
  is_active: boolean
  avatar_url: string | null
  created_at: string
}

export interface ClassInfo {
  id: string
  name: string
  section: string | null
}

export interface DashboardReteachAssessment {
  id: string
  title: string
  class_name: string
  mastery_rate: number
}

export interface AtRiskStudent {
  student_id: string
  name: string
  section: string
  mastery_pct: number
  status: MasteryLevel
}

export interface ClassPerformanceTrendPoint {
  label: string
  date: string
  mastery: number
  assessment_id: string
  title: string
}

export interface ClassPerformanceTrend {
  class_id: string
  class_name: string
  data: ClassPerformanceTrendPoint[]
}

export interface DashboardRecentAssessment {
  id: string
  title: string
  class_name: string
  subject: string
  grade_level: string
  status: AssessmentStatus
  difficulty: DifficultyLevel
  question_count: number
  created_at: string
  avg_score: number | null
  mastery_rate: number | null
  submitted_count: number
  total_enrolled: number
}

export interface DashboardData {
  total_students: number
  total_classes: number
  total_exams: number
  draft_exams: number
  pending_review: number
  avg_mastery_rate: number | null
  classes: ClassInfo[]
  recent_assessments: DashboardRecentAssessment[]
  reteach_assessments: DashboardReteachAssessment[]
  at_risk_students: AtRiskStudent[]
  performance_trend: ClassPerformanceTrend[]
}

// ── API functions ──────────────────────────────────────────────

export const api = {
  // Classes
  getClasses(params?: { page?: number; per_page?: number; search?: string }) {
    const qs = new URLSearchParams()
    if (params?.page) qs.set("page", String(params.page))
    if (params?.per_page) qs.set("per_page", String(params.per_page))
    if (params?.search) qs.set("search", params.search)
    const q = qs.toString()
    return req<PaginatedClasses>(`/api/v1/classes${q ? `?${q}` : ""}`)
  },
  createClass(data: ClassCreateData) {
    return req<ClassItem>("/api/v1/classes", { method: "POST", body: JSON.stringify(data) })
  },
  getClass(id: string) {
    return req<ClassDetail>(`/api/v1/classes/${id}`)
  },
  updateClass(id: string, data: Partial<ClassCreateData>) {
    return req<ClassItem>(`/api/v1/classes/${id}`, { method: "PUT", body: JSON.stringify(data) })
  },
  addStudents(classId: string, students: StudentInput[]) {
    return req<AddStudentsResult>(`/api/v1/classes/${classId}/students`, {
      method: "POST",
      body: JSON.stringify({ students }),
    })
  },
  removeStudent(classId: string, studentId: string) {
    return req<void>(`/api/v1/classes/${classId}/students/${studentId}`, { method: "DELETE" })
  },
  regenerateJoinCode(classId: string) {
    return req<ClassItem>(`/api/v1/classes/${classId}/regenerate-code`, { method: "POST" })
  },

  // Assessments
  getAssessments(params?: {
    page?: number
    per_page?: number
    status?: AssessmentStatus
    class_id?: string
    search?: string
  }) {
    const qs = new URLSearchParams()
    if (params?.page) qs.set("page", String(params.page))
    if (params?.per_page) qs.set("per_page", String(params.per_page))
    if (params?.status) qs.set("status", params.status)
    if (params?.class_id) qs.set("class_id", params.class_id)
    if (params?.search) qs.set("search", params.search)
    const q = qs.toString()
    return req<PaginatedAssessments>(`/api/v1/assessments${q ? `?${q}` : ""}`)
  },
  createAssessment(data: AssessmentCreateData) {
    return req<AssessmentItem>("/api/v1/assessments", { method: "POST", body: JSON.stringify(data) })
  },
  getAssessment(id: string) {
    return req<AssessmentDetail>(`/api/v1/assessments/${id}`)
  },
  updateAssessment(id: string, data: Partial<AssessmentCreateData>) {
    return req<AssessmentItem>(`/api/v1/assessments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
  publishAssessment(id: string, data: { start_at?: string; end_at?: string; time_limit_minutes?: number | null }) {
    return req<AssessmentItem>(`/api/v1/assessments/${id}/publish`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
  generateQuestions(id: string, data: GenerateData) {
    return req<QuestionItem[]>(`/api/v1/assessments/${id}/generate`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  // Questions
  updateQuestion(id: string, data: QuestionUpdateData) {
    return req<QuestionItem>(`/api/v1/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
  deleteQuestion(id: string) {
    return req<void>(`/api/v1/questions/${id}`, { method: "DELETE" })
  },
  chatQuestion(id: string, message: string) {
    return req<{ message: string; updated_question: Partial<QuestionItem> | null }>(
      `/api/v1/questions/${id}/chat`,
      { method: "POST", body: JSON.stringify({ message }) }
    )
  },

  // Diagnostics
  getDiagnostics(assessmentId: string) {
    return req<DiagnosticReport | null>(`/api/v1/assessments/${assessmentId}/diagnostics`)
  },
  generateDiagnostics(assessmentId: string) {
    return req<DiagnosticReport>(`/api/v1/assessments/${assessmentId}/diagnostics/generate`, {
      method: "POST",
    })
  },
  getStudentDiagnostics(assessmentId: string) {
    return req<StudentSummary[]>(`/api/v1/assessments/${assessmentId}/diagnostics/students`)
  },
  generateReassessment(assessmentId: string, data: {
    target_subtopics?: string[]
    question_count?: number
    difficulty?: string
    subject?: string
    grade_level?: string
    mastery_threshold?: number
  }) {
    return req<{ id: string; title: string; class_id: string; difficulty: string; status: string }>
      (`/api/v1/assessments/${assessmentId}/reassessment/generate`, {
        method: "POST",
        body: JSON.stringify(data),
      })
  },

  getReviewers(assessmentId: string) {
    return req<Array<{
      id: string
      title: string
      subject: string
      grade_level: string
      content: string
      weak_subtopics: string[]
      generated_at: string
    }>>(`/api/v1/assessments/${assessmentId}/reviewers`)
  },
  generateReviewer(assessmentId: string, data: {
    subject?: string
    grade_level?: string
    mastery_threshold?: number
  }) {
    return req<{
      id: string
      title: string
      subject: string
      grade_level: string
      content: string
      weak_subtopics: string[]
      generated_at: string
    }>(`/api/v1/assessments/${assessmentId}/reviewer/generate`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  // Student
  getStudentAssessments() {
    return req<StudentAssessmentItem[]>("/api/v1/submissions/students/assessments")
  },
  startExam(assessmentId: string) {
    return req<{ id: string; status: string; questions: unknown[] }>("/api/v1/submissions", {
      method: "POST",
      body: JSON.stringify({ assessment_id: assessmentId }),
    })
  },

  // Materials
  getMaterials() {
    return req<MaterialItem[]>("/api/v1/materials")
  },
  uploadMaterial(file: File) {
    return uploadFile<MaterialItem>("/api/v1/materials", file)
  },

  // Assessment responses (per-student + per-question)
  getAssessmentResponses(id: string) {
    return req<AssessmentResponses>(`/api/v1/assessments/${id}/responses`)
  },

  // Assessment delete
  deleteAssessment(id: string) {
    return req<void>(`/api/v1/assessments/${id}`, { method: "DELETE" })
  },

  // Reviewer edits + PDF
  updateReviewer(reviewerId: string, content: string) {
    return req<{ id: string; content: string }>(`/api/v1/reviewers/${reviewerId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    })
  },
  async downloadReviewerPdf(reviewerId: string, filename: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("surie_token") : null
    const res = await fetch(`${BASE}/api/v1/reviewers/${reviewerId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.detail ?? `PDF generation failed: ${res.status}`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },

  // Dashboard
  getDashboard(classId?: string) {
    const qs = classId ? `?class_id=${classId}` : ""
    return req<DashboardData>(`/api/v1/dashboard${qs}`)
  },

  // Profile
  updateMe(data: { first_name?: string; last_name?: string; avatar_url?: string | null }) {
    return req<UserProfile>("/api/v1/auth/me", { method: "PUT", body: JSON.stringify(data) })
  },
  getMe() {
    return req<UserProfile>("/api/v1/auth/me")
  },
}
