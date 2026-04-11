"""
Diagnostic report generation service.
Supports assessments with as few as 1 graded submission.
"""
from __future__ import annotations

import json
import logging
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import (
    Assessment,
    Question,
    Submission,
    User,
)
from app.models.diagnostic_report import DiagnosticReport
from app.models.response import Response as ResponseModel
from app.models.student_mastery import StudentMastery, TrendType
from app.models.submission import SubmissionStatus
from app.models.topic_taxonomy import TopicTaxonomy

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# ── Mastery level classification ───────────────────────────────

def _classify(pct: float) -> str:
    if pct < 40:
        return "critical"
    if pct < 60:
        return "remedial"
    if pct < 75:
        return "average"
    if pct < 90:
        return "good"
    return "mastered"


# ── AI misconception via Gemini ────────────────────────────────

async def _gemini_misconception(subtopic: str, wrong_answers: list[str]) -> str:
    if not settings.GEMINI_API_KEY:
        return f"Students struggled with {subtopic}."

    sample = wrong_answers[:5]
    prompt = (
        f"You are an educational analyst for Philippine K-12.\n"
        f"Students answered questions on the subtopic '{subtopic}' incorrectly.\n"
        f"Common wrong answers: {sample}\n"
        f"In ONE sentence (max 25 words), describe the likely misconception.\n"
        f"Format: 'Students commonly confused ... with ... because ...'\n"
        f"Output ONLY that sentence."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": settings.GEMINI_API_KEY},
                headers={"content-type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"maxOutputTokens": 80, "temperature": 0.3},
                },
            )
            if resp.is_success:
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as exc:
        logger.warning("Gemini misconception call failed: %s", exc)

    return f"Students struggled with '{subtopic}'."


# ── AI topic taxonomy via Gemini ───────────────────────────────

async def _gemini_topic_taxonomy(subtopics: list[str]) -> dict[str, str]:
    """
    Returns {subtopic: parent_topic} mapping.
    Falls back to subtopic == parent_topic (flat) only on hard failure.
    """
    if not settings.GEMINI_API_KEY or not subtopics:
        return {s: s for s in subtopics}

    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(subtopics))
    prompt = (
        "You are a curriculum expert for Philippine K-12 education.\n"
        "Your job is to group granular exam subtopics into broad parent topics.\n\n"
        "STRICT RULES:\n"
        "- Group ALL subtopics into 2–5 broad parent topics.\n"
        "- Related subtopics MUST share the same parent topic name.\n"
        "  Example: 'Sound', 'Pitch', 'Travel of Sound (Medium)' → all map to 'Sound & Waves'\n"
        "  Example: 'Electric Circuits', 'Parallel Circuit', 'Conductors' → all map to 'Electricity & Magnetism'\n"
        "- Parent topic names must be short (2–4 words), title-cased, curriculum-aligned.\n"
        "- Every subtopic must appear as a key in the output JSON.\n"
        "- Copy the subtopic names EXACTLY as given — same spelling, same capitalization.\n"
        "- Output ONLY a valid JSON object. No markdown, no explanation.\n\n"
        f"Subtopics to group:\n{numbered}\n\n"
        "Output format: {\"exact subtopic name\": \"Parent Topic\", ...}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": settings.GEMINI_API_KEY},
                headers={"content-type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.1},
                },
            )
            if resp.is_success:
                raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                mapping = json.loads(raw)

                # Case-insensitive lookup: build a lowercased index of AI output keys
                lower_mapping = {k.lower(): v for k, v in mapping.items()}

                validated: dict[str, str] = {}
                for sub in subtopics:
                    # Try exact match first, then case-insensitive
                    parent = mapping.get(sub) or lower_mapping.get(sub.lower()) or sub
                    validated[sub] = str(parent)

                # Sanity check: if every subtopic mapped to itself, the AI didn't group anything
                # — treat as failure so we don't persist useless rows
                unique_parents = set(validated.values())
                if len(unique_parents) == len(subtopics):
                    logger.warning("Gemini taxonomy returned all 1:1 mappings — retrying is not worth it, will return as-is but not persist")
                    return {}  # empty signals caller to skip persisting

                logger.info("Gemini taxonomy: %d subtopics → %d parent topics", len(subtopics), len(unique_parents))
                return validated
    except Exception as exc:
        logger.warning("Gemini taxonomy call failed: %s", exc)

    return {}  # empty — caller will skip persisting and fall back to flat view


# ── Main generation function ───────────────────────────────────

async def generate_diagnostic_report(
    assessment_id: uuid.UUID,
    db: AsyncSession,
) -> DiagnosticReport:

    # ── 1. Fetch assessment ────────────────────────────────────
    assessment = await db.scalar(select(Assessment).where(Assessment.id == assessment_id))
    if not assessment:
        raise ValueError("Assessment not found")

    # ── 2. Fetch all graded/submitted submissions ──────────────
    sub_result = await db.execute(
        select(Submission).where(
            Submission.assessment_id == assessment_id,
            Submission.status.in_([SubmissionStatus.graded, SubmissionStatus.pending_review]),
        )
    )
    submissions = sub_result.scalars().all()

    if not submissions:
        raise ValueError("No graded submissions yet")

    # ── 3. Fetch questions ────────────────────────────────────
    q_result = await db.execute(
        select(Question).where(Question.assessment_id == assessment_id)
    )
    questions = {q.id: q for q in q_result.scalars().all()}

    # ── 4. Fetch students ─────────────────────────────────────
    student_ids = [s.student_id for s in submissions]
    u_result = await db.execute(select(User).where(User.id.in_(student_ids)))
    students = {u.id: u for u in u_result.scalars().all()}

    # ── 5. Fetch all responses ────────────────────────────────
    sub_ids = [s.id for s in submissions]
    r_result = await db.execute(
        select(ResponseModel).where(ResponseModel.submission_id.in_(sub_ids))
    )
    all_responses = r_result.scalars().all()

    # Group responses by submission_id
    responses_by_sub: dict[uuid.UUID, list[ResponseModel]] = defaultdict(list)
    for r in all_responses:
        responses_by_sub[r.submission_id].append(r)

    # ── 6. Per-student subtopic mastery ───────────────────────
    # student_subtopic_scores[student_id][subtopic] = [correct, total]
    student_subtopic_scores: dict[uuid.UUID, dict[str, list[int]]] = defaultdict(
        lambda: defaultdict(lambda: [0, 0])
    )

    # For subtopic wrong-answer collection
    subtopic_wrong_answers: dict[str, list[str]] = defaultdict(list)

    for sub in submissions:
        for resp in responses_by_sub[sub.id]:
            q = questions.get(resp.question_id)
            if not q or not q.subtopic_tags:
                continue
            is_correct = bool(resp.is_correct)
            for tag in q.subtopic_tags:
                student_subtopic_scores[sub.student_id][tag][1] += 1  # total
                if is_correct:
                    student_subtopic_scores[sub.student_id][tag][0] += 1  # correct
                elif resp.student_answer:
                    subtopic_wrong_answers[tag].append(resp.student_answer)

    # ── 7. Class-wide metrics ─────────────────────────────────
    pct_scores = []
    for sub in submissions:
        if sub.max_score and sub.max_score > 0 and sub.total_score is not None:
            pct_scores.append((sub.total_score / sub.max_score) * 100)

    avg_score = round(sum(pct_scores) / len(pct_scores), 1) if pct_scores else 0.0
    mastery_rate = round(
        (sum(1 for p in pct_scores if p >= 80) / len(pct_scores)) * 100, 1
    ) if pct_scores else 0.0

    # Score distribution bands
    bands = {"0-59": 0, "60-69": 0, "70-79": 0, "80-89": 0, "90-100": 0}
    for p in pct_scores:
        if p < 60:
            bands["0-59"] += 1
        elif p < 70:
            bands["60-69"] += 1
        elif p < 80:
            bands["70-79"] += 1
        elif p < 90:
            bands["80-89"] += 1
        else:
            bands["90-100"] += 1

    # ── 8. Subtopic class averages ────────────────────────────
    all_subtopics: set[str] = set()
    for per_student in student_subtopic_scores.values():
        all_subtopics.update(per_student.keys())

    subtopic_mastery: dict[str, dict] = {}
    for subtopic in all_subtopics:
        totals = [
            (student_subtopic_scores[sid][subtopic][0], student_subtopic_scores[sid][subtopic][1])
            for sid in student_subtopic_scores
            if subtopic in student_subtopic_scores[sid]
        ]
        if not totals:
            continue
        correct_sum = sum(c for c, _ in totals)
        total_sum = sum(t for _, t in totals)
        pct = round((correct_sum / total_sum) * 100, 1) if total_sum else 0.0
        subtopic_mastery[subtopic] = {
            "pct": pct,
            "level": _classify(pct),
        }

    # ── 8b. Build / reuse topic taxonomy ──────────────────────
    from sqlalchemy import delete as sa_delete

    existing_taxonomy_rows = (await db.execute(
        select(TopicTaxonomy).where(TopicTaxonomy.assessment_id == assessment_id)
    )).scalars().all()

    # Detect degenerate taxonomy: every subtopic maps to itself (bad AI fallback)
    is_degenerate = (
        len(existing_taxonomy_rows) > 0
        and all(row.subtopic == row.parent_topic for row in existing_taxonomy_rows)
    )

    if existing_taxonomy_rows and not is_degenerate:
        # Healthy stored taxonomy — respect it (includes any teacher edits)
        taxonomy_map: dict[str, str] = {row.subtopic: row.parent_topic for row in existing_taxonomy_rows}
        # Any new subtopics from new submissions get a self-group default for now
        for sub in all_subtopics:
            if sub not in taxonomy_map:
                taxonomy_map[sub] = sub
    else:
        # Either first run or bad rows — purge stale rows and call AI
        if is_degenerate:
            logger.info("Detected degenerate 1:1 taxonomy for %s — purging and re-running AI", assessment_id)
            await db.execute(
                sa_delete(TopicTaxonomy).where(TopicTaxonomy.assessment_id == assessment_id)
            )
            await db.flush()

        ai_map = await _gemini_topic_taxonomy(list(all_subtopics))

        if ai_map:
            # Good grouping — persist it
            taxonomy_map = ai_map
            for subtopic_name, parent_topic in taxonomy_map.items():
                db.add(TopicTaxonomy(
                    assessment_id=assessment_id,
                    subtopic=subtopic_name,
                    parent_topic=parent_topic,
                ))
        else:
            # AI failed — use flat map in memory only, don't persist
            taxonomy_map = {s: s for s in all_subtopics}

    # ── 8c. Aggregate topic_groups ────────────────────────────
    # {parent_topic: {avg_pct, level, subtopics: {subtopic: {pct, level}}}}
    parent_children: dict[str, list[str]] = defaultdict(list)
    for sub_name, parent in taxonomy_map.items():
        if sub_name in subtopic_mastery:
            parent_children[parent].append(sub_name)

    topic_groups: dict[str, dict] = {}
    for parent, children in parent_children.items():
        child_pcts = [subtopic_mastery[c]["pct"] for c in children]
        parent_pct = round(sum(child_pcts) / len(child_pcts), 1) if child_pcts else 0.0
        topic_groups[parent] = {
            "avg_pct": parent_pct,
            "level": _classify(parent_pct),
            "subtopics": {c: subtopic_mastery[c] for c in children},
        }

    # ── 9. Topics to reteach (class avg < 60%) ────────────────
    topics_to_reteach = []
    for subtopic, data in subtopic_mastery.items():
        if data["pct"] < 60:
            wrong = subtopic_wrong_answers.get(subtopic, [])
            misconception = await _gemini_misconception(subtopic, wrong)
            topics_to_reteach.append({
                "subtopic": subtopic,
                "avg_pct": data["pct"],
                "level": data["level"],
                "misconception": misconception,
            })
    topics_to_reteach.sort(key=lambda x: x["avg_pct"])

    # ── 10. Class strengths (class avg > 85%) ─────────────────
    class_strengths = [
        {"subtopic": s, "avg_pct": d["pct"]}
        for s, d in subtopic_mastery.items()
        if d["pct"] > 85
    ]

    # ── 11. At-risk students ──────────────────────────────────
    at_risk_ids: set[uuid.UUID] = set()
    for sub in submissions:
        if sub.max_score and sub.total_score is not None:
            if (sub.total_score / sub.max_score) * 100 < 60:
                at_risk_ids.add(sub.student_id)
        # also flag if 2+ critical subtopics
        critical_count = sum(
            1 for tag, scores in student_subtopic_scores[sub.student_id].items()
            if scores[1] > 0 and (scores[0] / scores[1]) * 100 < 40
        )
        if critical_count >= 2:
            at_risk_ids.add(sub.student_id)

    # ── 12. Per-student summary for report ────────────────────
    student_summaries = []
    for sub in submissions:
        u = students.get(sub.student_id)
        pct = round((sub.total_score / sub.max_score) * 100, 1) if sub.max_score and sub.total_score is not None else 0.0
        weakest = min(
            student_subtopic_scores[sub.student_id].items(),
            key=lambda kv: (kv[1][0] / kv[1][1]) if kv[1][1] > 0 else 1.0,
            default=(None, None),
        )
        student_summaries.append({
            "student_id": str(sub.student_id),
            "name": f"{u.last_name}, {u.first_name}" if u else str(sub.student_id),
            "score": sub.total_score,
            "max_score": sub.max_score,
            "pct": pct,
            "status": _classify(pct),
            "at_risk": sub.student_id in at_risk_ids,
            "weakest_subtopic": weakest[0] if weakest[0] else None,
            "subtopics": {
                tag: round((scores[0] / scores[1]) * 100, 1) if scores[1] > 0 else 0.0
                for tag, scores in student_subtopic_scores[sub.student_id].items()
            },
        })

    # ── 13. Upsert StudentMastery records ─────────────────────
    now = datetime.now(timezone.utc)
    for student_id, subtopic_scores in student_subtopic_scores.items():
        for subtopic, (correct, total) in subtopic_scores.items():
            if total == 0:
                continue
            pct = (correct / total) * 100

            existing = await db.scalar(
                select(StudentMastery).where(
                    StudentMastery.student_id == student_id,
                    StudentMastery.class_id == assessment.class_id,
                    StudentMastery.subtopic == subtopic,
                )
            )
            if existing:
                trend = (
                    TrendType.improving if pct > existing.mastery_pct
                    else TrendType.declining if pct < existing.mastery_pct
                    else TrendType.stable
                )
                existing.mastery_pct = round(pct, 1)
                existing.trend = trend
                existing.last_assessed_at = now
            else:
                db.add(StudentMastery(
                    student_id=student_id,
                    class_id=assessment.class_id,
                    subtopic=subtopic,
                    mastery_pct=round(pct, 1),
                    trend=TrendType.stable,
                    last_assessed_at=now,
                ))

    # ── 14. Upsert DiagnosticReport ───────────────────────────
    existing_report = await db.scalar(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == assessment_id)
    )

    report_data = dict(
        assessment_id=assessment_id,
        class_id=assessment.class_id,
        avg_score=avg_score,
        mastery_rate=mastery_rate,
        score_distribution=bands,
        subtopic_mastery=subtopic_mastery,
        topics_to_reteach=topics_to_reteach,
        class_strengths=class_strengths,
        student_summaries=student_summaries,
        topic_groups=topic_groups,
        generated_at=now,
    )

    if existing_report:
        for k, v in report_data.items():
            setattr(existing_report, k, v)
        report = existing_report
    else:
        report = DiagnosticReport(**report_data)
        db.add(report)

    await db.commit()
    await db.refresh(report)
    return report
