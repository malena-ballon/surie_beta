import enum
import uuid

from sqlalchemy import ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ReAssessmentType(str, enum.Enum):
    class_wide = "class_wide"
    personalized = "personalized"


class ReAssessment(Base):
    __tablename__ = "reassessments"

    source_assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[ReAssessmentType] = mapped_column(nullable=False)
    target_subtopics: Mapped[list] = mapped_column(JSON, nullable=False)
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    generated_assessment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assessments.id", ondelete="SET NULL"), nullable=True
    )
