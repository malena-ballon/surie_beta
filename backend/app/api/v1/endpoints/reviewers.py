"""
Endpoints for individual reviewer records.
  PATCH /api/v1/reviewers/{reviewer_id}   — update content
  GET   /api/v1/reviewers/{reviewer_id}/pdf — download PDF
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Assessment, Classroom, User, UserRole
from app.models.reviewer_output import ReviewerOutput
from app.services.pdf_service import generate_reviewer_pdf

router = APIRouter()


class ReviewerUpdateData(BaseModel):
    content: str


async def _get_reviewer_or_403(
    reviewer_id: uuid.UUID,
    db: AsyncSession,
    current_user: User,
) -> ReviewerOutput:
    reviewer = await db.scalar(
        select(ReviewerOutput).where(ReviewerOutput.id == reviewer_id)
    )
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # Check ownership via the parent assessment
    assessment = await db.scalar(
        select(Assessment).where(Assessment.id == reviewer.assessment_id)
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if current_user.role != UserRole.admin and assessment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return reviewer


@router.patch("/{reviewer_id}")
async def update_reviewer(
    reviewer_id: uuid.UUID,
    body: ReviewerUpdateData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    reviewer = await _get_reviewer_or_403(reviewer_id, db, current_user)
    reviewer.content = body.content.strip()
    await db.commit()
    await db.refresh(reviewer)
    return {
        "id": str(reviewer.id),
        "content": reviewer.content,
    }


@router.get("/{reviewer_id}/pdf")
async def download_reviewer_pdf(
    reviewer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    reviewer = await _get_reviewer_or_403(reviewer_id, db, current_user)

    # Fetch assessment → class + teacher info
    assessment = await db.scalar(
        select(Assessment).where(Assessment.id == reviewer.assessment_id)
    )

    class_name = ""
    if assessment and assessment.class_id:
        classroom = await db.scalar(
            select(Classroom).where(Classroom.id == assessment.class_id)
        )
        if classroom:
            class_name = classroom.name
            if classroom.section:
                class_name += f" — {classroom.section}"

    teacher_name = f"{current_user.first_name} {current_user.last_name}".strip()

    generated_at = reviewer.created_at.strftime("%B %d, %Y")

    try:
        pdf_bytes = generate_reviewer_pdf(
            title=reviewer.title,
            content=reviewer.content,
            subject=reviewer.subject or "",
            grade_level=reviewer.grade_level or "",
            class_name=class_name,
            teacher_name=teacher_name,
            generated_at=generated_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    safe_title = reviewer.title.replace(" ", "_")[:60]
    filename = f"{safe_title}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
