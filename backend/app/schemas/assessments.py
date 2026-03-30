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
    class_id: uuid.UUID
    difficulty: DifficultyLevel
    source_material_id: uuid.UUID | None = None


class AssessmentUpdate(BaseModel):
    title: str | None = None
    difficulty: DifficultyLevel | None = None
    source_material_id: uuid.UUID | None = None


class PublishRequest(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None


class AssessmentItem(BaseModel):
    id: uuid.UUID
    title: str
    class_id: uuid.UUID
    teacher_id: uuid.UUID
    source_material_id: uuid.UUID | None
    difficulty: DifficultyLevel
    status: AssessmentStatus
    start_at: datetime | None
    end_at: datetime | None
    question_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
