"""add es_activo_fijo to facturas

Revision ID: a0b1c2d3e4f5
Revises: z0a1b2c3d4e5
Create Date: 2026-08-11

Flag marcado por el Responsable en el detalle de la factura y visible
en todo el flujo (Contabilidad, Tesorería, exportes).
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, Sequence[str], None] = 'z0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE facturas
        ADD COLUMN IF NOT EXISTS es_activo_fijo BOOLEAN NOT NULL DEFAULT false
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE facturas DROP COLUMN IF EXISTS es_activo_fijo")
