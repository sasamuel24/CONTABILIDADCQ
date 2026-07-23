"""Agrega estado 'cruzado' a paquetes_gastos (cierre por cruce desde Facturación)

- Nuevo estado final 'cruzado' en check_estado_paquete_valid
- Nueva columna fecha_cruce en paquetes_gastos
- Nuevo tipo de comentario 'cruce' en check_tipo_comentario_paquete_valid

Revision ID: v6w7x8y9z0a1
Revises: t4u5v6w7x8y9
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = 'v6w7x8y9z0a1'
down_revision = 't4u5v6w7x8y9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'paquetes_gastos',
        sa.Column('fecha_cruce', TIMESTAMP(timezone=True), nullable=True)
    )
    op.drop_constraint('check_estado_paquete_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_estado_paquete_valid',
        'paquetes_gastos',
        "estado IN ('borrador','en_validacion','en_revision','devuelto','aprobado','en_tesoreria','pagado','cruzado')",
    )
    op.drop_constraint('check_tipo_comentario_paquete_valid', 'comentarios_paquete', type_='check')
    op.create_check_constraint(
        'check_tipo_comentario_paquete_valid',
        'comentarios_paquete',
        "tipo IN ('observacion','devolucion','aprobacion','pago','envio_tesoreria','devolucion_gasto','cruce')",
    )


def downgrade() -> None:
    op.drop_constraint('check_tipo_comentario_paquete_valid', 'comentarios_paquete', type_='check')
    op.create_check_constraint(
        'check_tipo_comentario_paquete_valid',
        'comentarios_paquete',
        "tipo IN ('observacion','devolucion','aprobacion','pago','envio_tesoreria','devolucion_gasto')",
    )
    op.drop_constraint('check_estado_paquete_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_estado_paquete_valid',
        'paquetes_gastos',
        "estado IN ('borrador','en_validacion','en_revision','devuelto','aprobado','en_tesoreria','pagado')",
    )
    op.drop_column('paquetes_gastos', 'fecha_cruce')
