import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Assessment, User, UserRole
from app.models.diagnostic_report import DiagnosticReport
from app.services.diagnostic_service import generate_diagnostic_report

router = APIRouter()


async def _get_assessment_or_403(
    assessment_id: uuid.UUID, db: AsyncSession, current_user: User
) -> Assessment:
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if current_user.role != UserRole.admin and assessment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return assessment


def _report_to_dict(report: DiagnosticReport) -> dict:
    return {
        "id": str(report.id),
        "assessment_id": str(report.assessment_id),
        "class_id": str(report.class_id),
        "avg_score": report.avg_score,
        "mastery_rate": report.mastery_rate,
        "score_distribution": report.score_distribution,
        "subtopic_mastery": report.subtopic_mastery,
        "topics_to_reteach": report.topics_to_reteach,
        "class_strengths": report.class_strengths,
        "student_summaries": report.student_summaries or [],
        "generated_at": report.generated_at.isoformat(),
    }


@router.post("/{assessment_id}/diagnostics/generate")
async def generate_diagnostics(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _get_assessment_or_403(assessment_id, db, current_user)
    try:
        report = await generate_diagnostic_report(assessment_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Diagnostic generation failed: {e}")
    return _report_to_dict(report)


@router.get("/{assessment_id}/diagnostics")
async def get_diagnostics(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict | None:
    await _get_assessment_or_403(assessment_id, db, current_user)
    result = await db.execute(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == assessment_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        return None
    return _report_to_dict(report)


@router.get("/{assessment_id}/diagnostics/students")
async def get_student_diagnostics(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    await _get_assessment_or_403(assessment_id, db, current_user)
    result = await db.execute(
        select(DiagnosticReport).where(DiagnosticReport.assessment_id == assessment_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        return []
    return report.student_summaries or []
