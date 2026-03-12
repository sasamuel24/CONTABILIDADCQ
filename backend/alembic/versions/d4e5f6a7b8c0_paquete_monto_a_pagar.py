"""add monto_a_pagar to paquetes_gasto

Revision ID: d4e5f6a7b8c0
Revises: c3d4e5f6a7b9
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c0'
down_revision = 'c3d4e5f6a7b9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'paquetes_gastos',
        sa.Column('monto_a_pagar', sa.Numeric(14, 2), nullable=True),
    )


def downgrade():
    op.drop_column('paquetes_gastos', 'monto_a_pagar')
