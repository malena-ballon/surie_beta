"""Student analytics endpoint.

Returns per-student analytics: exam history, subtopic performance (vs class avg),
overall mastery, Bloom's performance, question-type performance, percentile.
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

# ── Constants ──────────────────────────────────────────────────

BLOOMS_ORDER = [
    "remembering", "understanding", "applying",
    "analyzing", "evaluating", "creating",
]
BLOOMS_LABELS = {
    "remembering":   "Remembering",
    "understanding": "Understanding",
    "applying":      "Applying",
    "analyzing":     "Analyzing",
    "evaluating":    "Evaluating",
    "creating":      "Creating",
}
QTYPE_LABELS = {
    "mcq":            "Multiple Choice",
    "true_false":     "True / False",
    "identification": "Identification",
    "essay":          "Essay",
    "matching":       "Matching",
}
MASTERY_THRESHOLDS = [
    (90, "mastered"), (75, "good"), (60, "average"), (40, "remedial"), (0, "critical"),
]


def _mastery_level(pct: float) -> str:
    for threshold, level in MASTERY_THRESHOLDS:
        if pct >= threshold:
            return level
    return "critical"


# ── Aggregation helpers ────────────────────────────────────────

def _subtopic_scores(questions: list, responses: list) -> dict[str, dict]:
    resp_by_q = {r.question_id: r for r in responses}
    result: dict[str, dict] = defaultdict(lambda: {"score": 0.0, "max": 0.0})
    for q in questions:
        tags = q.subtopic_tags or ["General"]
        tag = str(tags[0]) if tags else "General"
        max_marks = float(getattr(q, "max_marks", 1.0) or 1.0)
        r = resp_by_q.get(q.id)
        result[tag]["score"] += float(r.score) if r and r.score is not None else 0.0
        result[tag]["max"] += max_marks
    return result


def _blooms_scores(questions: list, responses: list) -> dict[str, dict]:
    resp_by_q = {r.question_id: r for r in responses}
    result: dict[str, dict] = defaultdict(lambda: {"score": 0.0, "max": 0.0})
    for q in questions:
        bl = str(q.blooms_level or "").lower() if q.blooms_level else None
        if not bl or bl not in BLOOMS_ORDER:
            continue
        max_marks = float(getattr(q, "max_marks", 1.0) or 1.0)
        r = resp_by_q.get(q.id)
        result[bl]["score"] += float(r.score) if r and r.score is not None else 0.0
        result[bl]["max"] += max_marks
    return result


def _qtype_scores(questions: list, responses: list) -> dict[str, dict]:
    resp_by_q = {r.question_id: r for r in responses}
    result: dict[str, dict] = defaultdict(lambda: {"score": 0.0, "max": 0.0})
    for q in questions:
        qt = str(q.question_type.value if hasattr(q.question_type, "value") else q.question_type)
        max_marks = float(getattr(q, "max_marks", 1.0) or 1.0)
        r = resp_by_q.get(q.id)
        result[qt]["score"] += float(r.score) if r and r.score is not None else 0.0
        result[qt]["max"] += max_marks
    return result


def _class_avg_for(
    group_fn,
    all_class_subs: list,
    class_resp_by_sub: dict,
    questions_by_assessment: dict,
) -> dict[str, float]:
    """Average score_pct per group key across all class students."""
    student_groups: dict[uuid.UUID, dict[str, dict]] = {}
    for s in all_class_subs:
        qs = questions_by_assessment.get(s.assessment_id, [])
        student_groups[s.student_id] = student_groups.get(s.student_id) or defaultdict(lambda: {"score": 0.0, "max": 0.0})
        scores = group_fn(qs, class_resp_by_sub.get(s.id, []))
        for key, d in scores.items():
            student_groups[s.student_id][key]["score"] += d["score"]
            student_groups[s.student_id][key]["max"] += d["max"]

    # Per-key: collect each student's pct, then average
    pcts_by_key: dict[str, list[float]] = defaultdict(list)
    for _, groups in student_groups.items():
        for key, d in groups.items():
            pct = (d["score"] / d["max"] * 100) if d["max"] > 0 else 0.0
            pcts_by_key[key].append(pct)

    return {
        key: round(sum(pcts) / len(pcts), 1) if pcts else 0.0
        for key, pcts in pcts_by_key.items()
    }


# ── Endpoint ───────────────────────────────────────────────────

@router.get("/analytics")
async def student_analytics(
    class_id: uuid.UUID | None = Query(None),
    assessment_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # 1. Enrolled classes
    enroll_result = await db.execute(
        select(Enrollment.class_id).where(Enrollment.student_id == current_user.id)
    )
    class_ids = list(enroll_result.scalars().all())

    cls_result = await db.execute(select(Classroom).where(Classroom.id.in_(class_ids)))
    classes_meta = [
        {"id": str(c.id), "name": c.name, "subject": c.subject}
        for c in cls_result.scalars().all()
    ]

    active_class_ids = [class_id] if (class_id and class_id in class_ids) else class_ids
    empty = {"exams": [], "overall_mastery": [], "blooms_performance": [], "qtype_performance": [], "classes": classes_meta, "all_assessments": []}
    if not active_class_ids:
        return empty

    # 2. Assessments for filter metadata
    avail_result = await db.execute(
        select(Assessment, Classroom)
        .join(Classroom, Assessment.class_id == Classroom.id)
        .where(Assessment.class_id.in_(active_class_ids))
    )
    all_assessments_meta = [
        {"id": str(row[0].id), "title": row[0].title, "class_name": row[1].name}
        for row in avail_result.all()
    ]

    # 3. Student's graded submissions
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
        return {**empty, "all_assessments": all_assessments_meta}

    # 4. Bulk fetch questions
    assessment_ids = list({row[1].id for row in sub_rows})
    q_result = await db.execute(select(Question).where(Question.assessment_id.in_(assessment_ids)))
    questions_all = q_result.scalars().all()
    questions_by_assessment: dict[uuid.UUID, list] = defaultdict(list)
    all_q_by_id: dict[uuid.UUID, Any] = {}
    for q in questions_all:
        questions_by_assessment[q.assessment_id].append(q)
        all_q_by_id[q.id] = q

    # 5. Student responses
    student_sub_ids = [row[0].id for row in sub_rows]
    sr_result = await db.execute(
        select(ResponseModel).where(ResponseModel.submission_id.in_(student_sub_ids))
    )
    student_resp_by_sub: dict[uuid.UUID, list] = defaultdict(list)
    for r in sr_result.scalars().all():
        student_resp_by_sub[r.submission_id].append(r)

    # 6. All class submissions + responses for averages
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

    class_subs_by_assessment: dict[uuid.UUID, list] = defaultdict(list)
    for s in all_class_subs:
        class_subs_by_assessment[s.assessment_id].append(s)

    # 7. Class subtopic averages per assessment
    class_subtopic_avg: dict[uuid.UUID, dict[str, float]] = {}
    for a_id, a_subs in class_subs_by_assessment.items():
        qs = questions_by_assessment[a_id]
        subtopic_student_pcts: dict[str, list[float]] = defaultdict(list)
        for s in a_subs:
            for tag, d in _subtopic_scores(qs, class_resp_by_sub[s.id]).items():
                pct = (d["score"] / d["max"] * 100) if d["max"] > 0 else 0.0
                subtopic_student_pcts[tag].append(pct)
        class_subtopic_avg[a_id] = {
            tag: round(sum(p) / len(p), 1) if p else 0.0
            for tag, p in subtopic_student_pcts.items()
        }

    # 8. Percentile per assessment
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

    # 9. Build exam records
    overall_subtopic_data: dict[str, list] = defaultdict(list)
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

    # 10. Overall mastery per subtopic
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
    overall_mastery.sort(key=lambda x: x["avg_score_pct"], reverse=True)

    # 11. Bloom's performance (student vs class avg)
    # Flatten all student responses across all submissions
    all_student_responses_flat = [r for sub_id in student_sub_ids for r in student_resp_by_sub[sub_id]]
    all_questions_for_student = [q for a_id in assessment_ids for q in questions_by_assessment[a_id]]

    my_blooms = _blooms_scores(all_questions_for_student, all_student_responses_flat)
    cls_blooms_avg = _class_avg_for(_blooms_scores, all_class_subs, class_resp_by_sub, questions_by_assessment)

    blooms_performance = []
    for level in BLOOMS_ORDER:
        d = my_blooms.get(level, {"score": 0.0, "max": 0.0})
        student_pct = round(d["score"] / d["max"] * 100, 1) if d["max"] > 0 else None
        class_avg = cls_blooms_avg.get(level)
        if student_pct is not None or class_avg is not None:
            blooms_performance.append({
                "level": level,
                "label": BLOOMS_LABELS[level],
                "student_pct": student_pct,
                "class_avg_pct": class_avg,
            })

    # 12. Question-type performance (student vs class avg)
    my_qtypes = _qtype_scores(all_questions_for_student, all_student_responses_flat)
    cls_qtype_avg = _class_avg_for(_qtype_scores, all_class_subs, class_resp_by_sub, questions_by_assessment)

    qtype_performance = []
    for qt, label in QTYPE_LABELS.items():
        d = my_qtypes.get(qt, {"score": 0.0, "max": 0.0})
        student_pct = round(d["score"] / d["max"] * 100, 1) if d["max"] > 0 else None
        class_avg = cls_qtype_avg.get(qt)
        if student_pct is not None or class_avg is not None:
            qtype_performance.append({
                "type": qt,
                "label": label,
                "student_pct": student_pct,
                "class_avg_pct": class_avg,
            })

    return {
        "exams": exams_out,
        "overall_mastery": overall_mastery,
        "blooms_performance": blooms_performance,
        "qtype_performance": qtype_performance,
        "classes": classes_meta,
        "all_assessments": all_assessments_meta,
    }
