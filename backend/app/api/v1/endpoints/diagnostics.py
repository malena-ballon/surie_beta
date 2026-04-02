import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Assessment, Question, User, UserRole
from app.models.diagnostic_report import DiagnosticReport
from app.models.response import Response as ResponseModel
from app.models.submission import Submission, SubmissionStatus
from app.services.diagnostic_service import generate_diagnostic_report
from app.services.reassessment_service import generate_class_reassessment


class ReassessmentRequest(BaseModel):
    target_subtopics: list[str] = []
    question_count: int = 10
    difficulty: str = "medium"
    subject: str = ""
    grade_level: str = ""
    mastery_threshold: float = 60.0

router = APIRouter()


async def _get_assessment_or_403(
    assessment_id: uuid.UUID, db: AsyncSession, current_user: User
) -> Assessment:
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if current_user.role != UserRole.admin and assessment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return assessment


def _report_to_dict(report: DiagnosticReport) -> dict:
    return {
        "id": str(report.id),
        "assessment_id": str(report.assessment_id),
        "class_id": str(report.class_id),
        "avg_score": report.avg_score,
        "mastery_rate": report.mastery_rate,
        "score_distribution": report.score_distribution,
        "subtopic_mastery": report.subtopic_mastery,
        "topics_to_reteach": report.topics_to_reteach,
        "class_strengths": report.class_strengths,
        "student_summaries": report.student_summaries or [],
        "generated_at": report.generated_at.isoformat(),
    }


@router.post("/{assessment_id}/diagnostics/generate")
async def generate_diagnostics(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_assessment_or_403(assessment_id, db, current_user)
    try:
        report = await generate_diagnostic_report(assessment_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Diagnostic generation failed: {e}")
    return _report_to_dict(report)


@router.get("/{assessment_id}/diagnostics")
async def get_diagnostics(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict | None:
    await _get_assessment_or_403(assessment_id, db, current_user)
    result = await db.execute(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == assessment_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        return None
    return _report_to_dict(report)


@router.post("/{assessment_id}/reassessment/generate")
async def generate_reassessment(
    assessment_id: uuid.UUID,
    body: ReassessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_assessment_or_403(assessment_id, db, current_user)

    # Close session before long AI call
    await db.close()

    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as work_db:
        try:
            new_assessment = await generate_class_reassessment(
                source_assessment_id=assessment_id,
                config=body.model_dump(),
                db=work_db,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Re-assessment generation failed: {e}")

        return {
            "id": str(new_assessment.id),
            "title": new_assessment.title,
            "class_id": str(new_assessment.class_id),
            "difficulty": new_assessment.difficulty.value if hasattr(new_assessment.difficulty, "value") else new_assessment.difficulty,
            "status": new_assessment.status.value if hasattr(new_assessment.status, "value") else new_assessment.status,
            "question_count": 0,
        }


@router.get("/{assessment_id}/responses")
async def get_assessment_responses(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_assessment_or_403(assessment_id, db, current_user)

    # Questions
    q_result = await db.execute(
        select(Question)
        .where(Question.assessment_id == assessment_id)
        .order_by(Question.display_order)
    )
    questions = q_result.scalars().all()
    question_map = {q.id: q for q in questions}

    # Submitted/graded submissions + student info
    sub_result = await db.execute(
        select(Submission, User)
        .join(User, Submission.student_id == User.id)
        .where(
            Submission.assessment_id == assessment_id,
            Submission.status.in_([
                SubmissionStatus.graded,
                SubmissionStatus.pending_review,
                SubmissionStatus.submitted,
            ]),
        )
    )
    rows = sub_result.all()

    # Per-question tallies
    answer_tally: dict[uuid.UUID, dict[str, int]] = {q.id: {} for q in questions}
    correct_count: dict[uuid.UUID, int] = {q.id: 0 for q in questions}
    response_count: dict[uuid.UUID, int] = {q.id: 0 for q in questions}

    student_responses = []
    for submission, student in rows:
        r_result = await db.execute(
            select(ResponseModel).where(ResponseModel.submission_id == submission.id)
        )
        responses = r_result.scalars().all()
        resp_list = []
        for r in responses:
            q = question_map.get(r.question_id)
            if not q:
                continue
            resp_list.append({
                "question_id": str(r.question_id),
                "student_answer": r.student_answer,
                "is_correct": r.is_correct,
                "score": r.score,
            })
            ans = r.student_answer or "(no answer)"
            answer_tally[r.question_id][ans] = answer_tally[r.question_id].get(ans, 0) + 1
            response_count[r.question_id] += 1
            if r.is_correct:
                correct_count[r.question_id] += 1

        student_responses.append({
            "student_id": str(student.id),
            "student_name": f"{student.first_name} {student.last_name}",
            "submission_id": str(submission.id),
            "status": submission.status.value,
            "total_score": submission.total_score,
            "max_score": float(submission.max_score),
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            "responses": resp_list,
        })

    question_analysis = []
    for q in questions:
        total = response_count[q.id]
        correct = correct_count[q.id]
        question_analysis.append({
            "question_id": str(q.id),
            "question_text": q.question_text,
            "question_type": q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
            "choices": q.choices,
            "correct_answer": q.correct_answer,
            "subtopic_tags": q.subtopic_tags,
            "total_responses": total,
            "correct_count": correct,
            "correct_pct": round(correct / total * 100) if total else 0,
            "answer_distribution": answer_tally[q.id],
        })

    return {
        "student_responses": student_responses,
        "question_analysis": question_analysis,
    }


@router.get("/{assessment_id}/diagnostics/students")
async def get_student_diagnostics(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    await _get_assessment_or_403(assessment_id, db, current_user)
    result = await db.execute(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == assessment_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        return []
    return report.student_summaries or []
