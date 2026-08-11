"""recordatorio de aprobaciones pendientes en tokens de facturas

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-08-11 12:00:00.000000

Los tokens de aprobación de facturas vencen a las 72 horas: si el gerente no ve
el correo a tiempo, la aprobación se pierde y hay que reenviarla a mano.

Se agrega `recordatorio_enviado_at` en `tokens_aprobacion_facturas` para saber
cuándo se le recordó por última vez al aprobador y no repetir el recordatorio
en cada corrida del ciclo diario (se recuerda como máximo una vez cada ~20h
mientras el enlace siga vigente y la factura siga pendiente).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'z0a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = 'y9z0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tokens_aprobacion_facturas',
        sa.Column('recordatorio_enviado_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tokens_aprobacion_facturas', 'recordatorio_enviado_at')
