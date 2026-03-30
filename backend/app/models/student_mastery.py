import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrendType(str, enum.Enum):
    improving = "improving"
    declining = "declining"
    stable = "stable"


class StudentMastery(Base):
    __tablename__ = "student_mastery"

    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    subtopic: Mapped[str] = mapped_column(String, nullable=False)
    mastery_pct: Mapped[float] = mapped_column(Float, nullable=False)
    trend: Mapped[TrendType] = mapped_column(nullable=False)
    last_assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
