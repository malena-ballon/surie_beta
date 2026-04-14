"""add grading and grade release fields

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # assessments: grade release mode and release flag
    op.add_column("assessments", sa.Column("release_mode", sa.String(10), nullable=False, server_default="auto"))
    op.add_column("assessments", sa.Column("grades_released", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # responses: AI feedback, rubric, teacher comment
    op.add_column("responses", sa.Column("feedback", sa.Text(), nullable=True))
    op.add_column("responses", sa.Column("rubric", sa.JSON(), nullable=True))
    op.add_column("responses", sa.Column("teacher_comment", sa.Text(), nullable=True))

    # questions: max marks per question
    op.add_column("questions", sa.Column("max_marks", sa.Float(), nullable=False, server_default="1.0"))


def downgrade() -> None:
    op.drop_column("assessments", "release_mode")
    op.drop_column("assessments", "grades_released")
    op.drop_column("responses", "feedback")
    op.drop_column("responses", "rubric")
    op.drop_column("responses", "teacher_comment")
    op.drop_column("questions", "max_marks")
