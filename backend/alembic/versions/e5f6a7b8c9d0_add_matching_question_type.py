"""add matching question type

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-07 00:00:00.000000

"""
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL 12+ allows ALTER TYPE ADD VALUE IF NOT EXISTS inside a transaction
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'matching'")


def downgrade() -> None:
    # Postgres doesn't support removing enum values; would require recreating the type
    pass
