import json
import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


def _build_prompt(
    source_text: str,
    question_breakdown: dict,
    difficulty: str,
    subject: str,
    grade_level: str,
) -> str:
    breakdown_lines = "\n".join(
        f"  - {qtype.replace('_', ' ').title()}: {count} question{'s' if count != 1 else ''}"
        for qtype, count in question_breakdown.items()
        if count > 0
    )
    total = sum(question_breakdown.values())

    return f"""You are an expert exam question generator for Philippine K-12 education.
Your task is to generate high-quality exam questions based ONLY on the provided source material.

Rules:
- Generate EXACTLY {total} questions total matching the breakdown below
- Apply the specified difficulty level consistently
- Make questions grade-level appropriate for Grade {grade_level}
- Base ALL questions strictly on the provided source material
- For mcq: always provide exactly 4 choices labeled A, B, C, D; one must be correct
- For true_false: correct_answer must be exactly "True" or "False"
- For identification: correct_answer is the exact term or short phrase
- Output ONLY a valid JSON array — no markdown fences, no explanation text

Question breakdown:
{breakdown_lines}

Subject: {subject}
Grade Level: {grade_level}
Difficulty: {difficulty}

Each question object must have this exact shape:
{{
  "question_text": "Full question text",
  "question_type": "mcq" | "true_false" | "identification",
  "choices": [{{"label": "A", "text": "...", "is_correct": false}}, ...],
  "correct_answer": "Correct answer text or MCQ label (A/B/C/D)",
  "explanation": "Why this answer is correct and why the others are not",
  "subtopic_tags": ["subtopic1", "subtopic2"],
  "blooms_level": "remembering" | "understanding" | "applying" | "analyzing" | "evaluating" | "creating",
  "difficulty": "easy" | "medium" | "hard"
}}

For non-MCQ types, set choices to null.

Source material:
{source_text[:12000]}"""


def _extract_json(text: str) -> list[dict]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


async def _call_gemini(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            GEMINI_API_URL,
            params={"key": settings.GEMINI_API_KEY},
            headers={"content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "maxOutputTokens": 8192,
                    "temperature": 0.4,
                },
            },
        )
        if not response.is_success:
            logger.error("Gemini API error %s: %s", response.status_code, response.text)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def generate_exam_questions(
    source_text: str,
    question_breakdown: dict,
    difficulty: str,
    subject: str,
    grade_level: str,
) -> list[dict]:
    prompt = _build_prompt(source_text, question_breakdown, difficulty, subject, grade_level)
    raw = await _call_gemini(prompt)

    try:
        return _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        # Retry once with explicit fix request
        fix_prompt = (
            prompt
            + "\n\nYour previous response was not valid JSON. "
            "Return ONLY the JSON array — no other text, no markdown code fences.\n\n"
            + raw
        )
        raw2 = await _call_gemini(fix_prompt)
        return _extract_json(raw2)
