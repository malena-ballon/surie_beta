"""add description and time_limit to assessments

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-02

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assessments", sa.Column("description", sa.String(), nullable=True))
    op.add_column("assessments", sa.Column("time_limit_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("assessments", "time_limit_minutes")
    op.drop_column("assessments", "description")
