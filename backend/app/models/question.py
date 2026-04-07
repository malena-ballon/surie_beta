import enum
import uuid

from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    true_false = "true_false"
    identification = "identification"
    essay = "essay"
    matching = "matching"


class CreatedVia(str, enum.Enum):
    ai = "ai"
    manual = "manual"
    hybrid = "hybrid"


class Question(Base):
    __tablename__ = "questions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(nullable=False)
    choices: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtopic_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    blooms_level: Mapped[str | None] = mapped_column(String, nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_via: Mapped[CreatedVia] = mapped_column(nullable=False)
