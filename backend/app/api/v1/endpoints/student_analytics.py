"""Student analytics endpoint.

Returns per-student analytics: exam history, subtopic performance (vs class avg),
overall mastery, percentile, and filter metadata.
"""

import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Assessment, Classroom, Enrollment, Question, User
from app.models.response import Response as ResponseModel
from app.models.submission import Submission, SubmissionStatus

router = APIRouter()

MASTERY_THRESHOLDS = [
    (90, "mastered"),
    (75, "good"),
    (60, "average"),
    (40, "remedial"),
    (0, "critical"),
]


def _mastery_level(pct: float) -> str:
    for threshold, level in MASTERY_THRESHOLDS:
        if pct >= threshold:
            return level
    return "critical"


# ── Helpers ────────────────────────────────────────────────────


def _subtopic_scores(
    questions: list[Any],
    responses: list[Any],
) -> dict[str, dict]:
    """Compute per-subtopic {score, max} for one student's submission."""
    resp_by_q = {r.question_id: r for r in responses}
    result: dict[str, dict] = defaultdict(lambda: {"score": 0.0, "max": 0.0})

    for q in questions:
        tags = q.subtopic_tags or ["General"]
        tag = str(tags[0]) if tags else "General"
        max_marks = float(getattr(q, "max_marks", 1.0) or 1.0)
        r = resp_by_q.get(q.id)
        score = float(r.score) if r and r.score is not None else 0.0
        result[tag]["score"] += score
        result[tag]["max"] += max_marks

    return result


@router.get("/analytics")
async def student_analytics(
    class_id: uuid.UUID | None = Query(None),
    assessment_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # ── 1. Enrolled classes ──────────────────────────────────────
    enroll_result = await db.execute(
        select(Enrollment.class_id).where(Enrollment.student_id == current_user.id)
    )
    class_ids = list(enroll_result.scalars().all())

    # Classes for filter metadata
    cls_result = await db.execute(
        select(Classroom).where(Classroom.id.in_(class_ids))
    )
    classes = cls_result.scalars().all()
    classes_meta = [
        {"id": str(c.id), "name": c.name, "subject": c.subject}
        for c in classes
    ]

    active_class_ids = [class_id] if (class_id and class_id in class_ids) else class_ids
    if not active_class_ids:
        return {"exams": [], "overall_mastery": [], "classes": classes_meta, "all_assessments": []}

    # ── 2. Published assessments in those classes (for filter dropdown) ──
    avail_result = await db.execute(
        select(Assessment, Classroom)
        .join(Classroom, Assessment.class_id == Classroom.id)
        .where(Assessment.class_id.in_(active_class_ids))
    )
    all_assessments_meta = [
        {
            "id": str(row[0].id),
            "title": row[0].title,
            "class_name": row[1].name,
        }
        for row in avail_result.all()
    ]

    # ── 3. Student's graded submissions ──────────────────────────
    sub_q = (
        select(Submission, Assessment, Classroom)
        .join(Assessment, Submission.assessment_id == Assessment.id)
        .join(Classroom, Assessment.class_id == Classroom.id)
        .where(
            Submission.student_id == current_user.id,
            Assessment.class_id.in_(active_class_ids),
            Submission.status.in_([SubmissionStatus.graded, SubmissionStatus.pending_review]),
        )
    )
    if assessment_id:
        sub_q = sub_q.where(Assessment.id == assessment_id)

    sub_result = await db.execute(sub_q.order_by(Submission.submitted_at.desc()))
    sub_rows = sub_result.all()

    if not sub_rows:
        return {
            "exams": [],
            "overall_mastery": [],
            "classes": classes_meta,
            "all_assessments": all_assessments_meta,
        }

    # ── 4. Bulk fetch questions ──────────────────────────────────
    assessment_ids = list({row[1].id for row in sub_rows})

    q_result = await db.execute(
        select(Question).where(Question.assessment_id.in_(assessment_ids))
    )
    questions_all = q_result.scalars().all()
    questions_by_assessment: dict[uuid.UUID, list] = defaultdict(list)
    for q in questions_all:
        questions_by_assessment[q.assessment_id].append(q)

    # ── 5. Bulk fetch student responses ─────────────────────────
    student_sub_ids = [row[0].id for row in sub_rows]
    sr_result = await db.execute(
        select(ResponseModel).where(ResponseModel.submission_id.in_(student_sub_ids))
    )
    student_resp_by_sub: dict[uuid.UUID, list] = defaultdict(list)
    for r in sr_result.scalars().all():
        student_resp_by_sub[r.submission_id].append(r)

    # ── 6. Bulk fetch ALL class submissions for avg ──────────────
    all_subs_result = await db.execute(
        select(Submission).where(
            Submission.assessment_id.in_(assessment_ids),
            Submission.status.in_([SubmissionStatus.graded, SubmissionStatus.pending_review]),
        )
    )
    all_class_subs = all_subs_result.scalars().all()
    all_class_sub_ids = [s.id for s in all_class_subs]

    all_class_resp_result = await db.execute(
        select(ResponseModel).where(ResponseModel.submission_id.in_(all_class_sub_ids))
    )
    class_resp_by_sub: dict[uuid.UUID, list] = defaultdict(list)
    for r in all_class_resp_result.scalars().all():
        class_resp_by_sub[r.submission_id].append(r)

    # Subs grouped by assessment
    class_subs_by_assessment: dict[uuid.UUID, list] = defaultdict(list)
    for s in all_class_subs:
        class_subs_by_assessment[s.assessment_id].append(s)

    # ── 7. Compute per-assessment class subtopic averages ────────
    # class_subtopic_avg[assessment_id][subtopic] = avg_pct across all students
    class_subtopic_avg: dict[uuid.UUID, dict[str, float]] = {}

    for a_id, a_subs in class_subs_by_assessment.items():
        qs = questions_by_assessment[a_id]
        # Accumulate per-student pct per subtopic
        subtopic_student_pcts: dict[str, list[float]] = defaultdict(list)

        for s in a_subs:
            scores = _subtopic_scores(qs, class_resp_by_sub[s.id])
            for tag, d in scores.items():
                pct = (d["score"] / d["max"] * 100) if d["max"] > 0 else 0.0
                subtopic_student_pcts[tag].append(pct)

        class_subtopic_avg[a_id] = {
            tag: round(sum(pcts) / len(pcts), 1) if pcts else 0.0
            for tag, pcts in subtopic_student_pcts.items()
        }

    # ── 8. Compute percentile per assessment ─────────────────────
    # percentile = % of students this student scored >= (lower is excluded)
    assessment_scores_map: dict[uuid.UUID, list[float]] = defaultdict(list)
    for s in all_class_subs:
        if s.total_score is not None and s.max_score and s.max_score > 0:
            assessment_scores_map[s.assessment_id].append(
                round(s.total_score / s.max_score * 100, 2)
            )

    def _percentile(a_id: uuid.UUID, my_pct: float) -> int:
        all_pcts = assessment_scores_map.get(a_id, [])
        if not all_pcts:
            return 50
        below = sum(1 for p in all_pcts if p < my_pct)
        return round(below / len(all_pcts) * 100)

    # ── 9. Build exam records ────────────────────────────────────
    overall_subtopic_data: dict[str, list] = defaultdict(list)  # subtopic → list of {score_pct, date, title}
    exams_out = []

    for sub, assessment, classroom in sub_rows:
        qs = questions_by_assessment[assessment.id]
        my_responses = student_resp_by_sub[sub.id]
        student_scores = _subtopic_scores(qs, my_responses)
        class_avgs = class_subtopic_avg.get(assessment.id, {})

        my_total_pct = (
            round(sub.total_score / sub.max_score * 100, 1)
            if sub.total_score is not None and sub.max_score and sub.max_score > 0
            else None
        )
        percentile = _percentile(assessment.id, my_total_pct or 0.0)

        # Build subtopics list for this exam
        subtopics = []
        for tag, d in student_scores.items():
            my_pct = round(d["score"] / d["max"] * 100, 1) if d["max"] > 0 else 0.0
            cls_avg = class_avgs.get(tag, 0.0)
            subtopics.append({
                "name": tag,
                "student_score_pct": my_pct,
                "class_avg_pct": cls_avg,
                "questions_count": sum(
                    1 for q in qs
                    if (q.subtopic_tags or ["General"])[0] == tag
                ),
            })

            # Accumulate for overall mastery
            if sub.submitted_at:
                overall_subtopic_data[tag].append({
                    "exam_id": str(assessment.id),
                    "title": assessment.title,
                    "date": sub.submitted_at.isoformat(),
                    "score_pct": my_pct,
                })

        exams_out.append({
            "assessment_id": str(assessment.id),
            "submission_id": str(sub.id),
            "title": assessment.title,
            "class_name": classroom.name,
            "subject": classroom.subject,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "status": sub.status.value if hasattr(sub.status, "value") else sub.status,
            "total_score": sub.total_score,
            "max_score": sub.max_score,
            "total_score_pct": my_total_pct,
            "percentile": percentile,
            "subtopics": subtopics,
        })

    # ── 10. Overall mastery per subtopic ─────────────────────────
    overall_mastery = []
    for tag, entries in overall_subtopic_data.items():
        entries_sorted = sorted(entries, key=lambda e: e["date"])
        avg_pct = round(sum(e["score_pct"] for e in entries_sorted) / len(entries_sorted), 1)
        overall_mastery.append({
            "subtopic": tag,
            "avg_score_pct": avg_pct,
            "level": _mastery_level(avg_pct),
            "exam_count": len(entries_sorted),
            "trend": entries_sorted,
        })

    # Sort mastery by avg descending
    overall_mastery.sort(key=lambda x: x["avg_score_pct"], reverse=True)

    return {
        "exams": exams_out,
        "overall_mastery": overall_mastery,
        "classes": classes_meta,
        "all_assessments": all_assessments_meta,
    }
