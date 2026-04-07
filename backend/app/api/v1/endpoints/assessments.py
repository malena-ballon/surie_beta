import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import AsyncSessionLocal, get_db
from app.models import Assessment, AssessmentStatus, Classroom, Question, SourceMaterial, User, UserRole
from app.models.question import CreatedVia, QuestionType
from app.schemas.assessments import (
    AssessmentCreate,
    AssessmentDetail,
    AssessmentItem,
    AssessmentUpdate,
    GenerateRequest,
    PaginatedAssessments,
    PublishRequest,
    QuestionCreate,
    QuestionItem,
    QuestionUpdate,
    ReorderRequest,
)
from app.services.ai_generation import generate_exam_questions

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────


async def _get_assessment_or_403(
    assessment_id: uuid.UUID, db: AsyncSession, current_user: User
) -> Assessment:
    result = await db.execute(
        select(Assessment).where(Assessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if current_user.role != UserRole.admin and assessment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return assessment


async def _question_count(assessment_id: uuid.UUID, db: AsyncSession) -> int:
    return await db.scalar(
        select(func.count(Question.id)).where(Question.assessment_id == assessment_id)
    ) or 0


def _to_item(assessment: Assessment, question_count: int) -> AssessmentItem:
    return AssessmentItem(
        id=assessment.id,
        title=assessment.title,
        description=assessment.description,
        class_id=assessment.class_id,
        teacher_id=assessment.teacher_id,
        source_material_id=assessment.source_material_id,
        difficulty=assessment.difficulty,
        status=assessment.status,
        start_at=assessment.start_at,
        end_at=assessment.end_at,
        time_limit_minutes=assessment.time_limit_minutes,
        question_count=question_count,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
    )


# ── List assessments ──────────────────────────────────────────


@router.get("", response_model=PaginatedAssessments)
async def list_assessments(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: AssessmentStatus | None = Query(None),
    class_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAssessments:
    base = select(Assessment).where(Assessment.teacher_id == current_user.id)
    if status:
        base = base.where(Assessment.status == status)
    if class_id:
        base = base.where(Assessment.class_id == class_id)
    if search:
        base = base.where(Assessment.title.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    result = await db.execute(
        base.order_by(Assessment.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    assessments = result.scalars().all()

    # Batch question counts
    a_ids = [a.id for a in assessments]
    counts: dict[uuid.UUID, int] = {}
    if a_ids:
        cnt = await db.execute(
            select(Question.assessment_id, func.count().label("n"))
            .where(Question.assessment_id.in_(a_ids))
            .group_by(Question.assessment_id)
        )
        counts = {row.assessment_id: row.n for row in cnt}

    return PaginatedAssessments(
        items=[_to_item(a, counts.get(a.id, 0)) for a in assessments],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


# ── Create assessment ─────────────────────────────────────────


@router.post("", response_model=AssessmentItem, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    body: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentItem:
    # Verify class belongs to teacher
    cls_result = await db.execute(
        select(Classroom).where(
            Classroom.id == body.class_id,
            Classroom.teacher_id == current_user.id,
        )
    )
    if not cls_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Class not found")

    assessment = Assessment(
        teacher_id=current_user.id,
        **body.model_dump(),
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return _to_item(assessment, 0)


# ── Get assessment detail ─────────────────────────────────────


@router.get("/{assessment_id}", response_model=AssessmentDetail)
async def get_assessment(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentDetail:
    # Teachers/admins use the full auth check; students can view published assessments
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    is_teacher_or_admin = (
        current_user.role == UserRole.admin or assessment.teacher_id == current_user.id
    )
    if not is_teacher_or_admin:
        if assessment.status != AssessmentStatus.published:
            raise HTTPException(status_code=403, detail="Access denied")

    q_result = await db.execute(
        select(Question)
        .where(Question.assessment_id == assessment.id)
        .order_by(Question.display_order)
    )
    questions = q_result.scalars().all()

    return AssessmentDetail(
        **_to_item(assessment, len(questions)).model_dump(),
        questions=[QuestionItem.model_validate(q) for q in questions],
    )


# ── Update assessment ─────────────────────────────────────────


@router.put("/{assessment_id}", response_model=AssessmentItem)
async def update_assessment(
    assessment_id: uuid.UUID,
    body: AssessmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentItem:
    assessment = await _get_assessment_or_403(assessment_id, db, current_user)
    for key, val in body.model_dump(exclude_none=True).items():
        setattr(assessment, key, val)
    await db.commit()
    await db.refresh(assessment)
    return _to_item(assessment, await _question_count(assessment.id, db))


# ── Publish assessment ────────────────────────────────────────


@router.put("/{assessment_id}/publish", response_model=AssessmentItem)
async def publish_assessment(
    assessment_id: uuid.UUID,
    body: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentItem:
    assessment = await _get_assessment_or_403(assessment_id, db, current_user)
    assessment.status = AssessmentStatus.published
    if body.start_at is not None:
        assessment.start_at = body.start_at
    if body.end_at is not None:
        assessment.end_at = body.end_at
    await db.commit()
    await db.refresh(assessment)
    return _to_item(assessment, await _question_count(assessment.id, db))


# ── Delete assessment ─────────────────────────────────────────


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assessment(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    assessment = await _get_assessment_or_403(assessment_id, db, current_user)
    await db.delete(assessment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Add question ──────────────────────────────────────────────


@router.post(
    "/{assessment_id}/questions",
    response_model=QuestionItem,
    status_code=status.HTTP_201_CREATED,
)
async def add_question(
    assessment_id: uuid.UUID,
    body: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionItem:
    await _get_assessment_or_403(assessment_id, db, current_user)
    question = Question(
        assessment_id=assessment_id,
        created_via=CreatedVia.manual,
        **body.model_dump(exclude={"created_via"}),
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return QuestionItem.model_validate(question)


# ── Reorder questions ─────────────────────────────────────────


@router.put("/{assessment_id}/questions/reorder", response_model=list[QuestionItem])
async def reorder_questions(
    assessment_id: uuid.UUID,
    body: ReorderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuestionItem]:
    await _get_assessment_or_403(assessment_id, db, current_user)

    for item in body.questions:
        result = await db.execute(
            select(Question).where(
                Question.id == item.question_id,
                Question.assessment_id == assessment_id,
            )
        )
        question = result.scalar_one_or_none()
        if question:
            question.display_order = item.order

    await db.commit()

    q_result = await db.execute(
        select(Question)
        .where(Question.assessment_id == assessment_id)
        .order_by(Question.display_order)
    )
    return [QuestionItem.model_validate(q) for q in q_result.scalars().all()]


# ── Generate questions via AI ─────────────────────────────────


@router.post("/{assessment_id}/generate", response_model=list[QuestionItem])
async def generate_questions(
    assessment_id: uuid.UUID,
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuestionItem]:
    assessment = await _get_assessment_or_403(assessment_id, db, current_user)

    if not assessment.source_material_id:
        raise HTTPException(status_code=400, detail="No source material linked to this assessment")

    mat_result = await db.execute(
        select(SourceMaterial).where(SourceMaterial.id == assessment.source_material_id)
    )
    material = mat_result.scalar_one_or_none()
    if not material or not material.content_text:
        raise HTTPException(status_code=400, detail="Source material has no extractable text")

    # Capture values before releasing DB session
    content_text = material.content_text
    difficulty_value = assessment.difficulty.value

    # Close DB session before long Anthropic call to avoid connection timeout
    await db.close()

    try:
        generated = await generate_exam_questions(
            source_text=content_text,
            question_breakdown=body.question_breakdown,
            difficulty=difficulty_value,
            subject=body.subject,
            grade_level=body.grade_level,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")

    # Reopen session to save results
    try:
        async with AsyncSessionLocal() as save_db:
            # Delete existing AI-generated questions first (regenerate scenario)
            existing_qs = await save_db.execute(
                select(Question).where(
                    Question.assessment_id == assessment_id,
                    Question.created_via == CreatedVia.ai,
                )
            )
            for old_q in existing_qs.scalars().all():
                await save_db.delete(old_q)
            await save_db.flush()

            questions: list[Question] = []
            for i, q_data in enumerate(generated):
                q_type = q_data.get("question_type", "identification")
                # Validate question type — fall back to identification if unknown
                valid_types = {t.value for t in QuestionType}
                if q_type not in valid_types:
                    q_type = "identification"

                q = Question(
                    assessment_id=assessment_id,
                    question_text=q_data["question_text"],
                    question_type=q_type,
                    choices=q_data.get("choices"),
                    correct_answer=q_data.get("correct_answer", ""),
                    explanation=q_data.get("explanation"),
                    subtopic_tags=q_data.get("subtopic_tags"),
                    blooms_level=q_data.get("blooms_level"),
                    difficulty=q_data.get("difficulty"),
                    display_order=i + 1,
                    created_via=CreatedVia.ai,
                )
                save_db.add(q)
                questions.append(q)

            await save_db.commit()
            for q in questions:
                await save_db.refresh(q)

            return [QuestionItem.model_validate(q) for q in questions]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save generated questions: {exc}")


# ── Update question ───────────────────────────────────────────


questions_router = APIRouter()


@questions_router.put("/{question_id}", response_model=QuestionItem)
async def update_question(
    question_id: uuid.UUID,
    body: QuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionItem:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Verify ownership via assessment
    await _get_assessment_or_403(question.assessment_id, db, current_user)

    for key, val in body.model_dump(exclude_none=True).items():
        setattr(question, key, val)
    await db.commit()
    await db.refresh(question)
    return QuestionItem.model_validate(question)


@questions_router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await _get_assessment_or_403(question.assessment_id, db, current_user)

    await db.delete(question)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
