"""add fecha_envio_tesoreria to paquetes_gastos

Revision ID: b1c2d3e4f5a6
Revises: aa1b2c3d4e5f
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'aa1b2c3d4e5f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'paquetes_gastos',
        sa.Column('fecha_envio_tesoreria', sa.TIMESTAMP(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('paquetes_gastos', 'fecha_envio_tesoreria')
