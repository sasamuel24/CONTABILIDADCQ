"""add sin_oc_os to facturas

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-08-14

Flag marcado por el Responsable (con motivo obligatorio, registrado como
comentario) para facturas que legítimamente no tienen OC ni OS: exime el
archivo OC/OS del checklist de Contabilidad sin eximir la Aprobación de
Gerencia.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE facturas
        ADD COLUMN IF NOT EXISTS sin_oc_os BOOLEAN NOT NULL DEFAULT false
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE facturas DROP COLUMN IF EXISTS sin_oc_os")
