"""rechazo con motivo desde el correo de aprobacion de facturas

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-07-29 12:00:00.000000

El correo de aprobación solo traía botón de aprobar: si el gerente NO estaba de
acuerdo, no había forma de decirlo dentro del flujo (respondía por fuera, por
correo o WhatsApp, y en DocuFlow la factura quedaba esperando indefinidamente).

Se agregan:
- En `facturas`, el rechazo vigente: fecha, quién, motivo y de qué aprobación
  (Gerencia o la dual OPS/CALIDAD). Campos PROPIOS, no se reutiliza
  `motivo_devolucion`: ese es el rechazo de Contabilidad hacia el responsable y
  mezclarlos rompería la lógica de `devolucion_vigente` del historial.
- En `tokens_aprobacion_facturas`, en qué sentido se usó el enlace: `usado` solo
  dice que se consumió, no si fue aprobación o rechazo.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'y9z0a1b2c3d4'
down_revision: Union[str, Sequence[str], None] = 'x8y9z0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('facturas', sa.Column('fecha_rechazo_email', postgresql.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('facturas', sa.Column('rechazado_por_nombre', sa.Text(), nullable=True))
    op.add_column('facturas', sa.Column('rechazado_por_email', sa.Text(), nullable=True))
    op.add_column('facturas', sa.Column('motivo_rechazo_email', sa.Text(), nullable=True))
    op.add_column('facturas', sa.Column('tipo_rechazo_email', sa.String(length=20), nullable=True))

    op.add_column('tokens_aprobacion_facturas', sa.Column('resultado', sa.String(length=20), nullable=True))
    op.add_column('tokens_aprobacion_facturas', sa.Column('motivo_rechazo', sa.Text(), nullable=True))

    # Los enlaces ya consumidos antes de esta migración solo podían aprobar.
    op.execute("UPDATE tokens_aprobacion_facturas SET resultado = 'aprobado' WHERE usado = true")


def downgrade() -> None:
    op.drop_column('tokens_aprobacion_facturas', 'motivo_rechazo')
    op.drop_column('tokens_aprobacion_facturas', 'resultado')
    op.drop_column('facturas', 'tipo_rechazo_email')
    op.drop_column('facturas', 'motivo_rechazo_email')
    op.drop_column('facturas', 'rechazado_por_email')
    op.drop_column('facturas', 'rechazado_por_nombre')
    op.drop_column('facturas', 'fecha_rechazo_email')
