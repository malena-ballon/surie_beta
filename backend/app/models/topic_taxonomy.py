import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TopicTaxonomy(Base):
    __tablename__ = "topic_taxonomy"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subtopic: Mapped[str] = mapped_column(String, nullable=False)
    parent_topic: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("assessment_id", "subtopic", name="uq_taxonomy_assessment_subtopic"),
    )
