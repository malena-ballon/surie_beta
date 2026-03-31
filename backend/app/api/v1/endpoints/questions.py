"""
Question chat endpoint — conversational AI editing for teachers.
"""
import json
import re
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models import Question, User
from app.models.assessment import Assessment

router = APIRouter()

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

SYSTEM_PROMPT = """You are Surie's question editor assistant. Help teachers refine exam questions.
When suggesting changes, return both a natural language explanation AND the updated question fields as structured JSON in a ```json block.
Only include fields that are actually changing. The JSON must follow this shape:
{
  "question_text": "...",
  "choices": [{"label": "A", "text": "...", "is_correct": false}, ...],
  "correct_answer": "A",
  "explanation": "...",
  "subtopic_tags": [...],
  "blooms_level": "remembering|understanding|applying|analyzing|evaluating|creating",
  "difficulty": "easy|medium|hard"
}
If no structural changes are needed (e.g. the teacher just asked a question), omit the ```json block entirely.
Keep explanations concise and teacher-friendly."""


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    message: str
    updated_question: dict | None = None


async def _call_gemini(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            GEMINI_API_URL,
            params={"key": settings.GEMINI_API_KEY},
            headers={"content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.7},
            },
        )
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def _extract_json_block(text: str) -> dict | None:
    match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except (json.JSONDecodeError, ValueError):
        return None


def _strip_json_block(text: str) -> str:
    cleaned = re.sub(r"```json\s*[\s\S]*?\s*```", "", text).strip()
    # Collapse multiple blank lines
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


@router.post("/{question_id}/chat", response_model=ChatResponse)
async def chat_question(
    question_id: uuid.UUID,
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Verify teacher owns the assessment
    assessment = await db.scalar(
        select(Assessment).where(Assessment.id == question.assessment_id)
    )
    if not assessment or assessment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Build choices context
    choices_text = ""
    if question.choices:
        choices_text = "\n".join(
            f"  {c['label']}. {c['text']}{'  ← correct' if c['is_correct'] else ''}"
            for c in question.choices
        )

    context = f"""{SYSTEM_PROMPT}

--- CURRENT QUESTION ---
Type: {question.question_type}
Question: {question.question_text}
{f'Choices:\n{choices_text}' if choices_text else f'Correct answer: {question.correct_answer}'}
Explanation: {question.explanation or 'None'}
Subtopics: {', '.join(question.subtopic_tags or []) or 'None'}
Bloom's level: {question.blooms_level or 'None'}
Difficulty: {question.difficulty or 'None'}

--- TEACHER'S REQUEST ---
{body.message}"""

    try:
        raw = await _call_gemini(context)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI request failed: {e}")

    updated_question = _extract_json_block(raw)
    message_text = _strip_json_block(raw)

    return ChatResponse(
        message=message_text,
        updated_question=updated_question,
    )
