"""add envio_tesoreria to tipo comentario paquete constraint

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-03-05 13:30:00.000000

"""
from alembic import op

revision = 'd2e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('check_tipo_comentario_paquete_valid', 'comentarios_paquete', type_='check')
    op.create_check_constraint(
        'check_tipo_comentario_paquete_valid',
        'comentarios_paquete',
        "tipo IN ('observacion','devolucion','aprobacion','pago','envio_tesoreria')",
    )


def downgrade() -> None:
    op.drop_constraint('check_tipo_comentario_paquete_valid', 'comentarios_paquete', type_='check')
    op.create_check_constraint(
        'check_tipo_comentario_paquete_valid',
        'comentarios_paquete',
        "tipo IN ('observacion','devolucion','aprobacion','pago')",
    )
