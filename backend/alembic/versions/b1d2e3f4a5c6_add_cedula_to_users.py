"""add cedula to users

Revision ID: b1d2e3f4a5c6
Revises: a0b1c2d3e4f5
Create Date: 2026-08-11

Cédula del usuario: se pide al crear responsables de Tarjeta CQ y se muestra
en la bandeja de paquetes de legalización.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b1d2e3f4a5c6'
down_revision: Union[str, Sequence[str], None] = 'a0b1c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS cedula TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS cedula")
