"""agregar campos de estado y devolución individual a gastos_legalizacion

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-03-11 10:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = 'c3d4e5f6a7b9'
down_revision = 'b2c3d4e5f6a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Agregar columna estado_gasto
    op.add_column(
        'gastos_legalizacion',
        sa.Column(
            'estado_gasto',
            sa.String(20),
            nullable=False,
            server_default='pendiente'
        )
    )

    # 2. Agregar columna motivo_devolucion_gasto
    op.add_column(
        'gastos_legalizacion',
        sa.Column('motivo_devolucion_gasto', sa.Text(), nullable=True)
    )

    # 3. Agregar columna devuelto_por_user_id
    op.add_column(
        'gastos_legalizacion',
        sa.Column('devuelto_por_user_id', PG_UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_gastos_devuelto_por_user',
        'gastos_legalizacion',
        'users',
        ['devuelto_por_user_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # 4. Agregar columna fecha_devolucion_gasto
    op.add_column(
        'gastos_legalizacion',
        sa.Column('fecha_devolucion_gasto', sa.TIMESTAMP(timezone=True), nullable=True)
    )

    # 5. Agregar check constraint para estado_gasto
    op.create_check_constraint(
        'check_estado_gasto_valid',
        'gastos_legalizacion',
        "estado_gasto IN ('pendiente','devuelto','aceptado')"
    )


def downgrade() -> None:
    op.drop_constraint('check_estado_gasto_valid', 'gastos_legalizacion', type_='check')
    op.drop_constraint('fk_gastos_devuelto_por_user', 'gastos_legalizacion', type_='foreignkey')
    op.drop_column('gastos_legalizacion', 'fecha_devolucion_gasto')
    op.drop_column('gastos_legalizacion', 'devuelto_por_user_id')
    op.drop_column('gastos_legalizacion', 'motivo_devolucion_gasto')
    op.drop_column('gastos_legalizacion', 'estado_gasto')
