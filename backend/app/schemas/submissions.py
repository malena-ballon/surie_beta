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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuestionForStudent(BaseModel):
    id: uuid.UUID
    question_text: str
    question_type: str
    choices: list | None
    display_order: int

    model_config = {"from_attributes": True}


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
