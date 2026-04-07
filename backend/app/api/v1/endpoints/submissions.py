import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import (
    Assessment,
    AssessmentStatus,
    Classroom,
    Enrollment,
    Question,
    Submission,
    User,
    UserRole,
)
from app.models.response import Response as ResponseModel
from app.models.submission import SubmissionStatus
from app.schemas.submissions import (
    QuestionForStudent,
    ResponseInput,
    ResponseItem,
    SaveResponsesRequest,
    StudentAssessmentItem,
    SubmissionItem,
    SubmissionWithQuestions,
    SubmissionWithResponses,
)

router = APIRouter()


# ── Start exam ────────────────────────────────────────────────


@router.post("", response_model=SubmissionWithQuestions, status_code=status.HTTP_201_CREATED)
async def start_exam(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionWithQuestions:
    assessment_id = uuid.UUID(str(body.get("assessment_id")))

    # Fetch assessment
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment.status != AssessmentStatus.published:
        raise HTTPException(status_code=400, detail="Assessment is not published")

    now = datetime.now(timezone.utc)

    def _to_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    if assessment.start_at and now < _to_utc(assessment.start_at):
        raise HTTPException(status_code=400, detail="Exam has not started yet")
    if assessment.end_at and now > _to_utc(assessment.end_at):
        raise HTTPException(status_code=400, detail="Exam has already ended")

    # Check for existing submission
    existing = await db.scalar(
        select(Submission).where(
            Submission.assessment_id == assessment_id,
            Submission.student_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already started or submitted this exam")

    # Count questions
    q_count = await db.scalar(
        select(func.count(Question.id)).where(Question.assessment_id == assessment_id)
    ) or 0

    submission = Submission(
        assessment_id=assessment_id,
        student_id=current_user.id,
        status=SubmissionStatus.in_progress,
        started_at=now,
        max_score=q_count,
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    # Fetch questions (no correct answers/explanations)
    q_result = await db.execute(
        select(Question)
        .where(Question.assessment_id == assessment_id)
        .order_by(Question.display_order)
    )
    questions = q_result.scalars().all()

    return SubmissionWithQuestions(
        **SubmissionItem.model_validate(submission).model_dump(),
        questions=[QuestionForStudent.from_question(q) for q in questions],
    )


# ── Auto-save responses ───────────────────────────────────────


@router.put("/{submission_id}/responses", response_model=list[ResponseItem])
async def save_responses(
    submission_id: uuid.UUID,
    body: SaveResponsesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ResponseItem]:
    submission = await _get_submission_or_403(submission_id, db, current_user)
    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(status_code=400, detail="Submission is already finalized")

    saved: list[ResponseModel] = []
    for item in body.responses:
        existing = await db.scalar(
            select(ResponseModel).where(
                ResponseModel.submission_id == submission_id,
                ResponseModel.question_id == item.question_id,
            )
        )
        if existing:
            existing.student_answer = item.student_answer
            saved.append(existing)
        else:
            r = ResponseModel(
                submission_id=submission_id,
                question_id=item.question_id,
                student_answer=item.student_answer,
            )
            db.add(r)
            saved.append(r)

    await db.commit()
    for r in saved:
        await db.refresh(r)

    return [ResponseItem.model_validate(r) for r in saved]


# ── Submit exam ───────────────────────────────────────────────


@router.post("/{submission_id}/submit", response_model=SubmissionWithResponses)
async def submit_exam(
    submission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionWithResponses:
    submission = await _get_submission_or_403(submission_id, db, current_user)
    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(status_code=400, detail="Submission is already finalized")

    # Fetch all questions
    q_result = await db.execute(
        select(Question).where(Question.assessment_id == submission.assessment_id)
    )
    questions = {q.id: q for q in q_result.scalars().all()}

    # Fetch all responses
    r_result = await db.execute(
        select(ResponseModel).where(ResponseModel.submission_id == submission_id)
    )
    responses = r_result.scalars().all()

    has_essay = False
    total_score = 0.0

    for resp in responses:
        q = questions.get(resp.question_id)
        if not q:
            continue

        q_type = str(q.question_type.value if hasattr(q.question_type, "value") else q.question_type)

        if q_type == "essay":
            has_essay = True
            resp.graded_by = None
            resp.score = None
            resp.is_correct = None
        elif q_type == "mcq":
            correct = str(q.correct_answer or "").strip()
            answer = str(resp.student_answer or "").strip()
            resp.is_correct = answer == correct
            resp.score = 1.0 if resp.is_correct else 0.0
            total_score += resp.score
        else:
            # true_false, identification
            correct = str(q.correct_answer or "").strip().lower()
            answer = str(resp.student_answer or "").strip().lower()
            resp.is_correct = answer == correct
            resp.score = 1.0 if resp.is_correct else 0.0
            total_score += resp.score

    submission.submitted_at = datetime.now(timezone.utc)
    submission.total_score = total_score
    submission.status = (
        SubmissionStatus.pending_review if has_essay else SubmissionStatus.graded
    )

    await db.commit()
    await db.refresh(submission)
    for r in responses:
        await db.refresh(r)

    return SubmissionWithResponses(
        **SubmissionItem.model_validate(submission).model_dump(),
        responses=[ResponseItem.model_validate(r) for r in responses],
    )


# ── Resume submission (returns questions, no correct answers) ─


@router.get("/{submission_id}/resume", response_model=SubmissionWithQuestions)
async def resume_exam(
    submission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionWithQuestions:
    submission = await _get_submission_or_403(submission_id, db, current_user)

    q_result = await db.execute(
        select(Question)
        .where(Question.assessment_id == submission.assessment_id)
        .order_by(Question.display_order)
    )
    questions = q_result.scalars().all()

    return SubmissionWithQuestions(
        **SubmissionItem.model_validate(submission).model_dump(),
        questions=[QuestionForStudent.from_question(q) for q in questions],
    )


# ── Get submission ────────────────────────────────────────────


@router.get("/{submission_id}", response_model=SubmissionWithResponses)
async def get_submission(
    submission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionWithResponses:
    submission = await _get_submission_or_403(submission_id, db, current_user)

    r_result = await db.execute(
        select(ResponseModel).where(ResponseModel.submission_id == submission_id)
    )
    responses = r_result.scalars().all()

    return SubmissionWithResponses(
        **SubmissionItem.model_validate(submission).model_dump(),
        responses=[ResponseItem.model_validate(r) for r in responses],
    )


# ── Student: list assigned assessments ───────────────────────


@router.get("/students/assessments", response_model=list[StudentAssessmentItem])
async def list_student_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StudentAssessmentItem]:
    # Get enrolled class IDs
    enroll_result = await db.execute(
        select(Enrollment.class_id).where(Enrollment.student_id == current_user.id)
    )
    class_ids = [r for r in enroll_result.scalars().all()]

    if not class_ids:
        return []

    # Get published assessments for those classes
    a_result = await db.execute(
        select(Assessment, Classroom)
        .join(Classroom, Assessment.class_id == Classroom.id)
        .where(
            Assessment.class_id.in_(class_ids),
            Assessment.status == AssessmentStatus.published,
        )
        .order_by(Assessment.end_at.asc())
    )
    rows = a_result.all()

    # Get submissions for this student
    sub_result = await db.execute(
        select(Submission).where(Submission.student_id == current_user.id)
    )
    subs = {s.assessment_id: s for s in sub_result.scalars().all()}

    # Count questions per assessment
    a_ids = [row[0].id for row in rows]
    cnt_result = await db.execute(
        select(Question.assessment_id, func.count().label("n"))
        .where(Question.assessment_id.in_(a_ids))
        .group_by(Question.assessment_id)
    )
    q_counts = {row.assessment_id: row.n for row in cnt_result}

    items = []
    for assessment, classroom in rows:
        sub = subs.get(assessment.id)
        items.append(
            StudentAssessmentItem(
                id=assessment.id,
                title=assessment.title,
                class_name=classroom.name,
                subject=classroom.subject,
                difficulty=assessment.difficulty.value if hasattr(assessment.difficulty, "value") else assessment.difficulty,
                status=assessment.status.value if hasattr(assessment.status, "value") else assessment.status,
                start_at=assessment.start_at,
                end_at=assessment.end_at,
                question_count=q_counts.get(assessment.id, 0),
                submission_id=sub.id if sub else None,
                submission_status=sub.status.value if sub and hasattr(sub.status, "value") else (sub.status if sub else None),
                total_score=sub.total_score if sub else None,
                max_score=sub.max_score if sub else None,
            )
        )

    return items


# ── Helper ────────────────────────────────────────────────────


async def _get_submission_or_403(
    submission_id: uuid.UUID, db: AsyncSession, current_user: User
) -> Submission:
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if current_user.role != UserRole.admin and submission.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return submission
