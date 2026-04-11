"""
Dashboard summary endpoint — aggregated stats for the teacher overview page.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Assessment, Question, User
from app.models.assessment import AssessmentStatus
from app.models.classroom import Classroom
from app.models.enrollment import Enrollment
from app.models.diagnostic_report import DiagnosticReport
from app.models.submission import Submission, SubmissionStatus

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    class_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    teacher_id = current_user.id

    # ── All teacher's classes (always unfiltered — used for dropdown) ──
    all_classes = (await db.execute(
        select(Classroom)
        .where(Classroom.teacher_id == teacher_id, Classroom.is_archived == False)
        .order_by(Classroom.name)
    )).scalars().all()
    class_map = {c.id: c for c in all_classes}

    # IDs in scope (filtered or all)
    scope_ids = [class_id] if class_id else [c.id for c in all_classes]

    # ── Stats ─────────────────────────────────────────────────────
    total_students = await db.scalar(
        select(func.count(Enrollment.student_id.distinct()))
        .where(Enrollment.class_id.in_(scope_ids))
    ) or 0

    total_exams = await db.scalar(
        select(func.count(Assessment.id))
        .where(Assessment.teacher_id == teacher_id, Assessment.class_id.in_(scope_ids))
    ) or 0

    draft_exams = await db.scalar(
        select(func.count(Assessment.id))
        .where(
            Assessment.teacher_id == teacher_id,
            Assessment.class_id.in_(scope_ids),
            Assessment.status == AssessmentStatus.draft,
        )
    ) or 0

    pending_review = await db.scalar(
        select(func.count(Submission.id.distinct()))
        .join(Assessment, Assessment.id == Submission.assessment_id)
        .where(
            Assessment.teacher_id == teacher_id,
            Assessment.class_id.in_(scope_ids),
            Submission.status == SubmissionStatus.pending_review,
        )
    ) or 0

    avg_mastery = await db.scalar(
        select(func.avg(DiagnosticReport.mastery_rate))
        .join(Assessment, Assessment.id == DiagnosticReport.assessment_id)
        .where(Assessment.teacher_id == teacher_id, Assessment.class_id.in_(scope_ids))
    )

    # ── Recent assessments (20 fetched; 5 shown; rest covers reteach) ──
    recent_raw = (await db.execute(
        select(Assessment)
        .where(Assessment.teacher_id == teacher_id, Assessment.class_id.in_(scope_ids))
        .order_by(Assessment.created_at.desc())
        .limit(20)
    )).scalars().all()
    a_ids = [a.id for a in recent_raw]

    q_counts: dict = {}
    if a_ids:
        q_counts = {r.assessment_id: r.n for r in (await db.execute(
            select(Question.assessment_id, func.count().label("n"))
            .where(Question.assessment_id.in_(a_ids))
            .group_by(Question.assessment_id)
        )).all()}

    dr_map: dict = {}
    if a_ids:
        dr_map = {dr.assessment_id: dr for dr in (await db.execute(
            select(DiagnosticReport).where(DiagnosticReport.assessment_id.in_(a_ids))
        )).scalars().all()}

    sub_counts: dict = {}
    if a_ids:
        sub_counts = {r.assessment_id: r.n for r in (await db.execute(
            select(Submission.assessment_id, func.count().label("n"))
            .where(
                Submission.assessment_id.in_(a_ids),
                Submission.status.in_([
                    SubmissionStatus.submitted,
                    SubmissionStatus.graded,
                    SubmissionStatus.pending_review,
                ])
            )
            .group_by(Submission.assessment_id)
        )).all()}

    used_class_ids = list({a.class_id for a in recent_raw})
    enroll_counts: dict = {}
    if used_class_ids:
        enroll_counts = {r.class_id: r.n for r in (await db.execute(
            select(Enrollment.class_id, func.count().label("n"))
            .where(Enrollment.class_id.in_(used_class_ids))
            .group_by(Enrollment.class_id)
        )).all()}

    recent_assessments = []
    for a in recent_raw[:5]:
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
            "avg_score": round(dr.avg_score, 1) if dr and dr.avg_score is not None else None,
            "mastery_rate": round(dr.mastery_rate, 1) if dr and dr.mastery_rate is not None else None,
            "submitted_count": sub_counts.get(a.id, 0),
            "total_enrolled": enroll_counts.get(a.class_id, 0),
        })

    # ── Topics to reteach — ALL reports with mastery < 75 ─────────
    reteach_rows = (await db.execute(
        select(DiagnosticReport, Assessment)
        .join(Assessment, Assessment.id == DiagnosticReport.assessment_id)
        .where(
            Assessment.teacher_id == teacher_id,
            Assessment.class_id.in_(scope_ids),
            DiagnosticReport.mastery_rate < 75,
        )
        .order_by(DiagnosticReport.mastery_rate.asc())
        .limit(5)
    )).all()

    reteach_assessments = []
    for dr, a in reteach_rows:
        cls = class_map.get(a.class_id)
        reteach_assessments.append({
            "id": str(a.id),
            "title": a.title,
            "class_name": cls.name if cls else "",
            "mastery_rate": round(dr.mastery_rate, 1),
        })

    # ── At-risk students — from most recent diagnostic report per class ──
    max_gen_subq = (
        select(
            Assessment.class_id,
            func.max(DiagnosticReport.generated_at).label("max_gen"),
        )
        .join(DiagnosticReport, DiagnosticReport.assessment_id == Assessment.id)
        .where(Assessment.teacher_id == teacher_id, Assessment.class_id.in_(scope_ids))
        .group_by(Assessment.class_id)
        .subquery()
    )
    latest_rows = (await db.execute(
        select(Assessment, DiagnosticReport)
        .join(DiagnosticReport, DiagnosticReport.assessment_id == Assessment.id)
        .join(
            max_gen_subq,
            (Assessment.class_id == max_gen_subq.c.class_id)
            & (DiagnosticReport.generated_at == max_gen_subq.c.max_gen),
        )
    )).all()

    seen_sids: set[str] = set()
    at_risk_students = []
    for a, dr in latest_rows:
        cls = class_map.get(a.class_id)
        class_label = (cls.name if cls else "") + (f" — {cls.section}" if cls and cls.section else "")
        for s in (dr.student_summaries or []):
            sid = str(s.get("student_id", ""))
            if not sid or sid in seen_sids:
                continue
            pct = s.get("pct", 100)
            if s.get("at_risk") or pct < 60:
                at_risk_students.append({
                    "student_id": sid,
                    "name": s.get("name", ""),
                    "section": class_label,
                    "mastery_pct": round(pct, 1),
                    "status": s.get("status", "average"),
                })
                seen_sids.add(sid)

    at_risk_students.sort(key=lambda x: x["mastery_pct"])
    at_risk_students = at_risk_students[:5]

    # ── Performance trend per class ───────────────────────────────
    trend_rows = (await db.execute(
        select(Assessment, DiagnosticReport)
        .join(DiagnosticReport, DiagnosticReport.assessment_id == Assessment.id)
        .where(Assessment.teacher_id == teacher_id, Assessment.class_id.in_(scope_ids))
        .order_by(Assessment.class_id, Assessment.created_at.asc())
    )).all()

    trend_by_class: dict[str, dict] = {}
    for a, dr in trend_rows:
        cid = str(a.class_id)
        cls = class_map.get(a.class_id)
        if cid not in trend_by_class:
            trend_by_class[cid] = {
                "class_id": cid,
                "class_name": cls.name if cls else "",
                "data": [],
            }
        trend_by_class[cid]["data"].append({
            "label": a.created_at.strftime("%b %d"),
            "date": a.created_at.isoformat(),
            "mastery": round(dr.mastery_rate, 1),
            "assessment_id": str(a.id),
            "title": a.title,
        })

    return {
        "total_students": total_students,
        "total_classes": len(all_classes),
        "total_exams": total_exams,
        "draft_exams": draft_exams,
        "pending_review": pending_review,
        "avg_mastery_rate": round(float(avg_mastery), 1) if avg_mastery else None,
        "classes": [
            {"id": str(c.id), "name": c.name, "section": c.section}
            for c in all_classes
        ],
        "recent_assessments": recent_assessments,
        "reteach_assessments": reteach_assessments,
        "at_risk_students": at_risk_students,
        "performance_trend": list(trend_by_class.values()),
    }
