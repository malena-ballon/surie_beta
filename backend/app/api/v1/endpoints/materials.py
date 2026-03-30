import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import SourceMaterial, User
from app.schemas.materials import MaterialItem

router = APIRouter()

UPLOADS_DIR = Path(__file__).resolve().parents[4] / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _extract_text_pdf(path: Path) -> str:
    import pdfplumber

    text_parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_text_docx(path: Path) -> str:
    from docx import Document

    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


# ── Upload ────────────────────────────────────────────────────


@router.post("", response_model=MaterialItem, status_code=status.HTTP_201_CREATED)
async def upload_material(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MaterialItem:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .pdf and .docx files are allowed",
        )

    # Save file with unique name
    unique_name = f"{uuid.uuid4()}{suffix}"
    dest = UPLOADS_DIR / unique_name
    content = await file.read()
    dest.write_bytes(content)

    # Extract text
    try:
        if suffix == ".pdf":
            content_text = _extract_text_pdf(dest)
        else:
            content_text = _extract_text_docx(dest)
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to extract text: {exc}",
        )

    material = SourceMaterial(
        teacher_id=current_user.id,
        filename=file.filename or unique_name,
        file_type=suffix.lstrip("."),
        file_url=str(dest),
        content_text=content_text,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)

    return MaterialItem(
        id=material.id,
        teacher_id=material.teacher_id,
        filename=material.filename,
        file_type=material.file_type,
        file_url=material.file_url,
        preview=(material.content_text or "")[:200],
        created_at=material.created_at,
        updated_at=material.updated_at,
    )


# ── List ──────────────────────────────────────────────────────


@router.get("", response_model=list[MaterialItem])
async def list_materials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MaterialItem]:
    result = await db.execute(
        select(SourceMaterial)
        .where(SourceMaterial.teacher_id == current_user.id)
        .order_by(SourceMaterial.created_at.desc())
    )
    materials = result.scalars().all()
    return [
        MaterialItem(
            id=m.id,
            teacher_id=m.teacher_id,
            filename=m.filename,
            file_type=m.file_type,
            file_url=m.file_url,
            preview=(m.content_text or "")[:200],
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in materials
    ]
