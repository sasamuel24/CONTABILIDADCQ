"""add tipo_flujo and aprobador_id to paquetes_gastos

Revision ID: e2f3a4b5c6d7
Revises: c4d5e6f7a8b9
Create Date: 2026-04-29 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'e2f3a4b5c6d7'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'paquetes_gastos',
        sa.Column('tipo_flujo', sa.String(20), nullable=False, server_default='mantenimiento')
    )
    op.add_column(
        'paquetes_gastos',
        sa.Column('aprobador_id', UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_paquetes_gastos_aprobador_id',
        'paquetes_gastos', 'aprobadores_gerencia',
        ['aprobador_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_paquetes_gastos_aprobador_id', 'paquetes_gastos', ['aprobador_id'])
    op.create_check_constraint(
        'check_tipo_flujo_valid',
        'paquetes_gastos',
        "tipo_flujo IN ('mantenimiento', 'general')"
    )


def downgrade() -> None:
    op.drop_constraint('check_tipo_flujo_valid', 'paquetes_gastos', type_='check')
    op.drop_index('ix_paquetes_gastos_aprobador_id', table_name='paquetes_gastos')
    op.drop_constraint('fk_paquetes_gastos_aprobador_id', 'paquetes_gastos', type_='foreignkey')
    op.drop_column('paquetes_gastos', 'aprobador_id')
    op.drop_column('paquetes_gastos', 'tipo_flujo')
