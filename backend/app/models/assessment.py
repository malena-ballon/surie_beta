import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DifficultyLevel(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class AssessmentStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"
    archived = "archived"


class Assessment(Base):
    __tablename__ = "assessments"

    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    source_material_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("source_materials.id", ondelete="SET NULL"), nullable=True
    )
    difficulty: Mapped[DifficultyLevel] = mapped_column(nullable=False)
    status: Mapped[AssessmentStatus] = mapped_column(
        default=AssessmentStatus.draft,
        server_default=AssessmentStatus.draft.value,
        nullable=False,
    )
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
