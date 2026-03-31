import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.institution import Institution


class UserRole(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"


class User(Base):
    __tablename__ = "users"

    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    # Relationships
    institution: Mapped["Institution"] = relationship(
        "Institution", back_populates="users"
    )
