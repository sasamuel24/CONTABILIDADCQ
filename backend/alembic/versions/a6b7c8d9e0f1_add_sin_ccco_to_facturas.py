"""add sin_ccco to facturas

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-08-19

Flag marcado por el Responsable (con motivo obligatorio, registrado como
comentario) para facturas sin imputación CC/CO (p. ej. mayor valor de un
activo): exime Centro de Costo y Centro de Operación del checklist de
Contabilidad y permite solicitar la Aprobación de Gerencia sin esos datos.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a6b7c8d9e0f1'
down_revision: Union[str, Sequence[str], None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE facturas
        ADD COLUMN IF NOT EXISTS sin_ccco BOOLEAN NOT NULL DEFAULT false
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE facturas DROP COLUMN IF EXISTS sin_ccco")
