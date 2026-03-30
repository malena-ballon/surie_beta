"""add join_code to classes

Revision ID: a1b2c3d4e5f6
Revises: 46ea6bcdc735
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union
import secrets
import string

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '46ea6bcdc735'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def upgrade() -> None:
    op.add_column('classes', sa.Column('join_code', sa.String(8), nullable=True))

    # Generate unique codes for existing rows
    conn = op.get_bind()
    rows = conn.execute(text("SELECT id FROM classes WHERE join_code IS NULL")).fetchall()
    for row in rows:
        while True:
            code = _code()
            exists = conn.execute(
                text("SELECT 1 FROM classes WHERE join_code = :code"), {"code": code}
            ).fetchone()
            if not exists:
                break
        conn.execute(
            text("UPDATE classes SET join_code = :code WHERE id = :id"),
            {"code": code, "id": str(row[0])},
        )

    op.create_unique_constraint('uq_classes_join_code', 'classes', ['join_code'])


def downgrade() -> None:
    op.drop_constraint('uq_classes_join_code', 'classes', type_='unique')
    op.drop_column('classes', 'join_code')
