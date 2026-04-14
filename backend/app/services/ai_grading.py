"""AI-powered grading service for Surie assessments.

Handles:
- Essay grading: rubric generation + per-criterion scoring + overall comment
- Identification / short-answer: fuzzy / semantic matching
"""

import difflib
import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


# ── Identification: fuzzy match ────────────────────────────────

def fuzzy_match_identification(
    student_answer: str,
    correct_answer: str,
    threshold: float = 0.75,
) -> tuple[bool, float]:
    """Return (is_correct, similarity_ratio).

    Uses SequenceMatcher (fast, no external deps).  Threshold 0.75 means the
    student's answer is at least 75% similar to the expected answer.
    """
    a = student_answer.strip().lower()
    b = correct_answer.strip().lower()

    if a == b:
        return True, 1.0

    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    return ratio >= threshold, round(ratio, 4)


# ── Essay: AI rubric + scoring ─────────────────────────────────

def _build_essay_prompt(
    question_text: str,
    model_answer: str,
    student_answer: str,
    max_marks: float,
) -> str:
    return f"""You are an expert educational assessor grading a student's essay response.

Question: {question_text}

Model Answer / Key Points:
{model_answer}

Student's Answer:
{student_answer}

Maximum marks available: {max_marks}

Your task:
1. Generate a concise rubric (2-4 criteria) appropriate for this question.
2. Score the student on each criterion (score and max_score per criterion).
3. Give brief qualitative feedback per criterion (1-2 sentences).
4. Calculate a total score (sum of criterion scores, must not exceed {max_marks}).
5. Write a 2-3 sentence overall comment for the student.

Respond ONLY with a valid JSON object matching this exact shape (no markdown, no extra text):
{{
  "rubric": [
    {{
      "criterion": "string",
      "score": number,
      "max_score": number,
      "feedback": "string"
    }}
  ],
  "total_score": number,
  "overall_comment": "string"
}}"""


async def grade_essay(
    question_text: str,
    model_answer: str,
    student_answer: str,
    max_marks: float = 5.0,
) -> dict:
    """Call Gemini to grade an essay and return rubric + scores + comment.

    Returns a dict:
    {
        "rubric": [...],        # list of criterion objects
        "total_score": float,
        "overall_comment": str,
    }
    Falls back to a zero-score result on any error.
    """
    prompt = _build_essay_prompt(question_text, model_answer, student_answer, max_marks)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{GEMINI_API_URL}?key={settings.gemini_api_key}",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Strip optional markdown fences
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(raw)

        # Clamp total_score to max_marks
        total = min(float(result.get("total_score", 0)), max_marks)
        result["total_score"] = round(total, 2)
        return result

    except Exception as exc:
        logger.warning("Essay grading failed: %s", exc)
        return {
            "rubric": [{"criterion": "Content", "score": 0, "max_score": max_marks, "feedback": "Could not auto-grade. Please review manually."}],
            "total_score": 0.0,
            "overall_comment": "Auto-grading encountered an error. Please review this response manually.",
        }
