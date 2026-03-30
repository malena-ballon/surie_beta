import secrets
import string
import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _generate_join_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class Classroom(Base):
    __tablename__ = "classes"

    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    grade_level: Mapped[str] = mapped_column(String, nullable=False)
    section: Mapped[str | None] = mapped_column(String, nullable=True)
    academic_year: Mapped[str] = mapped_column(String, nullable=False)
    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    join_code: Mapped[str | None] = mapped_column(
        String(8), nullable=True, unique=True, default=_generate_join_code
    )
