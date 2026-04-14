import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.assessment import AssessmentStatus, DifficultyLevel
from app.models.question import CreatedVia, QuestionType


# ── Questions ─────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    question_text: str
    question_type: QuestionType
    choices: list | None = None
    correct_answer: str
    explanation: str | None = None
    subtopic_tags: list | None = None
    blooms_level: str | None = None
    difficulty: str | None = None
    display_order: int
    max_marks: float = 1.0
    created_via: CreatedVia = CreatedVia.manual


class QuestionUpdate(BaseModel):
    question_text: str | None = None
    question_type: QuestionType | None = None
    choices: list | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    subtopic_tags: list | None = None
    blooms_level: str | None = None
    difficulty: str | None = None
    display_order: int | None = None
    max_marks: float | None = None


class QuestionItem(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    question_text: str
    question_type: QuestionType
    choices: list | None
    correct_answer: str
    explanation: str | None
    subtopic_tags: list | None
    blooms_level: str | None
    difficulty: str | None
    display_order: int
    max_marks: float
    created_via: CreatedVia
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Reorder ───────────────────────────────────────────────────

class QuestionOrderItem(BaseModel):
    question_id: uuid.UUID
    order: int


class ReorderRequest(BaseModel):
    questions: list[QuestionOrderItem]


# ── Assessments ───────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    title: str
    description: str | None = None
    class_id: uuid.UUID
    difficulty: DifficultyLevel
    source_material_id: uuid.UUID | None = None
    time_limit_minutes: int | None = None


class AssessmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    difficulty: DifficultyLevel | None = None
    source_material_id: uuid.UUID | None = None
    class_id: uuid.UUID | None = None
    time_limit_minutes: int | None = None


class PublishRequest(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    time_limit_minutes: int | None = None
    release_mode: str = "auto"


class AssessmentItem(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    class_id: uuid.UUID
    teacher_id: uuid.UUID
    source_material_id: uuid.UUID | None
    difficulty: DifficultyLevel
    status: AssessmentStatus
    start_at: datetime | None
    end_at: datetime | None
    time_limit_minutes: int | None
    question_count: int
    release_mode: str
    grades_released: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeacherResponseOverride(BaseModel):
    score: float | None = None
    is_correct: bool | None = None
    feedback: str | None = None
    teacher_comment: str | None = None


class AssessmentDetail(AssessmentItem):
    questions: list[QuestionItem]


class PaginatedAssessments(BaseModel):
    items: list[AssessmentItem]
    total: int
    page: int
    per_page: int
    pages: int


class GenerateRequest(BaseModel):
    question_breakdown: dict[str, int]
    subject: str
    grade_level: str
