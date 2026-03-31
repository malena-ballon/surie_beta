"""
Dashboard summary endpoint — aggregated stats for the teacher overview page.
"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Assessment, Classroom, Question, User
from app.models.assessment import AssessmentStatus
from app.models.classroom import Classroom as ClassroomModel
from app.models.enrollment import Enrollment
from app.models.diagnostic_report import DiagnosticReport
from app.models.submission import Submission, SubmissionStatus

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    teacher_id = current_user.id

    # ── Total students across all classes ────────────────────────
    total_students = await db.scalar(
        select(func.count(Enrollment.student_id.distinct()))
        .join(ClassroomModel, ClassroomModel.id == Enrollment.class_id)
        .where(ClassroomModel.teacher_id == teacher_id)
    ) or 0

    # ── Total classes ────────────────────────────────────────────
    total_classes = await db.scalar(
        select(func.count()).select_from(
            select(ClassroomModel).where(ClassroomModel.teacher_id == teacher_id).subquery()
        )
    ) or 0

    # ── Assessment counts ────────────────────────────────────────
    total_exams = await db.scalar(
        select(func.count()).select_from(
            select(Assessment).where(Assessment.teacher_id == teacher_id).subquery()
        )
    ) or 0

    pending_review = await db.scalar(
        select(func.count(Submission.id.distinct()))
        .join(Assessment, Assessment.id == Submission.assessment_id)
        .where(
            Assessment.teacher_id == teacher_id,
            Submission.status == SubmissionStatus.pending_review,
        )
    ) or 0

    # ── Recent assessments (last 5) ──────────────────────────────
    result = await db.execute(
        select(Assessment)
        .where(Assessment.teacher_id == teacher_id)
        .order_by(Assessment.created_at.desc())
        .limit(5)
    )
    recent_raw = result.scalars().all()

    # Get class names
    class_ids = list({a.class_id for a in recent_raw})
    cls_result = await db.execute(
        select(ClassroomModel).where(ClassroomModel.id.in_(class_ids))
    )
    class_map = {c.id: c for c in cls_result.scalars().all()}

    # Get question counts for recent assessments
    a_ids = [a.id for a in recent_raw]
    q_counts: dict[uuid.UUID, int] = {}
    if a_ids:
        cnt = await db.execute(
            select(Question.assessment_id, func.count().label("n"))
            .where(Question.assessment_id.in_(a_ids))
            .group_by(Question.assessment_id)
        )
        q_counts = {row.assessment_id: row.n for row in cnt}

    # Get diagnostic reports for recent assessments (for avg_score)
    dr_result = await db.execute(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id.in_(a_ids))
    )
    dr_map = {dr.assessment_id: dr for dr in dr_result.scalars().all()}

    recent_assessments = []
    for a in recent_raw:
        cls = class_map.get(a.class_id)
        dr = dr_map.get(a.id)
        recent_assessments.append({
            "id": str(a.id),
            "title": a.title,
            "class_name": cls.name if cls else "",
            "subject": cls.subject if cls else "",
            "grade_level": cls.grade_level if cls else "",
            "status": a.status.value,
            "difficulty": a.difficulty.value,
            "question_count": q_counts.get(a.id, 0),
            "created_at": a.created_at.isoformat(),
            "avg_score": dr.avg_score if dr else None,
            "mastery_rate": dr.mastery_rate if dr else None,
        })

    # ── Avg mastery rate across all diagnostic reports ────────────
    avg_mastery = await db.scalar(
        select(func.avg(DiagnosticReport.mastery_rate))
        .join(Assessment, Assessment.id == DiagnosticReport.assessment_id)
        .where(Assessment.teacher_id == teacher_id)
    )

    return {
        "total_students": total_students,
        "total_classes": total_classes,
        "total_exams": total_exams,
        "pending_review": pending_review,
        "avg_mastery_rate": round(float(avg_mastery), 1) if avg_mastery else None,
        "recent_assessments": recent_assessments,
    }
