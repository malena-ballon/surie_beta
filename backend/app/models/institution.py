import enum
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class InstitutionType(str, enum.Enum):
    private = "private"
    public = "public"
    review_center = "review_center"


class SubscriptionTier(str, enum.Enum):
    basic = "basic"
    plus = "plus"
    enterprise = "enterprise"


class Institution(Base):
    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[InstitutionType] = mapped_column(nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        default=SubscriptionTier.basic,
        server_default=SubscriptionTier.basic.value,
        nullable=False,
    )
    student_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="institution")
