"""
Re-assessment generation service.
Creates a targeted assessment focusing on weak subtopics from diagnostic data.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from math import ceil

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Assessment, Question, SourceMaterial
from app.models.assessment import DifficultyLevel
from app.models.diagnostic_report import DiagnosticReport
from app.models.question import CreatedVia
from app.models.reassessment import ReAssessment, ReAssessmentType

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


# ── Prompt builder ─────────────────────────────────────────────

def _build_reassessment_prompt(
    source_text: str,
    weak_subtopics: list[dict],  # [{subtopic, mastery_pct, weight}]
    total_questions: int,
    difficulty: str,
    subject: str,
    grade_level: str,
) -> str:
    subtopic_block = "\n".join(
        f"  - {s['subtopic']} (class avg: {s['mastery_pct']}%, weight: {s['weight']} questions)"
        for s in weak_subtopics
    )

    return f"""You are an expert remediation exam generator for Philippine K-12 education.
A class has recently taken an assessment and the diagnostic report shows specific weak areas.
Your task is to generate a TARGETED RE-ASSESSMENT focusing on these weak subtopics.

CRITICAL RULES:
- Generate EXACTLY {total_questions} questions total
- ONLY generate questions targeting the listed weak subtopics
- Approach each concept from a DIFFERENT ANGLE than typical — use real-world scenarios, analogies, and applied contexts
- Do NOT simply restate facts; test understanding and application
- All questions must be mcq (4 choices A/B/C/D) — re-assessments use MCQ only for fast grading
- Distribute questions according to the weights provided (more questions for weaker subtopics)
- Make questions grade-level appropriate for Grade {grade_level}
- Base ALL questions strictly on the provided source material
- Output ONLY a valid JSON array — no markdown fences, no explanation text

Weak subtopics to target:
{subtopic_block}

Subject: {subject}
Grade Level: {grade_level}
Difficulty: {difficulty}

Each question object must follow this EXACT shape:
{{
  "question_text": "Full question text",
  "question_type": "mcq",
  "choices": [{{"label": "A", "text": "...", "is_correct": false}}, {{"label": "B", "text": "...", "is_correct": false}}, {{"label": "C", "text": "...", "is_correct": true}}, {{"label": "D", "text": "...", "is_correct": false}}],
  "correct_answer": "C",
  "explanation": "Why this answer is correct and addresses the misconception",
  "subtopic_tags": ["exact_subtopic_name"],
  "blooms_level": "understanding" | "applying" | "analyzing",
  "difficulty": "{difficulty}"
}}

Source material:
{source_text[:12000]}"""


# ── Gemini call (reuse pattern) ────────────────────────────────

async def _call_gemini(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            GEMINI_API_URL,
            params={"key": settings.GEMINI_API_KEY},
            headers={"content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 8192, "temperature": 0.5},
            },
        )
        if not response.is_success:
            logger.error("Gemini error %s: %s", response.status_code, response.text)
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def _extract_json(text: str) -> list[dict]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


# ── Weight calculation ─────────────────────────────────────────

def _calculate_weights(
    subtopic_mastery: dict,  # {subtopic: {pct, level}}
    target_subtopics: list[str],
    total_questions: int,
) -> list[dict]:
    """Lower mastery → more questions."""
    entries = []
    for subtopic in target_subtopics:
        pct = subtopic_mastery.get(subtopic, {}).get("pct", 50.0)
        # Inverse weight: 100 - pct so weakest gets most
        inv = max(1.0, 100.0 - pct)
        entries.append({"subtopic": subtopic, "mastery_pct": pct, "inv": inv})

    total_inv = sum(e["inv"] for e in entries)
    allocated = 0
    for i, e in enumerate(entries):
        if i == len(entries) - 1:
            # Remainder goes to last
            e["weight"] = total_questions - allocated
        else:
            w = max(1, round((e["inv"] / total_inv) * total_questions))
            e["weight"] = w
            allocated += w
        del e["inv"]

    return entries


# ── Main service function ──────────────────────────────────────

async def generate_class_reassessment(
    source_assessment_id: uuid.UUID,
    config: dict,
    db: AsyncSession,
) -> Assessment:
    # 1. Fetch diagnostic report
    report = await db.scalar(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == source_assessment_id)
    )
    if not report:
        raise ValueError("No diagnostic report found. Generate a diagnostic report first.")

    # 2. Fetch source assessment
    source = await db.scalar(select(Assessment).where(Assessment.id == source_assessment_id))
    if not source:
        raise ValueError("Source assessment not found")

    # 3. Resolve config
    threshold = config.get("mastery_threshold", 60.0)
    question_count = int(config.get("question_count", 10))
    difficulty = config.get("difficulty", source.difficulty.value if hasattr(source.difficulty, "value") else source.difficulty)
    subject = config.get("subject", "")
    grade_level = config.get("grade_level", "")

    # Target subtopics from config or auto-detect below threshold
    target_subtopics: list[str] = config.get("target_subtopics", [])
    if not target_subtopics:
        target_subtopics = [
            s for s, d in report.subtopic_mastery.items()
            if d["pct"] < threshold
        ]
    if not target_subtopics:
        # Fall back to all subtopics sorted by worst
        target_subtopics = sorted(
            report.subtopic_mastery.keys(),
            key=lambda s: report.subtopic_mastery[s]["pct"],
        )[:5]

    # 4. Fetch source material
    material = None
    if source.source_material_id:
        material = await db.scalar(
            select(SourceMaterial).where(SourceMaterial.id == source.source_material_id)
        )
    if not material or not material.content_text:
        raise ValueError("Source assessment has no source material with text content.")

    # 5. Calculate weights
    weighted = _calculate_weights(report.subtopic_mastery, target_subtopics, question_count)

    # 6. Build prompt and call AI
    prompt = _build_reassessment_prompt(
        source_text=material.content_text,
        weak_subtopics=weighted,
        total_questions=question_count,
        difficulty=difficulty,
        subject=subject,
        grade_level=grade_level,
    )

    raw = await _call_gemini(prompt)
    try:
        generated = _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        fix_prompt = (
            prompt
            + "\n\nYour previous response was not valid JSON. "
            "Return ONLY the JSON array — no other text, no markdown code fences.\n\n"
            + raw
        )
        raw2 = await _call_gemini(fix_prompt)
        generated = _extract_json(raw2)

    # 7. Create new Assessment
    new_title = f"{source.title} — Re-Assessment"
    new_assessment = Assessment(
        class_id=source.class_id,
        teacher_id=source.teacher_id,
        title=new_title,
        source_material_id=source.source_material_id,
        difficulty=DifficultyLevel(difficulty),
    )
    db.add(new_assessment)
    await db.flush()

    # 8. Save questions
    questions = []
    for i, q_data in enumerate(generated):
        q = Question(
            assessment_id=new_assessment.id,
            question_text=q_data.get("question_text", ""),
            question_type=q_data.get("question_type", "mcq"),
            choices=q_data.get("choices"),
            correct_answer=q_data.get("correct_answer", ""),
            explanation=q_data.get("explanation"),
            subtopic_tags=q_data.get("subtopic_tags"),
            blooms_level=q_data.get("blooms_level"),
            difficulty=q_data.get("difficulty"),
            display_order=i + 1,
            created_via=CreatedVia.ai,
        )
        db.add(q)
        questions.append(q)

    # 9. Create ReAssessment link record
    record = ReAssessment(
        source_assessment_id=source_assessment_id,
        class_id=source.class_id,
        type=ReAssessmentType.class_wide,
        target_subtopics=target_subtopics,
        generated_assessment_id=new_assessment.id,
    )
    db.add(record)

    await db.commit()
    await db.refresh(new_assessment)
    return new_assessment
