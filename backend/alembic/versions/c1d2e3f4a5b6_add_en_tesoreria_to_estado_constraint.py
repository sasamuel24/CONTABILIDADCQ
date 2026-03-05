"""add en_tesoreria to paquetes_gastos estado constraint

Revision ID: c1d2e3f4a5b6
Revises: b3d4e5f6a7b8
Create Date: 2026-03-04 12:00:00.000000

"""
from alembic import op

revision = 'c1d2e3f4a5b6'
down_revision = 'b3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('check_estado_paquete_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_estado_paquete_valid',
        'paquetes_gastos',
        "estado IN ('borrador','en_revision','devuelto','aprobado','en_tesoreria','pagado')"
    )


def downgrade() -> None:
    op.drop_constraint('check_estado_paquete_valid', 'paquetes_gastos', type_='check')
    op.create_check_constraint(
        'check_estado_paquete_valid',
        'paquetes_gastos',
        "estado IN ('borrador','en_revision','devuelto','aprobado','pagado')"
    )
