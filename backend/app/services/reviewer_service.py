"""
Reviewer generation service.
Produces a comprehensive, student-facing study reviewer grounded in:
  - The teacher's source material text
  - The class diagnostic report (weak subtopics, misconceptions, wrong answers)
"""
from __future__ import annotations

import json
import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Assessment, SourceMaterial
from app.models.diagnostic_report import DiagnosticReport
from app.models.reviewer_output import ReviewerOutput

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


def _build_reviewer_prompt(
    source_text: str,
    weak_subtopics: list[dict],   # [{subtopic, avg_pct, misconception}]
    strong_subtopics: list[str],
    subject: str,
    grade_level: str,
) -> str:
    weak_block = "\n".join(
        f"  - {s['subtopic']} (class avg: {s['avg_pct']}%)"
        + (f"\n    Common misconception: {s['misconception']}" if s.get("misconception") else "")
        for s in weak_subtopics
    )
    strong_block = ", ".join(strong_subtopics) if strong_subtopics else "None identified"

    return f"""You are an expert educational content writer for Philippine K-12.
A class just took an assessment and their diagnostic report shows specific areas of weakness.
Your task is to write a COMPREHENSIVE STUDY REVIEWER that will help them prepare for a re-assessment.

CONTEXT:
- Subject: {subject or "Science"}
- Grade Level: {grade_level or "Middle School"}
- Areas where the class STRUGGLED (focus here — 80% of reviewer content):
{weak_block}
- Areas where the class did WELL (briefly reinforce — 20%):
{strong_block}

STRICT RULES FOR THE REVIEWER:
1. This is NOT an answer key or a list of Q&A. Write it like a study guide a good tutor would give.
2. For each weak subtopic, include:
   - A clear, friendly explanation of the core concept (in simple language)
   - The most common misconception and why it is WRONG, with a correct explanation
   - A real-world analogy or example that makes the concept stick
   - 1–2 "Think About It" questions (open-ended, no answers given) to prompt reflection
3. Use the source material as the factual basis — do not invent concepts not covered there.
4. Write in a warm, encouraging tone. Address the student directly ("you", "your").
5. Use clear section headers and bullet points for readability.
6. End with a short "Key Takeaways" summary for the whole reviewer.
7. Output clean markdown — use ##, ###, **bold**, bullet points. No JSON, no code blocks.

Source material (use this as your factual basis):
{source_text[:14000]}

Now write the reviewer:"""


async def _call_gemini(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            GEMINI_API_URL,
            params={"key": settings.GEMINI_API_KEY},
            headers={"content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 8192, "temperature": 0.6},
            },
        )
        if not response.is_success:
            logger.error("Gemini error %s: %s", response.status_code, response.text)
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


async def generate_reviewer(
    assessment_id: uuid.UUID,
    config: dict,
    db: AsyncSession,
) -> dict:
    """
    Returns:
      {
        title: str,
        subject: str,
        grade_level: str,
        content: str,   # markdown
        weak_subtopics: [...],
        generated_at: str,
      }
    """
    # 1. Fetch diagnostic report
    report = await db.scalar(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == assessment_id)
    )
    if not report:
        raise ValueError("No diagnostic report found. Generate diagnostics first.")

    # 2. Fetch source assessment
    source = await db.scalar(
        select(Assessment).where(Assessment.id == assessment_id)
    )
    if not source:
        raise ValueError("Assessment not found.")

    subject = config.get("subject", "")
    grade_level = config.get("grade_level", "")

    # 3. Fetch source material
    if not source.source_material_id:
        raise ValueError("This assessment has no source material uploaded.")
    material = await db.scalar(
        select(SourceMaterial).where(SourceMaterial.id == source.source_material_id)
    )
    if not material or not material.content_text:
        raise ValueError("Source material has no text content. Please re-upload the file.")

    # 4. Build weak/strong subtopic lists from the report
    threshold = config.get("mastery_threshold", 70.0)
    misconception_map = {
        t["subtopic"]: t.get("misconception", "")
        for t in (report.topics_to_reteach or [])
    }

    weak_subtopics = [
        {
            "subtopic": s,
            "avg_pct": d["pct"],
            "misconception": misconception_map.get(s, ""),
        }
        for s, d in sorted(report.subtopic_mastery.items(), key=lambda x: x[1]["pct"])
        if d["pct"] < threshold
    ]

    strong_subtopics = [
        s for s, d in report.subtopic_mastery.items()
        if d["pct"] >= 85
    ]

    if not weak_subtopics:
        # All topics strong — reviewer still useful as a general reinforcement
        weak_subtopics = [
            {"subtopic": s, "avg_pct": d["pct"], "misconception": ""}
            for s, d in sorted(report.subtopic_mastery.items(), key=lambda x: x[1]["pct"])[:5]
        ]

    # 5. Generate reviewer content
    prompt = _build_reviewer_prompt(
        source_text=material.content_text,
        weak_subtopics=weak_subtopics,
        strong_subtopics=strong_subtopics,
        subject=subject,
        grade_level=grade_level,
    )
    content = await _call_gemini(prompt)

    from datetime import datetime, timezone

    title = f"{source.title} — Study Reviewer"
    weak_list = [s["subtopic"] for s in weak_subtopics]

    # Persist to DB
    record = ReviewerOutput(
        assessment_id=assessment_id,
        title=title,
        subject=subject or "",
        grade_level=grade_level or "",
        content=content.strip(),
        weak_subtopics=weak_list,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": str(record.id),
        "title": title,
        "subject": subject or "",
        "grade_level": grade_level or "",
        "content": content.strip(),
        "weak_subtopics": weak_list,
        "generated_at": record.created_at.isoformat(),
    }
