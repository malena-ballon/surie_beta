import json
import re

import httpx

from app.core.config import settings

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096


def _build_prompt(
    source_text: str,
    question_breakdown: dict,
    difficulty: str,
    subject: str,
    grade_level: str,
) -> tuple[str, str]:
    breakdown_lines = "\n".join(
        f"  - {qtype.replace('_', ' ').title()}: {count} question{'s' if count != 1 else ''}"
        for qtype, count in question_breakdown.items()
        if count > 0
    )
    total = sum(question_breakdown.values())

    system = """You are an expert exam question generator for Philippine K-12 education.
Your task is to generate high-quality exam questions based ONLY on the provided source material.

Rules:
- Generate EXACTLY the number of questions specified per type (total must match)
- Apply the specified difficulty level consistently
- Make questions grade-level appropriate
- Base ALL questions strictly on the provided source material
- For MCQ: always provide exactly 4 choices labeled A, B, C, D; one must be correct
- For true_false: correct_answer must be exactly "True" or "False"
- For identification: correct_answer is the exact term or short phrase
- Output ONLY a valid JSON array — no markdown fences, no explanation text

Each question object must have this exact shape:
{
  "question_text": "Full question text",
  "question_type": "mcq" | "true_false" | "identification",
  "choices": [{"label": "A", "text": "...", "is_correct": false}, ...],
  "correct_answer": "Correct answer text or MCQ label (A/B/C/D)",
  "explanation": "Why this answer is correct and why the others are not",
  "subtopic_tags": ["subtopic1", "subtopic2"],
  "blooms_level": "remembering" | "understanding" | "applying" | "analyzing" | "evaluating" | "creating",
  "difficulty": "easy" | "medium" | "hard"
}

For non-MCQ types, set choices to null."""

    user = f"""Generate exam questions for {subject}, Grade {grade_level}.
Difficulty level: {difficulty}
Total questions: {total}

Question breakdown:
{breakdown_lines}

Source material:
{source_text[:12000]}"""

    return system, user


def _extract_json(text: str) -> list[dict]:
    text = text.strip()
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


async def _call_anthropic(system: str, messages: list[dict]) -> str:
    import logging
    logger = logging.getLogger(__name__)
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": MAX_TOKENS,
                "system": system,
                "messages": messages,
            },
        )
        if not response.is_success:
            logger.error("Anthropic API error %s: %s", response.status_code, response.text)
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]


async def generate_exam_questions(
    source_text: str,
    question_breakdown: dict,
    difficulty: str,
    subject: str,
    grade_level: str,
) -> list[dict]:
    system, user_msg = _build_prompt(
        source_text, question_breakdown, difficulty, subject, grade_level
    )

    messages = [{"role": "user", "content": user_msg}]
    raw = await _call_anthropic(system, messages)

    try:
        return _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        # Retry once with a fix-your-JSON message
        messages.append({"role": "assistant", "content": raw})
        messages.append({
            "role": "user",
            "content": (
                "Your response was not valid JSON. "
                "Return ONLY the JSON array — no other text, no markdown code fences."
            ),
        })
        raw2 = await _call_anthropic(system, messages)
        return _extract_json(raw2)
