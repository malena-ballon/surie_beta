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
- NEVER reference the source material in question text — do NOT use phrases like "according to the text", "based on the passage", "as mentioned in the source", "in the material", "the document states", "from the provided source", or any similar phrasing — questions must read as fully standalone items with no reference to any source
- subtopic_tags must use BROAD topic names (e.g. "Cell Division", "Newton's Laws") — never narrow sub-steps or specific phases
- For mcq: always provide exactly 4 choices labeled A, B, C, D; one must be correct
- For true_false: correct_answer must be exactly "True" or "False"
- For identification: correct_answer is the exact term or short phrase
- For essay: choices must be null; correct_answer must be a model answer or key points (2-4 sentences)
- For matching: choices must be null; correct_answer must be a JSON array of {{\"term\": \"...\", \"match\": \"...\"}} pairs with 4-6 pairs
- Output ONLY a valid JSON array — no markdown fences, no explanation text

Question breakdown:
{breakdown_lines}

Subject: {subject}
Grade Level: {grade_level}
Difficulty: {difficulty}

Each question object must have this exact shape:
{{
  "question_text": "Full question text",
  "question_type": "mcq" | "true_false" | "identification" | "essay" | "matching",
  "choices": [{{"label": "A", "text": "...", "is_correct": false}}, ...],
  "correct_answer": "See type-specific rules above",
  "explanation": "Why this answer is correct",
  "subtopic_tags": ["Major Topic Area"],
  "blooms_level": "remembering" | "understanding" | "applying" | "analyzing" | "evaluating" | "creating",
  "difficulty": "easy" | "medium" | "hard"
}}

For non-MCQ types (true_false, identification, essay, matching), set choices to null.
For matching, correct_answer must be a valid JSON string, e.g.: "[{{\"term\":\"Mitosis\",\"match\":\"Cell division for growth\"}},...]"

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
