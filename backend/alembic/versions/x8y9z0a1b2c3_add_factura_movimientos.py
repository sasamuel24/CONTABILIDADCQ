"""bitacora de movimientos reales de facturas (trazabilidad no inferida)

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-07-29 10:00:00.000000

El historial de trazabilidad se armaba INFIRIENDO fechas de las columnas de
`facturas` (created_at, assigned_at, fecha_envio_*). Los pases entre áreas no
dejaban rastro en la BD: solo quedaban en el log de la aplicación, que además
rota. Resultado: la línea de tiempo mostraba fechas que no correspondían al
hecho (PAQE652890 figuraba llegando a Torre Control el 24-jul, su created_at,
cuando Radicación la pasó allá el 25-jul 7:13 a. m. según el log).

Esta tabla guarda el hecho: qué movimiento fue, de qué área a cuál, qué estado,
quién lo hizo y cuándo.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'x8y9z0a1b2c3'
down_revision: Union[str, Sequence[str], None] = 'w7x8y9z0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'factura_movimientos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'factura_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('facturas.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('tipo', sa.String(length=40), nullable=False),
        sa.Column(
            'area_desde_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('areas.id', ondelete='SET NULL'), nullable=True
        ),
        sa.Column(
            'area_hasta_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('areas.id', ondelete='SET NULL'), nullable=True
        ),
        sa.Column('estado_desde_id', sa.SmallInteger(), nullable=True),
        sa.Column('estado_hasta_id', sa.SmallInteger(), nullable=True),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True
        ),
        sa.Column('user_nombre', sa.Text(), nullable=True),
        sa.Column('motivo', sa.Text(), nullable=True),
        sa.Column(
            'created_at', postgresql.TIMESTAMP(timezone=True),
            server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index('ix_factura_movimientos_factura_id', 'factura_movimientos', ['factura_id'])
    op.create_index('ix_factura_movimientos_tipo', 'factura_movimientos', ['tipo'])
    op.create_index('ix_factura_movimientos_created_at', 'factura_movimientos', ['created_at'])
    # El historial de una factura se lee siempre ordenado por fecha.
    op.create_index(
        'ix_factura_movimientos_factura_fecha',
        'factura_movimientos',
        ['factura_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_factura_movimientos_factura_fecha', table_name='factura_movimientos')
    op.drop_index('ix_factura_movimientos_created_at', table_name='factura_movimientos')
    op.drop_index('ix_factura_movimientos_tipo', table_name='factura_movimientos')
    op.drop_index('ix_factura_movimientos_factura_id', table_name='factura_movimientos')
    op.drop_table('factura_movimientos')
