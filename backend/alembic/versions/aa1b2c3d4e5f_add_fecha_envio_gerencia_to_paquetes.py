"""add fecha_envio_gerencia to paquetes_gastos

Revision ID: aa1b2c3d4e5f
Revises: f1a2b3c4d5e6
Create Date: 2026-03-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'aa1b2c3d4e5f'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'paquetes_gastos',
        sa.Column('fecha_envio_gerencia', sa.TIMESTAMP(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('paquetes_gastos', 'fecha_envio_gerencia')
