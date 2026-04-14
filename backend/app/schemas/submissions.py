import uuid
from datetime import datetime

from pydantic import BaseModel


class ResponseInput(BaseModel):
    question_id: uuid.UUID
    student_answer: str


class SaveResponsesRequest(BaseModel):
    responses: list[ResponseInput]


class ResponseItem(BaseModel):
    id: uuid.UUID
    submission_id: uuid.UUID
    question_id: uuid.UUID
    student_answer: str | None
    is_correct: bool | None
    score: float | None
    graded_by: str | None
    feedback: str | None = None
    rubric: list | None = None
    teacher_comment: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuestionForStudent(BaseModel):
    id: uuid.UUID
    question_text: str
    question_type: str
    choices: list | None
    display_order: int
    match_options: list[str] | None = None  # shuffled right-column values for matching questions

    model_config = {"from_attributes": True}

    @classmethod
    def from_question(cls, q: object) -> "QuestionForStudent":
        import json, random
        base = cls.model_validate(q)
        # For matching questions, derive shuffled options from correct_answer without exposing mapping
        if base.question_type == "matching":
            try:
                pairs = json.loads(q.correct_answer or "[]")  # type: ignore[union-attr]
                if isinstance(pairs, list):
                    opts = [p.get("match", "") for p in pairs if p.get("match")]
                elif isinstance(pairs, dict):
                    opts = list(pairs.values())
                else:
                    opts = []
                random.shuffle(opts)
                base.match_options = opts
            except Exception:
                base.match_options = []
        return base


class SubmissionItem(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    started_at: datetime
    submitted_at: datetime | None
    total_score: float | None
    max_score: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubmissionWithQuestions(SubmissionItem):
    questions: list[QuestionForStudent]


class SubmissionWithResponses(SubmissionItem):
    responses: list[ResponseItem]


class StudentAssessmentItem(BaseModel):
    id: uuid.UUID
    title: str
    class_name: str
    subject: str
    difficulty: str
    status: str
    start_at: datetime | None
    end_at: datetime | None
    question_count: int
    submission_id: uuid.UUID | None
    submission_status: str | None
    total_score: float | None
    max_score: int | None
    release_mode: str = "auto"
    grades_released: bool = False
    release_type: str = "none"
