import math
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models import Classroom, Enrollment, User, UserRole
from app.models.classroom import _generate_join_code
from app.schemas.classes import (
    AddStudentsRequest,
    AddStudentsResponse,
    ClassCreate,
    ClassDetail,
    ClassItem,
    ClassUpdate,
    PaginatedClasses,
    StudentInfo,
)

router = APIRouter()


async def _get_class_or_403(
    class_id: uuid.UUID, db: AsyncSession, current_user: User
) -> Classroom:
    result = await db.execute(select(Classroom).where(Classroom.id == class_id))
    classroom = result.scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")
    if current_user.role != UserRole.admin and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return classroom


async def _student_count(class_id: uuid.UUID, db: AsyncSession) -> int:
    return await db.scalar(
        select(func.count(Enrollment.id)).where(Enrollment.class_id == class_id)
    ) or 0


def _to_item(classroom: Classroom, count: int) -> ClassItem:
    return ClassItem(
        id=classroom.id,
        name=classroom.name,
        subject=classroom.subject,
        grade_level=classroom.grade_level,
        section=classroom.section,
        academic_year=classroom.academic_year,
        teacher_id=classroom.teacher_id,
        institution_id=classroom.institution_id,
        is_archived=classroom.is_archived,
        student_count=count,
        join_code=classroom.join_code,
        created_at=classroom.created_at,
        updated_at=classroom.updated_at,
    )


# ── List ──────────────────────────────────────────────────────


@router.get("", response_model=PaginatedClasses)
async def list_classes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedClasses:
    base = select(Classroom).where(
        Classroom.teacher_id == current_user.id,
        Classroom.is_archived.is_(False),
    )
    if search:
        base = base.where(Classroom.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0

    result = await db.execute(base.offset((page - 1) * per_page).limit(per_page))
    classes = result.scalars().all()

    # Batch student counts
    class_ids = [c.id for c in classes]
    counts: dict[uuid.UUID, int] = {}
    if class_ids:
        cnt_result = await db.execute(
            select(Enrollment.class_id, func.count().label("n"))
            .where(Enrollment.class_id.in_(class_ids))
            .group_by(Enrollment.class_id)
        )
        counts = {row.class_id: row.n for row in cnt_result}

    return PaginatedClasses(
        items=[_to_item(c, counts.get(c.id, 0)) for c in classes],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


# ── Create ────────────────────────────────────────────────────


@router.post("", response_model=ClassItem, status_code=status.HTTP_201_CREATED)
async def create_class(
    body: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClassItem:
    classroom = Classroom(
        institution_id=current_user.institution_id,
        teacher_id=current_user.id,
        **body.model_dump(),
    )
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)
    return _to_item(classroom, 0)


# ── Detail ────────────────────────────────────────────────────


@router.get("/{class_id}", response_model=ClassDetail)
async def get_class(
    class_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClassDetail:
    classroom = await _get_class_or_403(class_id, db, current_user)

    students_result = await db.execute(
        select(User)
        .join(Enrollment, Enrollment.student_id == User.id)
        .where(Enrollment.class_id == classroom.id)
        .order_by(User.last_name, User.first_name)
    )
    students = students_result.scalars().all()

    return ClassDetail(
        **_to_item(classroom, len(students)).model_dump(),
        students=[
            StudentInfo(id=s.id, first_name=s.first_name, last_name=s.last_name, email=s.email)
            for s in students
        ],
    )


# ── Update ────────────────────────────────────────────────────


@router.put("/{class_id}", response_model=ClassItem)
async def update_class(
    class_id: uuid.UUID,
    body: ClassUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClassItem:
    classroom = await _get_class_or_403(class_id, db, current_user)
    for key, val in body.model_dump(exclude_none=True).items():
        setattr(classroom, key, val)
    await db.commit()
    await db.refresh(classroom)
    return _to_item(classroom, await _student_count(classroom.id, db))


# ── Regenerate join code ──────────────────────────────────────


@router.post("/{class_id}/regenerate-code", response_model=ClassItem)
async def regenerate_join_code(
    class_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClassItem:
    classroom = await _get_class_or_403(class_id, db, current_user)
    classroom.join_code = _generate_join_code()
    await db.commit()
    await db.refresh(classroom)
    return _to_item(classroom, await _student_count(classroom.id, db))


# ── Add students ──────────────────────────────────────────────


@router.post("/{class_id}/students", response_model=AddStudentsResponse)
async def add_students(
    class_id: uuid.UUID,
    body: AddStudentsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AddStudentsResponse:
    classroom = await _get_class_or_403(class_id, db, current_user)
    added = already_enrolled = 0

    for s in body.students:
        # Find or create user
        result = await db.execute(select(User).where(User.email == s.email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                institution_id=current_user.institution_id,
                email=s.email,
                password_hash=get_password_hash(secrets.token_urlsafe(16)),
                role=UserRole.student,
                first_name=s.first_name,
                last_name=s.last_name,
            )
            db.add(user)
            await db.flush()

        # Check if already enrolled
        enroll_result = await db.execute(
            select(Enrollment).where(
                Enrollment.class_id == classroom.id,
                Enrollment.student_id == user.id,
            )
        )
        if enroll_result.scalar_one_or_none():
            already_enrolled += 1
            continue

        db.add(Enrollment(class_id=classroom.id, student_id=user.id))
        added += 1

    await db.commit()
    return AddStudentsResponse(added=added, already_enrolled=already_enrolled)


# ── Remove student ────────────────────────────────────────────


@router.delete("/{class_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_student(
    class_id: uuid.UUID,
    student_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    classroom = await _get_class_or_403(class_id, db, current_user)
    result = await db.execute(
        select(Enrollment).where(
            Enrollment.class_id == classroom.id,
            Enrollment.student_id == student_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await db.delete(enrollment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
