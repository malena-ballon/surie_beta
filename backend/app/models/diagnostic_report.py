import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DiagnosticReport(Base):
    __tablename__ = "diagnostic_reports"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    avg_score: Mapped[float] = mapped_column(Float, nullable=False)
    mastery_rate: Mapped[float] = mapped_column(Float, nullable=False)
    score_distribution: Mapped[dict] = mapped_column(JSON, nullable=False)
    subtopic_mastery: Mapped[dict] = mapped_column(JSON, nullable=False)
    topics_to_reteach: Mapped[list] = mapped_column(JSON, nullable=False)
    class_strengths: Mapped[list] = mapped_column(JSON, nullable=False)
    student_summaries: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    topic_groups: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
