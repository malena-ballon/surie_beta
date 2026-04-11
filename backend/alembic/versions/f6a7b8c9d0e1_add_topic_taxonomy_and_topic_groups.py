"""add topic_taxonomy table and topic_groups to diagnostic_reports

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "topic_taxonomy",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("assessment_id", sa.Uuid(), nullable=False),
        sa.Column("subtopic", sa.String(), nullable=False),
        sa.Column("parent_topic", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["assessments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "assessment_id", "subtopic", name="uq_taxonomy_assessment_subtopic"
        ),
    )
    op.create_index(
        "ix_topic_taxonomy_assessment_id", "topic_taxonomy", ["assessment_id"]
    )

    op.add_column(
        "diagnostic_reports",
        sa.Column("topic_groups", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("diagnostic_reports", "topic_groups")
    op.drop_index("ix_topic_taxonomy_assessment_id", table_name="topic_taxonomy")
    op.drop_table("topic_taxonomy")
